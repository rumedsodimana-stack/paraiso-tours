import "server-only";

/**
 * Native-tool-calling agent runtime — Cowork-grade orchestration.
 *
 * This module owns the iterative agentic loop on the server side:
 *
 *   1.  Build the Anthropic `tools` parameter from `AGENT_TOOLS`.
 *   2.  Call `messages.create` with the user message + system prompt.
 *   3.  If the response contains `tool_use` content blocks, execute them
 *       on the server (`safe` tools auto-run; `delete` tools suspend the
 *       loop and return for HITL approval), append `tool_result` blocks,
 *       and call the model again.
 *   4.  Loop until the model emits a turn with no `tool_use` blocks (i.e.
 *       it's done) — typically 1-8 iterations, hard-capped at MAX_ITERATIONS.
 *
 * The whole loop runs in a single server-action invocation, so a single
 * "user message → final answer" round-trip can chain N tool calls without
 * any client orchestration. This is the architectural leap vs. the JSON-mode
 * OODA path, which only got one tool per server call.
 *
 * Conversation state for HITL resume is **returned to the client** rather
 * than held server-side: keeps the runtime stateless across cold starts and
 * lets a delete approval that takes the admin 5 minutes to confirm still
 * resume cleanly. The state is the Anthropic content-blocks array; the
 * client passes it back verbatim on resume.
 *
 * The legacy JSON-mode path (`decideAgentAction` in `src/app/actions/agent.ts`)
 * is left untouched. Native runtime is opt-in on the Anthropic provider; the
 * client picks the path based on `runtime.providerKind`.
 */

import { AGENT_TOOLS, getTool, type ToolDescriptor } from "./agent-tools";
import { zodToJsonSchema } from "./zod-jsonschema";
import { getAppSettings } from "./app-config";
import { getAiRuntimeStatus } from "./ai";
import { getStoredAiApiKeyRecord } from "./app-config";
import { decryptStoredSecret } from "./settings-secrets";
import { recordAuditEvent } from "./audit";
import {
  AGENT_NATIVE_SYSTEM_PROMPT,
  buildOrientPrompt,
  type AgentObservation,
} from "./agent-ooda";

// ── Types ───────────────────────────────────────────────────────────────

/** A user-facing event the client renders as a message bubble or pill. */
export type AgentEvent =
  | { kind: "assistant_text"; content: string }
  | { kind: "tool_use"; toolName: string; input: unknown; toolUseId: string }
  | {
      kind: "tool_result";
      toolUseId: string;
      toolName: string;
      ok: boolean;
      summary: string;
      data?: unknown;
    };

/**
 * Streaming event types — emitted progressively from `streamAgentTurn`
 * over SSE. The client renders each one as it arrives:
 *   - `assistant_text_delta` accumulates into a live-typing message bubble
 *   - `tool_use_start` shows a "calling X" placeholder card
 *   - `tool_use_input_complete` finalizes the input on the placeholder
 *   - `tool_executing` flips the card to a spinner
 *   - `tool_result` flips it to executed (success or failure)
 *   - `pending_approval` ends the stream and surfaces the HITL gate
 *   - `complete` ends the stream cleanly
 *   - `error` ends the stream with a failure
 *
 * Transport: each event is JSON-encoded and emitted as one SSE
 * `data: {...}\n\n` chunk by the API route — see /api/agent/turn.
 */
export type StreamEvent =
  | { kind: "iteration_start"; iter: number }
  | { kind: "assistant_text_delta"; index: number; text: string }
  | {
      kind: "tool_use_start";
      toolUseId: string;
      toolName: string;
      index: number;
    }
  | {
      kind: "tool_use_input_complete";
      toolUseId: string;
      input: Record<string, unknown>;
    }
  | { kind: "tool_executing"; toolUseId: string; toolName: string }
  | {
      kind: "tool_result";
      toolUseId: string;
      toolName: string;
      ok: boolean;
      summary: string;
      data?: unknown;
    }
  | {
      kind: "pending_approval";
      toolName: string;
      toolUseId: string;
      input: unknown;
      state: AgentTurnState;
    }
  | {
      kind: "complete";
      finalText: string;
      iterations: number;
      stopReason?: string;
    }
  | { kind: "error"; error: string };

/** Anthropic content-block shape (we don't depend on the SDK). */
type TextBlock = { type: "text"; text: string };
type ToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};
type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};
type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;
type Message = { role: "user" | "assistant"; content: ContentBlock[] | string };

/**
 * Conversation state for HITL resume. The client receives this verbatim
 * when a delete is pending and posts it back on approve/reject.
 *
 * Anthropic requires that EVERY tool_use block in a prior assistant
 * message has a matching tool_result block in the next user message.
 * When the model emits multiple tool_use blocks in one turn (parallel
 * tool calling) and one of them is a delete that needs HITL approval,
 * we must remember the safe tools we already executed (`partialToolResults`)
 * so the next user-message contains a full set of results — including
 * for the safe tools we ran while the admin was deciding.
 *
 * If the same turn has multiple delete tools, we suspend on each one
 * sequentially: the first goes into `pending*`, the rest go into
 * `queuedDeletes` and are processed on each resume in order.
 */
export interface AgentTurnState {
  /** Full Anthropic messages array (user + assistant turns + tool_results). */
  messages: Message[];
  /** Model + system that the suspended loop was using. */
  model: string;
  systemPrompt: string;
  /** The pending tool_use id we're waiting on. */
  pendingToolUseId: string;
  pendingToolName: string;
  pendingToolInput: unknown;
  /** Tool_result blocks for safe tools that already ran in this iteration.
   *  Combined with the pending tool's result on resume to form the next
   *  user-message content. */
  partialToolResults?: ToolResultBlock[];
  /** Other delete tools from the same iteration, queued behind the
   *  current `pending*`. Each is surfaced for HITL approval on resume,
   *  in order, before the loop continues. */
  queuedDeletes?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
}

export type AgentTurnOutcome =
  | {
      kind: "complete";
      events: AgentEvent[];
      finalText: string;
      iterations: number;
      stopReason?: string;
    }
  | {
      kind: "pending_approval";
      events: AgentEvent[];
      pending: {
        toolName: string;
        toolUseId: string;
        input: unknown;
      };
      state: AgentTurnState;
    }
  | {
      kind: "error";
      events: AgentEvent[];
      error: string;
    };

export interface RunAgentTurnInput {
  /** The admin's latest message. */
  userMessage: string;
  /** Workspace observation — current entity, recent dialogue, memory. */
  observation: AgentObservation;
  /** Optional: prior conversation in Anthropic content-block shape. Used
   *  when the client wants to continue a long-running thread instead of
   *  re-flattening. */
  priorMessages?: Message[];
  /** When > 0, this turn is a sub-agent invocation dispatched by a parent
   *  turn's `dispatch_subagent` tool call. Sub-agents see a filtered tool
   *  catalog (no deletes, no nested dispatch) and a focused system prompt.
   *  Default 0 = top-level admin turn. The catalog filter strips
   *  `dispatch_subagent` from sub-agents, so depth > 1 is unreachable —
   *  the depth field is purely a "this is a sub-agent" signal, not a
   *  recursion counter. */
  _subagentDepth?: number;
}

// ── Tool catalog publishing ─────────────────────────────────────────────

interface AnthropicToolSpec {
  name: string;
  description: string;
  input_schema: ReturnType<typeof zodToJsonSchema>;
}

/**
 * Convert AGENT_TOOLS into Anthropic-format tool specs.
 *
 * Top-level agent (default): every tool is exposed — including `delete`
 * tools — but the loop intercepts delete tool_use blocks and suspends
 * for HITL approval before executing.
 *
 * Sub-agent (`opts.isSubagent === true`): delete tools and
 * `dispatch_subagent` are filtered out. Sub-agents are scoped researchers
 * — they should never destructively mutate (the admin doesn't see their
 * tool cards) and they shouldn't recursively spawn nested sub-agents
 * (worst-case branching). Depth cap = 1, enforced by tool catalog rather
 * than a runtime counter so the model literally cannot see the dispatch
 * tool to call it.
 *
 * The category is encoded into the description so the model's prompt can
 * still reason about which tools auto-run vs which ones need approval.
 */
function buildToolSpecs(opts?: {
  isSubagent?: boolean;
}): AnthropicToolSpec[] {
  const isSubagent = opts?.isSubagent === true;
  return AGENT_TOOLS.filter((t) => {
    if (!isSubagent) return true;
    if (t.category === "delete") return false;
    if (t.name === "dispatch_subagent") return false;
    return true;
  }).map((t) => ({
    name: t.name,
    description: `[${t.category}] ${t.summary}`,
    input_schema: zodToJsonSchema(t.inputSchema),
  }));
}

// ── Anthropic client ────────────────────────────────────────────────────

const MAX_ITERATIONS = 12;
const ITERATION_TIMEOUT_MS = 120_000; // 2 min per call
const TOTAL_TURN_TIMEOUT_MS = 240_000; // 4 min ceiling per turn

interface AnthropicCallInput {
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  messages: Message[];
  tools: AnthropicToolSpec[];
  maxTokens: number;
  temperature: number;
}

interface AnthropicCallOutput {
  content: ContentBlock[];
  stopReason: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

function normalizeMessagesUrl(baseUrl: string) {
  if (baseUrl.endsWith("/messages")) return baseUrl;
  if (baseUrl.endsWith("/v1")) return `${baseUrl}/messages`;
  return `${baseUrl}/v1/messages`;
}

async function callAnthropicWithTools(
  input: AnthropicCallInput
): Promise<AnthropicCallOutput> {
  const response = await fetch(normalizeMessagesUrl(input.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.maxTokens,
      temperature: input.temperature,
      system: input.systemPrompt,
      tools: input.tools,
      messages: input.messages,
    }),
    signal: AbortSignal.timeout(ITERATION_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Anthropic agent call failed (${response.status}): ${body.slice(0, 400)}`
    );
  }

  const payload = (await response.json()) as {
    content?: ContentBlock[];
    stop_reason?: string;
    usage?: AnthropicCallOutput["usage"];
  };

  return {
    content: payload.content ?? [],
    stopReason: payload.stop_reason ?? "end_turn",
    usage: payload.usage,
  };
}

// ── Tool execution ──────────────────────────────────────────────────────

/**
 * Run a single tool. Caller is responsible for the HITL gate (delete
 * tools should be intercepted before reaching here in non-approved
 * contexts).
 */
async function executeToolUse(
  block: ToolUseBlock,
  approved: boolean
): Promise<{
  ok: boolean;
  summary: string;
  data?: unknown;
  toolName: string;
  category: ToolDescriptor["category"];
}> {
  const tool = getTool(block.name);
  if (!tool) {
    return {
      ok: false,
      summary: `Unknown tool: ${block.name}`,
      toolName: block.name,
      category: "read",
    };
  }

  // Server-side double-gate for delete operations.
  if (tool.category === "delete" && !approved) {
    return {
      ok: false,
      summary: `Tool "${tool.name}" requires admin approval before executing.`,
      toolName: tool.name,
      category: tool.category,
    };
  }

  // Validate input against the Zod schema before invoking the handler.
  const parsed = tool.inputSchema.safeParse(block.input);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return {
      ok: false,
      summary: `Invalid input for ${tool.name}: ${msg}`,
      toolName: tool.name,
      category: tool.category,
    };
  }

  const result = await tool.handler(parsed.data);

  // Audit every executed tool — same trail the JSON-mode path writes to,
  // so admin/settings audit log stays unified across both runtimes.
  await recordAuditEvent({
    entityType: "system",
    entityId: "agent",
    action: result.ok ? `executed_${tool.name}` : `execute_failed_${tool.name}`,
    summary: result.ok
      ? `Agent (native) executed ${tool.name}: ${result.summary}`
      : `Agent (native) execution failed for ${tool.name}: ${result.error ?? result.summary}`,
    metadata: {
      channel: "agent_ui",
      feature: "agent_native",
      tool: tool.name,
      status: result.ok ? "success" : "failed",
      ...(result.error ? { error: result.error } : {}),
    },
  });

  return {
    ok: result.ok,
    summary: result.summary,
    data: result.data,
    toolName: tool.name,
    category: tool.category,
  };
}

// ── Loop driver ─────────────────────────────────────────────────────────

async function resolveAnthropicCredentials() {
  const settings = await getAppSettings();
  const runtime = await getAiRuntimeStatus();

  if (runtime.providerKind !== "anthropic") {
    throw new Error(
      "Native-tool-calling runtime requires the Anthropic provider. Switch the AI provider in Admin → Settings."
    );
  }
  if (!runtime.enabled) {
    throw new Error(runtime.missingReason ?? "AI is disabled.");
  }
  if (!runtime.configured) {
    throw new Error(runtime.missingReason ?? "AI is not configured.");
  }

  const envKey =
    process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.AI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    "";
  let apiKey = envKey;
  if (!apiKey) {
    const stored = await getStoredAiApiKeyRecord();
    if (stored.encryptedKey) {
      try {
        apiKey = decryptStoredSecret(stored.encryptedKey);
      } catch (err) {
        throw new Error(
          `Stored AI API key could not be decrypted: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }
  if (!apiKey) {
    throw new Error(
      "No Anthropic API key found. Set ANTHROPIC_API_KEY in env or save one in Admin → Settings."
    );
  }

  return {
    apiKey,
    baseUrl: runtime.baseUrl,
    model: runtime.defaultModel || runtime.model,
    settings,
  };
}

/**
 * Build the system prompt for a native-tool-calling turn. We start from
 * `AGENT_NATIVE_SYSTEM_PROMPT` (no JSON contract — the native protocol
 * carries structure) and append the live observation block so the model
 * knows the admin's current entity / view / memory before its first tool
 * call.
 */
function buildSystemPrompt(observation: AgentObservation): string {
  const orient = buildOrientPrompt(observation);
  return [
    AGENT_NATIVE_SYSTEM_PROMPT,
    "",
    "Live observation (workspace state at the start of this turn):",
    orient || "(no additional context)",
  ].join("\n");
}

/**
 * Build the system prompt for a sub-agent turn. Inherits the full action
 * bias, never-refuse, error-recovery, and tool-protocol guards from the
 * top-level prompt, but layers on a sub-agent addendum that:
 *   - Forbids clarifying questions (no admin to answer them)
 *   - Demands a dense, decision-ready final summary (becomes the parent
 *     agent's tool_result content)
 *   - Names the missing capabilities (no delete, no nested dispatch) so
 *     the model doesn't waste a turn searching for them
 */
function buildSubagentSystemPrompt(observation: AgentObservation): string {
  const orient = buildOrientPrompt(observation);
  return [
    AGENT_NATIVE_SYSTEM_PROMPT,
    "",
    "── SUB-AGENT MODE ──",
    "You are a sub-agent dispatched by the main admin agent for a focused",
    "research / analysis task. The user message is your scoped mission.",
    "",
    "RULES SPECIFIC TO SUB-AGENT MODE:",
    "- You have NO admin to answer clarifying questions. Never ask 'which",
    "  one?' or 'should I…?'. Make a sensible default and proceed; the",
    "  parent agent will adjudicate any ambiguity in its synthesis.",
    "- Your final assistant text becomes the parent's tool_result content.",
    "  Make it dense and decision-ready: concrete numbers, names, and 1-2",
    "  actionable observations. Avoid filler. Aim for ≤200 words unless",
    "  the parent explicitly asked for a detailed report.",
    "- Tools available: read, create, update, send. Delete tools and",
    "  nested sub-agent dispatch are NOT in your catalog — those stay",
    "  with the parent agent. If your research surfaces a delete-worthy",
    "  finding, name it in your summary so the parent can act.",
    "",
    "Live observation (sub-agent fresh start):",
    orient || "(no admin context — stand-alone task)",
  ].join("\n");
}

/**
 * Iteration loop body — shared between fresh turns and resumes. Runs
 * model → tool execution → loop, with parallel tool execution within
 * each iteration. Returns when the model finishes (no more tool_use),
 * a delete shows up that needs HITL approval, or the iteration cap hits.
 *
 * Inputs are the live conversation `messages` (mutated as the loop
 * progresses) plus the `events` array (also mutated, surfaced to the
 * client). This is intentional — the caller pre-seeds both with
 * whatever the current request needs (a fresh user message, a resumed
 * tool_result, etc.).
 */
async function runLoop(
  creds: Awaited<ReturnType<typeof resolveAnthropicCredentials>>,
  tools: AnthropicToolSpec[],
  messages: Message[],
  model: string,
  systemPrompt: string,
  startedAt: number,
  events: AgentEvent[]
): Promise<AgentTurnOutcome> {
  for (let iter = 0; iter < MAX_ITERATIONS; iter += 1) {
    if (Date.now() - startedAt > TOTAL_TURN_TIMEOUT_MS) {
      return {
        kind: "error",
        events,
        error: `Agent turn exceeded ${TOTAL_TURN_TIMEOUT_MS / 1000}s ceiling. Try a more focused request.`,
      };
    }

    let response: AnthropicCallOutput;
    try {
      response = await callAnthropicWithTools({
        apiKey: creds.apiKey,
        baseUrl: creds.baseUrl,
        model,
        systemPrompt,
        messages,
        tools,
        maxTokens: creds.settings.ai.maxTokens,
        temperature: creds.settings.ai.temperature,
      });
    } catch (err) {
      return {
        kind: "error",
        events,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    // Persist the assistant turn so the next iteration sees its own
    // tool_use blocks (Anthropic requires every tool_use have a matching
    // tool_result in the next user message for correlation).
    messages.push({ role: "assistant", content: response.content });

    // Surface text deltas as events.
    for (const block of response.content) {
      if (block.type === "text" && block.text) {
        events.push({ kind: "assistant_text", content: block.text });
      }
    }

    // Find tool_use blocks. If none, the model is done.
    const toolUses = response.content.filter(
      (b): b is ToolUseBlock => b.type === "tool_use"
    );
    if (toolUses.length === 0) {
      const finalText = response.content
        .filter((b): b is TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return {
        kind: "complete",
        events,
        finalText,
        iterations: iter + 1,
        stopReason: response.stopReason,
      };
    }

    // Surface every tool_use as a UI event upfront — the client renders
    // proposal cards for the whole batch immediately, then transitions
    // each one to "executed" as its tool_result event arrives.
    for (const b of toolUses) {
      events.push({
        kind: "tool_use",
        toolName: b.name,
        input: b.input,
        toolUseId: b.id,
      });
    }

    // Partition: deletes need HITL approval, everything else can run.
    const safeBlocks: ToolUseBlock[] = [];
    const deleteBlocks: ToolUseBlock[] = [];
    for (const b of toolUses) {
      const tool = getTool(b.name);
      if (tool && tool.category === "delete") deleteBlocks.push(b);
      else safeBlocks.push(b);
    }

    // Run all safe tools in parallel — if the model emits 5 reads in
    // one turn, that's 5 concurrent executions instead of 5 sequential.
    // Each tool's audit-log write happens inside `executeToolUse`, so
    // the audit trail stays correct even with parallelism.
    const toolResults: ToolResultBlock[] = [];
    if (safeBlocks.length > 0) {
      const execs = await Promise.all(
        safeBlocks.map((b) => executeToolUse(b, false))
      );
      for (let i = 0; i < safeBlocks.length; i += 1) {
        const b = safeBlocks[i];
        const exec = execs[i];
        events.push({
          kind: "tool_result",
          toolUseId: b.id,
          toolName: exec.toolName,
          ok: exec.ok,
          summary: exec.summary,
          data: exec.data,
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: b.id,
          content: stringifyToolResultForModel(exec),
          ...(exec.ok ? {} : { is_error: true }),
        });
      }
    }

    // Any deletes? Suspend on the first; queue the rest. The safe tools
    // we already ran are saved as `partialToolResults` so the resume
    // can reconstruct a complete tool_result message — Anthropic
    // requires matching tool_results for every tool_use in the prior
    // assistant message, or it'll reject the next call.
    if (deleteBlocks.length > 0) {
      const [first, ...rest] = deleteBlocks;
      return {
        kind: "pending_approval",
        events,
        pending: {
          toolName: first.name,
          toolUseId: first.id,
          input: first.input,
        },
        state: {
          messages,
          model,
          systemPrompt,
          pendingToolUseId: first.id,
          pendingToolName: first.name,
          pendingToolInput: first.input,
          partialToolResults: toolResults,
          queuedDeletes: rest.map((b) => ({
            id: b.id,
            name: b.name,
            input: b.input,
          })),
        },
      };
    }

    // All safe — feed tool_results back as one user message and continue.
    messages.push({ role: "user", content: toolResults });
  }

  // Iteration cap hit — bail out.
  return {
    kind: "error",
    events,
    error: `Agent did not finish within ${MAX_ITERATIONS} tool iterations. The conversation has been preserved; rephrase or narrow the request.`,
  };
}

/**
 * Run the full server-side agent loop: tool-call → execute → loop, until
 * the model is done (no more tool_use) or hits a delete that needs admin
 * approval.
 *
 * When `input._subagentDepth > 0` we run in sub-agent mode: filtered
 * tool catalog (no deletes, no nested dispatch) and a focused system
 * prompt that forbids clarifying questions and demands a dense final
 * summary. Sub-agent mode is invoked recursively from `runSubagent`,
 * which is the handler for the `dispatch_subagent` tool.
 */
export async function runAgentTurn(
  input: RunAgentTurnInput
): Promise<AgentTurnOutcome> {
  const events: AgentEvent[] = [];
  const startedAt = Date.now();

  let creds: Awaited<ReturnType<typeof resolveAnthropicCredentials>>;
  try {
    creds = await resolveAnthropicCredentials();
  } catch (err) {
    return {
      kind: "error",
      events,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const isSubagent = (input._subagentDepth ?? 0) > 0;
  const tools = buildToolSpecs({ isSubagent });
  const systemPrompt = isSubagent
    ? buildSubagentSystemPrompt(input.observation)
    : buildSystemPrompt(input.observation);

  // Seed messages: prior conversation if continuing, plus the new user turn.
  const messages: Message[] = [
    ...(input.priorMessages ?? []),
    { role: "user", content: input.userMessage },
  ];

  return runLoop(
    creds,
    tools,
    messages,
    creds.model,
    systemPrompt,
    startedAt,
    events
  );
}

/**
 * Resume a turn after an admin approves (or rejects) a pending delete.
 * The client passes the saved `AgentTurnState` back verbatim — the
 * runtime is stateless across requests, so this works even after a cold
 * start or a long approval delay.
 *
 * On approve: execute the tool, append its tool_result, continue the loop.
 * On reject:  append a failure tool_result with a rejection reason, let
 *             the model continue (it will typically explain or pivot).
 */
export interface ResumeAgentTurnInput {
  state: AgentTurnState;
  approved: boolean;
  rejectionReason?: string;
}

export async function resumeAgentTurn(
  input: ResumeAgentTurnInput
): Promise<AgentTurnOutcome> {
  const events: AgentEvent[] = [];
  const startedAt = Date.now();

  let creds: Awaited<ReturnType<typeof resolveAnthropicCredentials>>;
  try {
    creds = await resolveAnthropicCredentials();
  } catch (err) {
    return {
      kind: "error",
      events,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const tools = buildToolSpecs();
  const messages: Message[] = [...input.state.messages];

  // Build the tool_result for the pending tool_use (approved or rejected).
  const pendingToolUseBlock: ToolUseBlock = {
    type: "tool_use",
    id: input.state.pendingToolUseId,
    name: input.state.pendingToolName,
    input: input.state.pendingToolInput as Record<string, unknown>,
  };

  let pendingResultBlock: ToolResultBlock;
  if (input.approved) {
    const exec = await executeToolUse(pendingToolUseBlock, true);
    events.push({
      kind: "tool_result",
      toolUseId: input.state.pendingToolUseId,
      toolName: exec.toolName,
      ok: exec.ok,
      summary: exec.summary,
      data: exec.data,
    });
    pendingResultBlock = {
      type: "tool_result",
      tool_use_id: input.state.pendingToolUseId,
      content: stringifyToolResultForModel(exec),
      ...(exec.ok ? {} : { is_error: true }),
    };
  } else {
    const reason = input.rejectionReason ?? "Admin rejected this action.";
    events.push({
      kind: "tool_result",
      toolUseId: input.state.pendingToolUseId,
      toolName: input.state.pendingToolName,
      ok: false,
      summary: `Rejected by admin: ${reason}`,
    });
    pendingResultBlock = {
      type: "tool_result",
      tool_use_id: input.state.pendingToolUseId,
      content: `Action rejected by admin. Reason: ${reason}. Do NOT retry the same delete; pivot or explain.`,
      is_error: true,
    };
  }

  // Cumulative tool_results for THIS iteration: any safe tools that ran
  // before the suspension + the result we just computed for the pending
  // delete. Anthropic requires a result for every tool_use in the prior
  // assistant message, so we reassemble the full set here.
  const cumulativeResults: ToolResultBlock[] = [
    ...(input.state.partialToolResults ?? []),
    pendingResultBlock,
  ];

  // Multiple deletes in the same iteration? Suspend on the next one,
  // carrying the cumulative results forward.
  const queuedDeletes = input.state.queuedDeletes ?? [];
  if (queuedDeletes.length > 0) {
    const [next, ...remaining] = queuedDeletes;
    events.push({
      kind: "tool_use",
      toolName: next.name,
      input: next.input,
      toolUseId: next.id,
    });
    return {
      kind: "pending_approval",
      events,
      pending: {
        toolName: next.name,
        toolUseId: next.id,
        input: next.input,
      },
      state: {
        messages,
        model: input.state.model,
        systemPrompt: input.state.systemPrompt,
        pendingToolUseId: next.id,
        pendingToolName: next.name,
        pendingToolInput: next.input,
        partialToolResults: cumulativeResults,
        queuedDeletes: remaining,
      },
    };
  }

  // All deletes in this iteration resolved — push the complete tool_result
  // user message and let the loop continue with the same model + system
  // prompt the suspended turn was using.
  messages.push({ role: "user", content: cumulativeResults });

  return runLoop(
    creds,
    tools,
    messages,
    input.state.model,
    input.state.systemPrompt,
    startedAt,
    events
  );
}

// ── Sub-agent dispatch ──────────────────────────────────────────────────
//
// Sub-agents are invoked through the `dispatch_subagent` tool. The tool
// handler (in agent-tools.ts) imports `runSubagent` lazily and awaits its
// result, which becomes the tool_result content the parent agent sees.
//
// Concurrency: the parent's `runLoop` fires all safe tool_use blocks in
// parallel via Promise.all. So when the model emits 3 dispatch_subagent
// calls in one turn, all 3 sub-agents run concurrently — same fan-out
// machinery the read tools use, no special path.

export interface RunSubagentInput {
  /** The scoped task the parent wants the sub-agent to perform. Becomes
   *  the sub-agent's user message verbatim (with optional context
   *  prepended). */
  task: string;
  /** Optional 1-3 line briefing the parent wants to share. Helps when
   *  the task references entities the sub-agent wouldn't otherwise
   *  know about. */
  context?: string;
}

export interface RunSubagentResult {
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: string;
}

/**
 * Dispatch a focused sub-agent run. Sub-agents have a fresh empty
 * observation (no parent entity or dialogue), see a filtered tool catalog
 * (no deletes, no nested dispatch), and return a single text summary the
 * parent can synthesize.
 *
 * On the wire this is just `runAgentTurn({ ..., _subagentDepth: 1 })` —
 * the sub-agent reuses the entire iterative loop, parallel tool
 * execution, error handling, audit logging, and timeout machinery the
 * top-level agent uses. Only the prompt and tool catalog differ.
 */
export async function runSubagent(
  input: RunSubagentInput
): Promise<RunSubagentResult> {
  const userMessage = input.context
    ? `${input.task}\n\nContext from parent agent:\n${input.context}`
    : input.task;

  const fresh: AgentObservation = {
    recentDialogue: [],
  };

  const outcome = await runAgentTurn({
    userMessage,
    observation: fresh,
    _subagentDepth: 1,
  });

  if (outcome.kind === "complete") {
    return {
      ok: true,
      summary: outcome.finalText || "Sub-agent finished without final text.",
      data: {
        iterations: outcome.iterations,
        toolCount: outcome.events.filter((e) => e.kind === "tool_result")
          .length,
      },
    };
  }
  if (outcome.kind === "pending_approval") {
    // Defensive guard — sub-agents should never reach pending_approval
    // because their tool catalog has no delete tools. If they do, the
    // catalog filter has regressed and we surface that loudly to the
    // parent so it can pivot rather than hang.
    return {
      ok: false,
      summary: `Sub-agent unexpectedly suspended on ${outcome.pending.toolName}; the sub-agent tool catalog filter may have regressed.`,
      error: "subagent_unexpected_pending_approval",
    };
  }
  return {
    ok: false,
    summary: `Sub-agent failed: ${outcome.error}`,
    error: outcome.error,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Render a tool execution result as the string the model receives in the
 * tool_result content block. We send a compact JSON envelope so the model
 * can reason about both the human-readable summary and the structured
 * data, without forcing it to re-parse arbitrary prose.
 */
function stringifyToolResultForModel(exec: {
  ok: boolean;
  summary: string;
  data?: unknown;
}): string {
  const envelope = {
    ok: exec.ok,
    summary: exec.summary,
    data: exec.data ?? null,
  };
  // Bound the size so a 5000-row read tool doesn't blow the context window.
  const serialized = JSON.stringify(envelope, null, 2);
  if (serialized.length <= 24_000) return serialized;
  // Truncate gracefully: keep the envelope shape but elide `data`.
  return JSON.stringify(
    {
      ok: exec.ok,
      summary: exec.summary,
      data_truncated: true,
      data_preview:
        typeof exec.data === "string"
          ? (exec.data as string).slice(0, 4000)
          : JSON.stringify(exec.data).slice(0, 4000),
    },
    null,
    2
  );
}

// ── Streaming runtime ───────────────────────────────────────────────────
//
// Cowork-style live streaming: the model's text appears character-by-
// character in the client UI, tool calls show "calling X" the moment
// they begin (before their input is even fully decided), and the loop
// continues across multiple iterations all within one persistent SSE
// connection from the client.
//
// We use Anthropic's `stream: true` SSE protocol to receive the model's
// content blocks as deltas, accumulate them server-side (text + tool
// inputs both arrive incrementally), and forward higher-level events to
// the client over our own SSE.

/** Raw envelope from the Anthropic streaming SSE stream. */
interface AnthropicStreamEvent {
  event: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

/**
 * Parse Anthropic's streaming SSE response. Yields each `event:` /
 * `data:` pair as it arrives. Exits when the upstream stream closes.
 *
 * SSE framing: events are terminated by a blank line (`\n\n`), each
 * line is `key: value`. We accumulate bytes into a buffer and split on
 * the blank-line marker so partial chunks are handled correctly.
 */
async function* parseAnthropicSse(
  response: Response
): AsyncGenerator<AnthropicStreamEvent> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        if (!block.trim()) continue;

        let eventName = "";
        const dataLines: string[] = [];
        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) eventName = line.slice(7).trim();
          else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
        }
        if (dataLines.length === 0) continue;

        try {
          const data = JSON.parse(dataLines.join("\n"));
          yield { event: eventName, data };
        } catch {
          // skip malformed event silently — Anthropic occasionally sends
          // non-JSON keepalive frames
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * One streaming Anthropic call. Yields raw deltas for the caller to
 * accumulate into content blocks.
 */
async function* callAnthropicStreaming(
  input: AnthropicCallInput
): AsyncGenerator<AnthropicStreamEvent> {
  const response = await fetch(normalizeMessagesUrl(input.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.maxTokens,
      temperature: input.temperature,
      system: input.systemPrompt,
      tools: input.tools,
      messages: input.messages,
      stream: true,
    }),
    signal: AbortSignal.timeout(ITERATION_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Anthropic streaming call failed (${response.status}): ${body.slice(0, 400)}`
    );
  }

  yield* parseAnthropicSse(response);
}

/** Per-content-block accumulator while parsing the SSE deltas. */
type BlockAcc =
  | { kind: "text"; text: string }
  | { kind: "tool_use"; id: string; name: string; partialJson: string };

/**
 * Run one streaming iteration: send the current `messages` to Anthropic
 * with stream=true, forward deltas as `StreamEvent`s, and return the
 * fully-reconstructed content blocks + stop reason once the stream ends.
 */
async function* streamOneIteration(
  creds: Awaited<ReturnType<typeof resolveAnthropicCredentials>>,
  tools: AnthropicToolSpec[],
  messages: Message[],
  model: string,
  systemPrompt: string
): AsyncGenerator<
  StreamEvent,
  { content: ContentBlock[]; stopReason: string }
> {
  const blocks = new Map<number, BlockAcc>();
  let stopReason = "end_turn";

  for await (const ev of callAnthropicStreaming({
    apiKey: creds.apiKey,
    baseUrl: creds.baseUrl,
    model,
    systemPrompt,
    messages,
    tools,
    maxTokens: creds.settings.ai.maxTokens,
    temperature: creds.settings.ai.temperature,
  })) {
    switch (ev.event) {
      case "content_block_start": {
        const idx = ev.data?.index as number;
        const cb = ev.data?.content_block;
        if (!cb) break;
        if (cb.type === "text") {
          blocks.set(idx, { kind: "text", text: "" });
        } else if (cb.type === "tool_use") {
          blocks.set(idx, {
            kind: "tool_use",
            id: cb.id,
            name: cb.name,
            partialJson: "",
          });
          yield {
            kind: "tool_use_start",
            toolUseId: cb.id,
            toolName: cb.name,
            index: idx,
          };
        }
        break;
      }
      case "content_block_delta": {
        const idx = ev.data?.index as number;
        const delta = ev.data?.delta;
        const acc = blocks.get(idx);
        if (!acc || !delta) break;
        if (delta.type === "text_delta" && acc.kind === "text") {
          acc.text += delta.text ?? "";
          yield {
            kind: "assistant_text_delta",
            index: idx,
            text: delta.text ?? "",
          };
        } else if (
          delta.type === "input_json_delta" &&
          acc.kind === "tool_use"
        ) {
          acc.partialJson += delta.partial_json ?? "";
        }
        break;
      }
      case "content_block_stop": {
        const idx = ev.data?.index as number;
        const acc = blocks.get(idx);
        if (acc?.kind === "tool_use") {
          let parsedInput: Record<string, unknown> = {};
          try {
            parsedInput = acc.partialJson ? JSON.parse(acc.partialJson) : {};
          } catch {
            parsedInput = {
              _parse_error: true,
              _raw_json: acc.partialJson.slice(0, 500),
            };
          }
          yield {
            kind: "tool_use_input_complete",
            toolUseId: acc.id,
            input: parsedInput,
          };
        }
        break;
      }
      case "message_delta": {
        if (ev.data?.delta?.stop_reason) {
          stopReason = ev.data.delta.stop_reason;
        }
        break;
      }
      // message_start, message_stop, ping, error events — ignored
      default:
        break;
    }
  }

  // Reconstruct content blocks in their original index order.
  const content: ContentBlock[] = [];
  const indices = [...blocks.keys()].sort((a, b) => a - b);
  for (const idx of indices) {
    const acc = blocks.get(idx);
    if (!acc) continue;
    if (acc.kind === "text") {
      content.push({ type: "text", text: acc.text });
    } else {
      let parsedInput: Record<string, unknown> = {};
      try {
        parsedInput = acc.partialJson ? JSON.parse(acc.partialJson) : {};
      } catch {
        parsedInput = {};
      }
      content.push({
        type: "tool_use",
        id: acc.id,
        name: acc.name,
        input: parsedInput,
      });
    }
  }

  return { content, stopReason };
}

/**
 * Stream a fresh user turn end-to-end: model token stream → server-side
 * tool execution (parallel for safe tools) → next model stream → ... →
 * complete or pending_approval. Each event is yielded immediately so
 * the client renders progressively.
 *
 * The HITL gate is identical to the batch path's `runLoop`: deletes
 * suspend the iteration with `partialToolResults` + `queuedDeletes` so
 * the client's resume call can reconstruct a complete tool_result
 * message. Resume itself stays on the batch path
 * (`resumeAgentTurnAction`) — admin approvals are short and rare, no
 * streaming win there.
 */
export async function* streamAgentTurn(
  input: RunAgentTurnInput
): AsyncGenerator<StreamEvent, void, unknown> {
  let creds: Awaited<ReturnType<typeof resolveAnthropicCredentials>>;
  try {
    creds = await resolveAnthropicCredentials();
  } catch (err) {
    yield {
      kind: "error",
      error: err instanceof Error ? err.message : String(err),
    };
    return;
  }

  const tools = buildToolSpecs();
  const systemPrompt = buildSystemPrompt(input.observation);
  const messages: Message[] = [
    ...(input.priorMessages ?? []),
    { role: "user", content: input.userMessage },
  ];

  const startedAt = Date.now();
  yield* streamIterationLoop(
    creds,
    tools,
    messages,
    creds.model,
    systemPrompt,
    startedAt
  );
}

/**
 * Shared streaming iteration loop. Both `streamAgentTurn` (fresh user
 * turn) and `streamAgentResume` (post-approval continuation) call into
 * this — they differ only in pre-loop setup. Pulled out so the resume
 * path doesn't have to clone the entire iteration body.
 *
 * `messages` must already include any pre-loop tool_result message the
 * caller computed (resume seeds it; fresh turn doesn't need to).
 * `model` + `systemPrompt` are passed explicitly so resume can reuse
 * what the original turn ran with — switching mid-conversation would
 * break the model's continuity.
 */
async function* streamIterationLoop(
  creds: Awaited<ReturnType<typeof resolveAnthropicCredentials>>,
  tools: AnthropicToolSpec[],
  messages: Message[],
  model: string,
  systemPrompt: string,
  startedAt: number
): AsyncGenerator<StreamEvent, void, unknown> {
  for (let iter = 0; iter < MAX_ITERATIONS; iter += 1) {
    if (Date.now() - startedAt > TOTAL_TURN_TIMEOUT_MS) {
      yield {
        kind: "error",
        error: `Agent turn exceeded ${TOTAL_TURN_TIMEOUT_MS / 1000}s ceiling.`,
      };
      return;
    }

    yield { kind: "iteration_start", iter };

    let iterationResult: { content: ContentBlock[]; stopReason: string };
    try {
      iterationResult = yield* streamOneIteration(
        creds,
        tools,
        messages,
        model,
        systemPrompt
      );
    } catch (err) {
      yield {
        kind: "error",
        error: err instanceof Error ? err.message : String(err),
      };
      return;
    }

    const { content, stopReason } = iterationResult;
    messages.push({ role: "assistant", content });

    const toolUses = content.filter(
      (b): b is ToolUseBlock => b.type === "tool_use"
    );
    if (toolUses.length === 0) {
      const finalText = content
        .filter((b): b is TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      yield {
        kind: "complete",
        finalText,
        iterations: iter + 1,
        stopReason,
      };
      return;
    }

    // Partition + parallel execute — same logic as runLoop.
    const safeBlocks: ToolUseBlock[] = [];
    const deleteBlocks: ToolUseBlock[] = [];
    for (const b of toolUses) {
      const tool = getTool(b.name);
      if (tool && tool.category === "delete") deleteBlocks.push(b);
      else safeBlocks.push(b);
    }

    const toolResults: ToolResultBlock[] = [];
    if (safeBlocks.length > 0) {
      // Surface "executing" placeholders for every safe tool the moment
      // we kick them off — UI flips proposal cards from "ready" to
      // "running" while the parallel awaits work in the background.
      for (const b of safeBlocks) {
        yield { kind: "tool_executing", toolUseId: b.id, toolName: b.name };
      }
      const execs = await Promise.all(
        safeBlocks.map((b) => executeToolUse(b, false))
      );
      for (let i = 0; i < safeBlocks.length; i += 1) {
        const b = safeBlocks[i];
        const exec = execs[i];
        yield {
          kind: "tool_result",
          toolUseId: b.id,
          toolName: exec.toolName,
          ok: exec.ok,
          summary: exec.summary,
          data: exec.data,
        };
        toolResults.push({
          type: "tool_result",
          tool_use_id: b.id,
          content: stringifyToolResultForModel(exec),
          ...(exec.ok ? {} : { is_error: true }),
        });
      }
    }

    if (deleteBlocks.length > 0) {
      const [first, ...rest] = deleteBlocks;
      yield {
        kind: "pending_approval",
        toolName: first.name,
        toolUseId: first.id,
        input: first.input,
        state: {
          messages,
          model,
          systemPrompt,
          pendingToolUseId: first.id,
          pendingToolName: first.name,
          pendingToolInput: first.input,
          partialToolResults: toolResults,
          queuedDeletes: rest.map((b) => ({
            id: b.id,
            name: b.name,
            input: b.input,
          })),
        },
      };
      return;
    }

    messages.push({ role: "user", content: toolResults });
  }

  yield {
    kind: "error",
    error: `Agent did not finish within ${MAX_ITERATIONS} tool iterations.`,
  };
}

/**
 * Streaming counterpart of `resumeAgentTurn`. After admin approves or
 * rejects a pending delete, this generator:
 *   1. Executes (or rejects) the pending tool, yielding a tool_result.
 *   2. If more deletes are queued in the same iteration, suspends with
 *      pending_approval for the next one (mirrors the batch path).
 *   3. Otherwise feeds the cumulative tool_results forward and enters
 *      `streamIterationLoop`, where any follow-up assistant text streams
 *      live just like in a fresh turn.
 *
 * Same model + systemPrompt as the suspended turn — switching either
 * mid-conversation would desync the model's continuity. The runtime is
 * stateless across requests; the client holds `AgentTurnState` and
 * passes it back verbatim.
 */
export async function* streamAgentResume(
  input: ResumeAgentTurnInput
): AsyncGenerator<StreamEvent, void, unknown> {
  let creds: Awaited<ReturnType<typeof resolveAnthropicCredentials>>;
  try {
    creds = await resolveAnthropicCredentials();
  } catch (err) {
    yield {
      kind: "error",
      error: err instanceof Error ? err.message : String(err),
    };
    return;
  }

  const tools = buildToolSpecs();
  const messages: Message[] = [...input.state.messages];

  // Build the tool_result block for the pending tool — execute on
  // approve, synthesize a rejection on reject. Mirrors
  // `resumeAgentTurn` exactly (the batch path) so behavior stays in
  // lockstep.
  const pendingToolUseBlock: ToolUseBlock = {
    type: "tool_use",
    id: input.state.pendingToolUseId,
    name: input.state.pendingToolName,
    input: input.state.pendingToolInput as Record<string, unknown>,
  };

  let pendingResultBlock: ToolResultBlock;
  if (input.approved) {
    yield {
      kind: "tool_executing",
      toolUseId: input.state.pendingToolUseId,
      toolName: input.state.pendingToolName,
    };
    const exec = await executeToolUse(pendingToolUseBlock, true);
    yield {
      kind: "tool_result",
      toolUseId: input.state.pendingToolUseId,
      toolName: exec.toolName,
      ok: exec.ok,
      summary: exec.summary,
      data: exec.data,
    };
    pendingResultBlock = {
      type: "tool_result",
      tool_use_id: input.state.pendingToolUseId,
      content: stringifyToolResultForModel(exec),
      ...(exec.ok ? {} : { is_error: true }),
    };
  } else {
    const reason = input.rejectionReason ?? "Admin rejected this action.";
    yield {
      kind: "tool_result",
      toolUseId: input.state.pendingToolUseId,
      toolName: input.state.pendingToolName,
      ok: false,
      summary: `Rejected by admin: ${reason}`,
    };
    pendingResultBlock = {
      type: "tool_result",
      tool_use_id: input.state.pendingToolUseId,
      content: `Action rejected by admin. Reason: ${reason}. Do NOT retry the same delete; pivot or explain.`,
      is_error: true,
    };
  }

  const cumulativeResults: ToolResultBlock[] = [
    ...(input.state.partialToolResults ?? []),
    pendingResultBlock,
  ];

  // Multiple deletes queued in the same iteration? Suspend on the next
  // and let another approval round come in. Carries forward the full
  // tool_result set so the eventual user message stays well-formed.
  const queuedDeletes = input.state.queuedDeletes ?? [];
  if (queuedDeletes.length > 0) {
    const [next, ...remaining] = queuedDeletes;
    yield {
      kind: "pending_approval",
      toolName: next.name,
      toolUseId: next.id,
      input: next.input,
      state: {
        messages,
        model: input.state.model,
        systemPrompt: input.state.systemPrompt,
        pendingToolUseId: next.id,
        pendingToolName: next.name,
        pendingToolInput: next.input,
        partialToolResults: cumulativeResults,
        queuedDeletes: remaining,
      },
    };
    return;
  }

  // All deletes resolved for this iteration — push the complete
  // tool_result user message and continue with live streaming for any
  // follow-up assistant text.
  messages.push({ role: "user", content: cumulativeResults });

  const startedAt = Date.now();
  yield* streamIterationLoop(
    creds,
    tools,
    messages,
    input.state.model,
    input.state.systemPrompt,
    startedAt
  );
}
