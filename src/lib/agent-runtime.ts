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
}

// ── Tool catalog publishing ─────────────────────────────────────────────

interface AnthropicToolSpec {
  name: string;
  description: string;
  input_schema: ReturnType<typeof zodToJsonSchema>;
}

/**
 * Convert AGENT_TOOLS into Anthropic-format tool specs. Every tool is
 * exposed — including `delete` tools — but the loop intercepts delete
 * tool_use blocks and suspends for HITL approval before executing.
 *
 * The category is encoded into the description so the model's prompt can
 * still reason about which tools auto-run vs which ones need approval.
 */
function buildToolSpecs(): AnthropicToolSpec[] {
  return AGENT_TOOLS.map((t) => ({
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
 * Run the full server-side agent loop: tool-call → execute → loop, until
 * the model is done (no more tool_use) or hits a delete that needs admin
 * approval.
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

  const tools = buildToolSpecs();
  const systemPrompt = buildSystemPrompt(input.observation);

  // Seed messages: prior conversation if continuing, plus the new user turn.
  const messages: Message[] = [
    ...(input.priorMessages ?? []),
    { role: "user", content: input.userMessage },
  ];

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
        model: creds.model,
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
    // tool_use blocks (Anthropic requires this for tool_result correlation).
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

    // Execute each tool_use sequentially. Delete tools suspend the loop
    // for HITL approval — we return the partial events + state so the
    // client can render and the admin can approve.
    const toolResults: ToolResultBlock[] = [];
    for (const block of toolUses) {
      const tool = getTool(block.name);
      if (tool && tool.category === "delete") {
        // Suspend — don't execute, return state for the client.
        events.push({
          kind: "tool_use",
          toolName: block.name,
          input: block.input,
          toolUseId: block.id,
        });
        return {
          kind: "pending_approval",
          events,
          pending: {
            toolName: block.name,
            toolUseId: block.id,
            input: block.input,
          },
          state: {
            messages,
            model: creds.model,
            systemPrompt,
            pendingToolUseId: block.id,
            pendingToolName: block.name,
            pendingToolInput: block.input,
          },
        };
      }

      events.push({
        kind: "tool_use",
        toolName: block.name,
        input: block.input,
        toolUseId: block.id,
      });

      const exec = await executeToolUse(block, false);
      events.push({
        kind: "tool_result",
        toolUseId: block.id,
        toolName: exec.toolName,
        ok: exec.ok,
        summary: exec.summary,
        data: exec.data,
      });

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: stringifyToolResultForModel(exec),
        ...(exec.ok ? {} : { is_error: true }),
      });
    }

    // Feed tool results back into the conversation as the next user turn.
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

  // Build the tool_result for the pending tool_use.
  const pendingToolUseBlock: ToolUseBlock = {
    type: "tool_use",
    id: input.state.pendingToolUseId,
    name: input.state.pendingToolName,
    input: input.state.pendingToolInput as Record<string, unknown>,
  };

  let resultBlock: ToolResultBlock;
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
    resultBlock = {
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
    resultBlock = {
      type: "tool_result",
      tool_use_id: input.state.pendingToolUseId,
      content: `Action rejected by admin. Reason: ${reason}. Do NOT retry the same delete; pivot or explain.`,
      is_error: true,
    };
  }

  messages.push({ role: "user", content: [resultBlock] });

  // Continue the loop with the same system prompt + tool catalog.
  for (let iter = 0; iter < MAX_ITERATIONS; iter += 1) {
    if (Date.now() - startedAt > TOTAL_TURN_TIMEOUT_MS) {
      return {
        kind: "error",
        events,
        error: `Resume exceeded ${TOTAL_TURN_TIMEOUT_MS / 1000}s ceiling.`,
      };
    }

    let response: AnthropicCallOutput;
    try {
      response = await callAnthropicWithTools({
        apiKey: creds.apiKey,
        baseUrl: creds.baseUrl,
        model: input.state.model,
        systemPrompt: input.state.systemPrompt,
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

    messages.push({ role: "assistant", content: response.content });

    for (const block of response.content) {
      if (block.type === "text" && block.text) {
        events.push({ kind: "assistant_text", content: block.text });
      }
    }

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

    const toolResults: ToolResultBlock[] = [];
    for (const block of toolUses) {
      const tool = getTool(block.name);
      if (tool && tool.category === "delete") {
        events.push({
          kind: "tool_use",
          toolName: block.name,
          input: block.input,
          toolUseId: block.id,
        });
        return {
          kind: "pending_approval",
          events,
          pending: {
            toolName: block.name,
            toolUseId: block.id,
            input: block.input,
          },
          state: {
            messages,
            model: input.state.model,
            systemPrompt: input.state.systemPrompt,
            pendingToolUseId: block.id,
            pendingToolName: block.name,
            pendingToolInput: block.input,
          },
        };
      }

      events.push({
        kind: "tool_use",
        toolName: block.name,
        input: block.input,
        toolUseId: block.id,
      });

      const exec = await executeToolUse(block, false);
      events.push({
        kind: "tool_result",
        toolUseId: block.id,
        toolName: exec.toolName,
        ok: exec.ok,
        summary: exec.summary,
        data: exec.data,
      });

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: stringifyToolResultForModel(exec),
        ...(exec.ok ? {} : { is_error: true }),
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  return {
    kind: "error",
    events,
    error: `Agent did not finish within ${MAX_ITERATIONS} iterations after resume.`,
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
