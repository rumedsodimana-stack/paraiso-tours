"use server";

import { requireAdmin } from "@/lib/admin-session";
import { generateAiJsonResult } from "@/lib/ai";
import {
  CLARIFIER_SYSTEM_PROMPT,
  coerceClarification,
  type ClarificationShape,
} from "@/lib/agent-clarification";
import {
  OODA_SYSTEM_PROMPT,
  buildOrientPrompt,
  coerceDecision,
  type AgentDecision,
  type AgentObservation,
} from "@/lib/agent-ooda";
import { recordAuditEvent } from "@/lib/audit";

export interface ClarificationInput {
  /** What the admin asked the agent, verbatim. */
  request: string;
  /** Optional extra context the agent already knows — entity refs, active
   *  view, recent observations. Anything useful for orienting suggestions. */
  context?: string;
  /** Optional default question if the AI goes off-script. */
  fallbackQuestion?: string;
}

export interface ClarificationResult {
  ok: boolean;
  clarification?: ClarificationShape;
  error?: string;
}

/**
 * Ask the AI to turn an ambiguous request into a clarifying question plus
 * 4 best-fit suggestions. Server-gated — only admins can invoke.
 */
export async function requestAgentClarificationAction(
  input: ClarificationInput
): Promise<ClarificationResult> {
  await requireAdmin();

  const request = input.request?.trim() ?? "";
  if (!request) {
    return { ok: false, error: "Empty request — nothing to clarify." };
  }

  const fallbackQuestion =
    input.fallbackQuestion?.trim() ||
    "Which path would you like me to take?";

  try {
    const { data } = await generateAiJsonResult<unknown>({
      feature: "agent_clarifier",
      title: "Agent clarification",
      systemPrompt: CLARIFIER_SYSTEM_PROMPT,
      userPrompt: [
        "The admin request below needs clarification before the agent can act.",
        "",
        `Admin request: ${request}`,
        "",
        input.context
          ? `Context the agent already has:\n${input.context}`
          : "No additional context was captured.",
      ].join("\n"),
      usePromptCache: true,
    });

    const clarification = coerceClarification(data, fallbackQuestion);

    await recordAuditEvent({
      entityType: "system",
      entityId: "agent",
      action: "clarification_requested",
      summary: `Agent asked for clarification on: ${request.slice(0, 80)}${request.length > 80 ? "…" : ""}`,
      details: [
        `Question: ${clarification.question}`,
        `Suggestions: ${clarification.suggestions.map((s) => s.label).join(" | ")}`,
      ],
      metadata: {
        channel: "agent_ui",
        feature: "agent_clarifier",
      },
    });

    return { ok: true, clarification };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ── OODA decide action ──────────────────────────────────────────────────

export interface DecideInput {
  /** The admin's latest message. */
  request: string;
  /** The current observation (workspace context + dialogue + memory). */
  observation: AgentObservation;
}

export interface DecideResult {
  ok: boolean;
  decision?: AgentDecision;
  /** If decision.kind is "clarify", we also include a fully-formed
   *  ClarificationShape so the UI can render 4 suggestions + custom input
   *  without a second round-trip. */
  clarification?: ClarificationShape;
  error?: string;
}

/**
 * The agent's single "decide" step in the OODA loop. Takes the observation
 * + admin request, returns a typed decision. When the decision is
 * "clarify", we immediately ask the clarifier to generate the 4
 * suggestions so the UI has everything in one shot.
 */
export async function decideAgentAction(
  input: DecideInput
): Promise<DecideResult> {
  await requireAdmin();

  const request = input.request?.trim() ?? "";
  if (!request) {
    return { ok: false, error: "Empty request." };
  }

  const contextBlock = buildOrientPrompt(input.observation);

  try {
    const { data } = await generateAiJsonResult<unknown>({
      feature: "agent_decide",
      title: "Agent decide",
      systemPrompt: OODA_SYSTEM_PROMPT,
      userPrompt: [
        `Admin request: ${request}`,
        "",
        "Current observation:",
        contextBlock || "(no additional context)",
      ].join("\n"),
      usePromptCache: true,
    });

    const decision = coerceDecision(data);

    await recordAuditEvent({
      entityType: "system",
      entityId: "agent",
      action: `decide_${decision.kind}`,
      summary: `Agent decided: ${decision.kind}`,
      details: [
        `Request: ${request.slice(0, 120)}${request.length > 120 ? "…" : ""}`,
        decision.kind === "propose"
          ? `Tool: ${decision.tool} (confidence ${Math.round(decision.confidence * 100)}%)`
          : decision.kind === "clarify"
            ? `Question: ${decision.question}`
            : `Response length: ${decision.response.length}`,
      ],
      metadata: {
        channel: "agent_ui",
        feature: "agent_decide",
        kind: decision.kind,
      },
    });

    // If the agent wants to clarify, ride through to the clarifier in one
    // shot so the UI has 4 suggestions + custom input ready.
    if (decision.kind === "clarify") {
      const clarResult = await requestAgentClarificationAction({
        request,
        context: [
          `Orientation: ${decision.reason}`,
          contextBlock,
        ]
          .filter(Boolean)
          .join("\n\n"),
        fallbackQuestion: decision.question,
      });
      if (clarResult.ok) {
        return {
          ok: true,
          decision,
          clarification: clarResult.clarification,
        };
      }
    }

    return { ok: true, decision };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
