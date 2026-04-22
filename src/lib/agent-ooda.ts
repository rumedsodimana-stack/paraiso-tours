/**
 * OODA loop orchestrator for the Paraiso admin agent.
 *
 *   Observe  — collect current state (workspace entity, recent messages,
 *              working memory, long-term memory)
 *   Orient   — summarize into a compact mental model for the LLM
 *   Decide   — ask the LLM to pick one of {answer, clarify, propose, act}
 *   Act      — either (a) return a clarification request, (b) stage a
 *              proposal for HITL approval, or (c) if and only if the
 *              admin has pre-armed auto-execute, run the tool directly
 *
 * The orchestrator is pure-functional — it returns a structured next-step,
 * never mutates the DB. That's what makes the loop safe and testable.
 */

export type OodaPhase = "observe" | "orient" | "decide" | "act";

export interface AgentObservation {
  /** Snapshot of the most recent user message(s) + tool outputs. */
  recentDialogue: Array<{
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    toolName?: string;
  }>;
  /** What the admin is currently looking at (booking, tour, invoice, …). */
  currentEntity?: {
    kind: string;
    id: string;
    label?: string;
  };
  /** Up to 8 recently-touched entities — lets the agent resolve "this" or
   *  "that one" without the admin repeating IDs. */
  recent?: Array<{ kind: string; id: string; label?: string }>;
  /** Facts the agent has observed during this session. */
  workingMemory?: Array<{ kind: string; text: string }>;
  /** Durable summaries from past sessions. */
  longTermMemory?: Array<{ kind: string; text: string }>;
}

export interface OrientSummary {
  /** One-sentence description of the admin's apparent goal. */
  goal: string;
  /** Known facts the agent is confident about. */
  knowns: string[];
  /** Open questions before the agent can act. */
  unknowns: string[];
  /** Entities the agent believes are in-scope. */
  entitiesInScope: Array<{ kind: string; id: string; label?: string }>;
}

export type AgentDecision =
  | {
      kind: "answer";
      response: string;
    }
  | {
      kind: "clarify";
      question: string;
      reason: string;
    }
  | {
      kind: "propose";
      title: string;
      summary: string;
      tool: string;
      input: unknown;
      confidence: number;
      entityRefs?: Array<{ kind: string; id: string; label?: string }>;
    };

// ── Observe ──────────────────────────────────────────────────────────────

/**
 * Compact the raw observation into a token-efficient context block. The
 * LLM doesn't need raw timestamps or IDs scattered everywhere — it needs
 * the signal.
 */
export function buildOrientPrompt(obs: AgentObservation): string {
  const lines: string[] = [];

  if (obs.currentEntity) {
    lines.push(
      `Admin is currently viewing ${obs.currentEntity.kind}: ${obs.currentEntity.label ?? obs.currentEntity.id} (${obs.currentEntity.id})`
    );
  }

  if (obs.recent && obs.recent.length > 0) {
    lines.push("Recently touched entities:");
    for (const r of obs.recent.slice(0, 5)) {
      lines.push(`  - ${r.kind}: ${r.label ?? r.id} (${r.id})`);
    }
  }

  if (obs.recentDialogue.length > 0) {
    lines.push("Recent messages:");
    for (const m of obs.recentDialogue.slice(-8)) {
      const tag = m.toolName ? `tool:${m.toolName}` : m.role;
      const snippet = m.content.length > 240
        ? m.content.slice(0, 240) + "…"
        : m.content;
      lines.push(`  [${tag}] ${snippet}`);
    }
  }

  if (obs.workingMemory && obs.workingMemory.length > 0) {
    lines.push("Session memory (recent facts):");
    for (const m of obs.workingMemory.slice(0, 8)) {
      lines.push(`  - [${m.kind}] ${m.text}`);
    }
  }

  if (obs.longTermMemory && obs.longTermMemory.length > 0) {
    lines.push("Long-term memory (preferences & learnings):");
    for (const m of obs.longTermMemory.slice(0, 8)) {
      lines.push(`  - [${m.kind}] ${m.text}`);
    }
  }

  return lines.join("\n");
}

// ── Decide ───────────────────────────────────────────────────────────────

/**
 * Coerce an LLM JSON response into a validated AgentDecision. Falls back
 * to a safe "clarify" if the response is unintelligible, so the agent
 * never silently no-ops.
 */
export function coerceDecision(raw: unknown): AgentDecision {
  const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);

  if (!isRecord(raw)) {
    return {
      kind: "clarify",
      question: "Could you re-phrase that? I didn't parse a clear action.",
      reason: "LLM returned a non-object.",
    };
  }

  const kind = String(raw.kind ?? "").trim();

  if (kind === "answer" && typeof raw.response === "string") {
    return { kind: "answer", response: raw.response };
  }

  if (kind === "clarify" && typeof raw.question === "string") {
    return {
      kind: "clarify",
      question: raw.question,
      reason: String(raw.reason ?? "Ambiguous request"),
    };
  }

  if (
    kind === "propose" &&
    typeof raw.tool === "string" &&
    raw.input !== undefined
  ) {
    const confidence = typeof raw.confidence === "number"
      ? Math.max(0, Math.min(1, raw.confidence))
      : 0.6;
    return {
      kind: "propose",
      title: String(raw.title ?? "Proposed action"),
      summary: String(raw.summary ?? ""),
      tool: raw.tool,
      input: raw.input,
      confidence,
      entityRefs: Array.isArray(raw.entityRefs)
        ? raw.entityRefs.filter(isRecord).map((r) => ({
            kind: String(r.kind ?? ""),
            id: String(r.id ?? ""),
            label: r.label ? String(r.label) : undefined,
          })).filter((r) => r.kind && r.id)
        : undefined,
    };
  }

  return {
    kind: "clarify",
    question:
      typeof raw.question === "string"
        ? raw.question
        : "Could you tell me a bit more about what you want to do next?",
    reason: "Decision payload did not match any known schema.",
  };
}

// ── System prompt for the OODA agent ─────────────────────────────────────

export const OODA_SYSTEM_PROMPT = [
  "You are the Paraiso travel-agency admin AI agent.",
  "You work under a strict human-in-the-loop policy: you NEVER execute",
  "actions directly. Instead you emit one of four decisions:",
  "",
  "  1. answer   — plain informational response, no state change.",
  "  2. clarify  — you need more info; emit a question (the system will",
  "                generate 4 suggested answers + a free-text field).",
  "  3. propose  — you want to take an action; emit title/summary/tool/input",
  "                and wait for the admin to approve before any mutation.",
  "",
  "Return valid JSON only, matching this schema:",
  "{",
  '  "kind": "answer" | "clarify" | "propose",',
  '  "response": "for answer only",',
  '  "question": "for clarify only",',
  '  "reason": "for clarify only",',
  '  "title": "for propose only",',
  '  "summary": "for propose only",',
  '  "tool": "for propose only — the server-side tool name",',
  '  "input": "for propose only — JSON payload the tool expects",',
  '  "confidence": 0.0..1.0,',
  '  "entityRefs": [{"kind":"...","id":"...","label":"..."}]',
  "}",
  "",
  "Rules:",
  "- Prefer `propose` when the intent is clear and actionable.",
  "- Prefer `clarify` when even one small ambiguity could cause a wrong",
  "  mutation. Cost of a re-ask is low; cost of a wrong write is high.",
  "- Set confidence honestly — admins use it to gauge risk.",
  "- Never invent entity IDs. Use the IDs from context or pick `clarify`.",
  "- Never promise the action has been executed. You only propose.",
].join("\n");
