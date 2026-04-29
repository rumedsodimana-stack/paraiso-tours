"use server";

/**
 * Server actions for the native-tool-calling agent runtime.
 *
 * These are the entry points the client calls when the configured AI
 * provider is Anthropic. The legacy JSON-mode path (`decideAgentAction`
 * in `./agent.ts`) stays in place for non-Anthropic providers.
 *
 * Two actions:
 *   - `runAgentTurnAction`    — start a new turn from a fresh user message
 *   - `resumeAgentTurnAction` — continue a turn after an admin approves or
 *                               rejects a pending delete
 *
 * Both wrap `requireAdmin()` and surface a single typed result. All
 * failure modes are caught — the client never sees an unhandled throw.
 */

import { requireAdmin } from "@/lib/admin-session";
import { recordAuditEvent } from "@/lib/audit";
import { extractErrorMessage } from "@/lib/db";
import {
  runAgentTurn,
  resumeAgentTurn,
  type AgentEvent,
  type AgentTurnState,
} from "@/lib/agent-runtime";
import type { AgentObservation } from "@/lib/agent-ooda";

export interface RunAgentTurnActionInput {
  /** The admin's latest message. */
  request: string;
  /** Workspace observation — current entity, recent dialogue, memory. */
  observation: AgentObservation;
}

export interface AgentTurnActionResponse {
  ok: boolean;
  events?: AgentEvent[];
  finalText?: string;
  iterations?: number;
  pendingApproval?: {
    toolName: string;
    toolUseId: string;
    input: unknown;
    state: AgentTurnState;
  };
  error?: string;
}

/**
 * Start a new agent turn. Runs the full server-side iterative loop until
 * the model emits a turn with no tool_use blocks (it's done) OR a delete
 * tool comes up that needs admin approval. The client renders the
 * returned `events` as a sequence of bubbles and pills.
 */
export async function runAgentTurnAction(
  input: RunAgentTurnActionInput
): Promise<AgentTurnActionResponse> {
  await requireAdmin();

  const request = input.request?.trim() ?? "";
  if (!request) {
    return { ok: false, error: "Empty request — nothing to do." };
  }

  try {
    const outcome = await runAgentTurn({
      userMessage: request,
      observation: input.observation,
    });

    await recordAuditEvent({
      entityType: "system",
      entityId: "agent",
      action:
        outcome.kind === "complete"
          ? "agent_native_turn_complete"
          : outcome.kind === "pending_approval"
            ? "agent_native_turn_pending"
            : "agent_native_turn_error",
      summary: `Agent (native) turn — ${outcome.kind}`,
      details: [
        `Request: ${request.slice(0, 200)}${request.length > 200 ? "…" : ""}`,
        outcome.kind === "complete"
          ? `Iterations: ${outcome.iterations} · Stop: ${outcome.stopReason ?? "?"} · Events: ${outcome.events.length}`
          : outcome.kind === "pending_approval"
            ? `Pending tool: ${outcome.pending.toolName} · Events so far: ${outcome.events.length}`
            : `Error: ${outcome.error}`,
      ],
      metadata: {
        channel: "agent_ui",
        feature: "agent_native",
        kind: outcome.kind,
      },
    });

    if (outcome.kind === "complete") {
      return {
        ok: true,
        events: outcome.events,
        finalText: outcome.finalText,
        iterations: outcome.iterations,
      };
    }
    if (outcome.kind === "pending_approval") {
      return {
        ok: true,
        events: outcome.events,
        pendingApproval: {
          toolName: outcome.pending.toolName,
          toolUseId: outcome.pending.toolUseId,
          input: outcome.pending.input,
          state: outcome.state,
        },
      };
    }
    return { ok: false, events: outcome.events, error: outcome.error };
  } catch (err) {
    const msg = extractErrorMessage(err);
    return { ok: false, error: msg };
  }
}

export interface ResumeAgentTurnActionInput {
  /** The opaque conversation state returned by an earlier
   *  `runAgentTurnAction` call with `pendingApproval`. */
  state: AgentTurnState;
  /** True when the admin clicked Approve; false on Reject. */
  approved: boolean;
  /** Optional reason text from the admin's reject UI. */
  rejectionReason?: string;
}

/**
 * Resume a turn after the admin approves or rejects a pending delete. The
 * client passes the saved `state` back verbatim — the runtime is stateless
 * across requests, so this works even after a long approval delay or a
 * cold-start in serverless.
 */
export async function resumeAgentTurnAction(
  input: ResumeAgentTurnActionInput
): Promise<AgentTurnActionResponse> {
  await requireAdmin();

  if (!input.state || !input.state.pendingToolUseId) {
    return { ok: false, error: "Missing or invalid agent-turn state." };
  }

  try {
    const outcome = await resumeAgentTurn({
      state: input.state,
      approved: input.approved,
      rejectionReason: input.rejectionReason,
    });

    await recordAuditEvent({
      entityType: "system",
      entityId: "agent",
      action: input.approved
        ? "agent_native_resume_approved"
        : "agent_native_resume_rejected",
      summary: input.approved
        ? `Agent (native) resume — admin approved ${input.state.pendingToolName}`
        : `Agent (native) resume — admin rejected ${input.state.pendingToolName}`,
      details: [
        outcome.kind === "complete"
          ? `Iterations after resume: ${outcome.iterations} · Events: ${outcome.events.length}`
          : outcome.kind === "pending_approval"
            ? `Another delete pending: ${outcome.pending.toolName}`
            : `Error: ${outcome.error}`,
      ],
      metadata: {
        channel: "agent_ui",
        feature: "agent_native",
        tool: input.state.pendingToolName,
        approved: input.approved,
      },
    });

    if (outcome.kind === "complete") {
      return {
        ok: true,
        events: outcome.events,
        finalText: outcome.finalText,
        iterations: outcome.iterations,
      };
    }
    if (outcome.kind === "pending_approval") {
      return {
        ok: true,
        events: outcome.events,
        pendingApproval: {
          toolName: outcome.pending.toolName,
          toolUseId: outcome.pending.toolUseId,
          input: outcome.pending.input,
          state: outcome.state,
        },
      };
    }
    return { ok: false, events: outcome.events, error: outcome.error };
  } catch (err) {
    const msg = extractErrorMessage(err);
    return { ok: false, error: msg };
  }
}

/**
 * Lightweight runtime probe so the client can decide which path to take
 * without doing its own settings round-trip. Returns true when the
 * configured provider is Anthropic AND the runtime is enabled+configured.
 */
export async function isNativeAgentRuntimeAvailableAction(): Promise<{
  ok: boolean;
  available: boolean;
  reason?: string;
}> {
  try {
    await requireAdmin();
    const { getAiRuntimeStatus } = await import("@/lib/ai");
    const runtime = await getAiRuntimeStatus();
    if (runtime.providerKind !== "anthropic") {
      return {
        ok: true,
        available: false,
        reason: `Configured provider is ${runtime.providerLabel}; native tool-calling requires Anthropic.`,
      };
    }
    if (!runtime.enabled || !runtime.configured) {
      return { ok: true, available: false, reason: runtime.missingReason };
    }
    return { ok: true, available: true };
  } catch (err) {
    return {
      ok: false,
      available: false,
      reason: extractErrorMessage(err),
    };
  }
}
