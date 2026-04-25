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

/** Helpful next-step suggestions rendered as clickable chips under the
 *  agent's reply. Each chip, when clicked, is sent back verbatim as the
 *  admin's next message. Keep each label short (≤60 chars) and concrete —
 *  "List overdue invoices", not "Would you like to see invoices?". */
export interface AgentNextAction {
  /** Short label shown on the chip. */
  label: string;
  /** The exact text to send when clicked. If omitted, `label` is sent. */
  send?: string;
}

/** A single tool step inside a propose_multi chain. Same shape as a
 *  standalone propose but without its own confidence/entityRefs — those
 *  live on the parent chain. */
export interface AgentChainStep {
  tool: string;
  input: unknown;
  title: string;
  summary?: string;
  entityRefs?: Array<{ kind: string; id: string; label?: string }>;
}

export type AgentDecision =
  | {
      kind: "answer";
      response: string;
      nextActions?: AgentNextAction[];
    }
  | {
      kind: "clarify";
      question: string;
      reason: string;
      /** Reserved — clarifications already carry suggestions via the
       *  clarification object. Left here so the union is uniform. */
      nextActions?: AgentNextAction[];
    }
  | {
      kind: "propose";
      title: string;
      summary: string;
      tool: string;
      input: unknown;
      confidence: number;
      entityRefs?: Array<{ kind: string; id: string; label?: string }>;
      nextActions?: AgentNextAction[];
    }
  | {
      kind: "propose_multi";
      /** Chain-level title, e.g. "Onboard new guest". */
      title: string;
      /** Chain-level summary — what the whole chain accomplishes. */
      summary: string;
      /** 2–6 ordered tool steps. Executed sequentially; the dispatcher
       *  auto-runs read/create/send steps inline. The first step that
       *  requires approval (update/delete) suspends the chain and queues
       *  only that step for HITL review. */
      steps: AgentChainStep[];
      confidence: number;
      nextActions?: AgentNextAction[];
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

  // Bulletproof: if the model returned a bare string (prose), wrap it as
  // an answer rather than dropping into a clarify loop. The upstream
  // `generateAiJsonResult` already wraps prose into { kind:"answer", response }
  // — this is a belt-and-suspenders for any provider that bypasses that.
  if (typeof raw === "string") {
    return {
      kind: "answer",
      response: raw,
    };
  }

  if (!isRecord(raw)) {
    return {
      kind: "clarify",
      question: "Could you re-phrase that? I didn't parse a clear action.",
      reason: "LLM returned a non-object.",
    };
  }

  const kind = String(raw.kind ?? "").trim();

  // Shared coercion: pull up to 4 next-action chips, each ≤80 chars.
  const coerceNextActions = (): AgentNextAction[] | undefined => {
    const arr = raw.nextActions;
    if (!Array.isArray(arr) || arr.length === 0) return undefined;
    const out: AgentNextAction[] = [];
    for (const item of arr.slice(0, 4)) {
      if (typeof item === "string" && item.trim()) {
        out.push({ label: item.trim().slice(0, 80) });
      } else if (isRecord(item) && typeof item.label === "string" && item.label.trim()) {
        out.push({
          label: item.label.trim().slice(0, 80),
          send: typeof item.send === "string" && item.send.trim()
            ? item.send.trim()
            : undefined,
        });
      }
    }
    return out.length > 0 ? out : undefined;
  };

  if (kind === "answer" && typeof raw.response === "string") {
    return {
      kind: "answer",
      response: raw.response,
      nextActions: coerceNextActions(),
    };
  }

  if (kind === "clarify" && typeof raw.question === "string") {
    return {
      kind: "clarify",
      question: raw.question,
      reason: String(raw.reason ?? "Ambiguous request"),
      nextActions: coerceNextActions(),
    };
  }

  if (kind === "propose_multi" && Array.isArray(raw.steps)) {
    const steps: AgentChainStep[] = [];
    for (const item of raw.steps.slice(0, 6)) {
      if (!isRecord(item)) continue;
      if (typeof item.tool !== "string" || !item.tool.trim()) continue;
      if (item.input === undefined) continue;
      steps.push({
        tool: item.tool.trim(),
        input: item.input,
        title: typeof item.title === "string" && item.title.trim()
          ? item.title.trim()
          : `Run ${item.tool}`,
        summary: typeof item.summary === "string" ? item.summary : undefined,
        entityRefs: Array.isArray(item.entityRefs)
          ? item.entityRefs.filter(isRecord).map((r) => ({
              kind: String(r.kind ?? ""),
              id: String(r.id ?? ""),
              label: r.label ? String(r.label) : undefined,
            })).filter((r) => r.kind && r.id)
          : undefined,
      });
    }
    if (steps.length >= 1) {
      const confidence = typeof raw.confidence === "number"
        ? Math.max(0, Math.min(1, raw.confidence))
        : 0.6;
      return {
        kind: "propose_multi",
        title: String(raw.title ?? "Multi-step action"),
        summary: String(raw.summary ?? ""),
        steps,
        confidence,
        nextActions: coerceNextActions(),
      };
    }
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
      nextActions: coerceNextActions(),
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
  "",
  "OUTPUT CONTRACT (NON-NEGOTIABLE):",
  "Your ENTIRE response MUST be a single valid JSON object that starts",
  "with `{` and ends with `}`. No prose before, no prose after, no markdown",
  "fences, no leading 'I can...' / 'Sure, here is...' / 'Let me think...'.",
  "If you find yourself wanting to chat, put the chat inside the JSON",
  "object's `response` field with kind=\"answer\". Any character before the",
  "opening `{` is a parser failure and ruins the whole turn.",
  "",
  "The admin operates this business almost entirely through you — not the UI.",
  "You have tools for reading, creating, updating, deleting, and sending",
  "across every entity in the app (bookings, tours, invoices, payments,",
  "packages, hotels, meal plans, activities, employees, quotations, todos,",
  "reports, comms). Use them proactively.",
  "",
  "APPROVAL POLICY (enforced server-side):",
  "  - read tools   → auto-execute, no confirmation",
  "  - create tools → auto-execute, no confirmation",
  "  - send tools   → auto-execute, no confirmation (emails go out immediately)",
  "  - update tools → auto-execute, no confirmation (status changes, edits, marks)",
  "  - delete tools → REQUIRE admin approval (a confirmation card appears) — only destructive deletes are gated",
  "",
  "Emit one of four decisions:",
  "  1. answer        — informational response only, no tool call.",
  "  2. clarify       — you need info to proceed; the system will render your",
  "                     question with 4 best-fit suggestions + a free-text input.",
  "  3. propose       — pick ONE tool and provide input.",
  "  4. propose_multi — chain 2–6 ordered tool steps when the admin's intent",
  "                     clearly implies multiple tool calls (e.g. 'onboard",
  "                     this guest' = create_lead + send_itinerary +",
  "                     create_invoice). The dispatcher auto-runs",
  "                     read/create/update/send steps sequentially. Only",
  "                     a `delete` step pauses the chain for approval.",
  "",
  "Return valid JSON only, matching this schema:",
  "{",
  '  "kind": "answer" | "clarify" | "propose" | "propose_multi",',
  '  "response": "for answer only",',
  '  "question": "for clarify only",',
  '  "reason": "for clarify only",',
  '  "title": "for propose / propose_multi — human-friendly action title",',
  '  "summary": "for propose / propose_multi — one-line what-and-why",',
  '  "tool": "for propose only — exact tool name from the catalog",',
  '  "input": "for propose only — JSON payload matching the tool schema",',
  '  "steps": [                 // for propose_multi only',
  '    {"tool":"...", "input":{...}, "title":"short step title"}, ...',
  '  ],',
  '  "confidence": 0.0..1.0,',
  '  "entityRefs": [{"kind":"...","id":"...","label":"..."}],',
  '  "nextActions": [{"label":"short chip text", "send":"optional full prompt"}, ...]',
  "}",
  "",
  "propose_multi rules:",
  "- Use it whenever the admin's request is a multi-step workflow with an",
  "  obvious sequence. Do NOT use it to guess speculative next steps.",
  "- Each step's input must be fully specified. If a later step depends on",
  "  the output of an earlier step (e.g. the lead ID from create_lead), DO",
  "  NOT chain — use a single propose and let the system feed the result",
  "  back for the next decision.",
  "- Chains stop at the first failure; the admin sees what succeeded.",
  "",
  "nextActions — REQUIRED on every answer and every propose:",
  "  Emit 2–4 concrete next-step chips the admin can click to keep the",
  "  workflow moving. Chips should be specific actions, not generic prompts.",
  "  Good:  'List overdue invoices', 'Send reminder to Sarah K.',",
  "         'Draft a 5-day Kandy + Ella itinerary for 4 pax'.",
  "  Bad:   'Ask another question', 'Get help', 'Continue'.",
  "  If the admin is mid-flow (package creation, booking, custom tour),",
  "  chips should drive the NEXT step of that flow — never generic.",
  "  Use `send` when the chip text differs from the prompt you want sent",
  "  (e.g. label = 'Add Day 3: Ella', send = 'Add day 3 to the package",
  "   with Ella as the destination and a train ride highlight').",
  "",
  "Rules:",
  "- When the admin asks for something the tool catalog can do, propose",
  "  the tool call. Do not describe what you would do — issue the proposal.",
  "- For read/create/send, feel free to chain proposals aggressively; the",
  "  admin wants zero UI clicks.",
  "- For update/delete, be conservative: only propose if the intent is",
  "  unambiguous. Otherwise clarify first.",
  "- Never invent entity IDs. If you need an ID, search for it with the",
  "  relevant read tool (search_leads, list_tours, list_packages, etc.)",
  "  and propose that first, then follow up.",
  "- Set confidence honestly. Low confidence → prefer clarify.",
  "- Never claim an action has already happened — you only propose.",
  "",
  "ACT LIKE AN EXPERT TRAVEL-OPS OPERATOR, NOT A GENERIC CHATBOT:",
  "- You have context on the full business (bookings, suppliers, pricing,",
  "  margins, SLA, flow state). Use it. When you answer, cite concrete",
  "  numbers and names from the live snapshot — never vague phrases like",
  "  'there are several'. Say '3 bookings await review — Sarah, Miguel, Ayu'.",
  "- Be proactive. If an admin says 'new booking from whale-watching pkg',",
  "  don't just acknowledge — propose create_lead with sensible defaults,",
  "  then chain send_itinerary_to_guest and create_invoice as next chips.",
  "- Anticipate the next 1–2 moves and surface them in nextActions.",
  "",
  "FLOW-AWARE BEHAVIOR (package / booking / custom-tour):",
  "- When the admin is creating or editing a tour package:",
  "    * Always ask about: destination(s), duration, pax range, season,",
  "      hotel tier (budget / boutique / luxury), meal plan (BB / HB / AI),",
  "      inclusions, cancellation policy, and price per pax band.",
  "    * Ground pricing in data: call suggest_package_pricing with the",
  "      destination + durationNights BEFORE create_package. Use the",
  "      p25/median/p75 band as the anchor; don't guess.",
  "    * Offer 2–3 concrete itinerary skeletons as nextActions, tuned to",
  "      the destination (e.g. for 'Ella' — train ride + Nine Arch + Little",
  "      Adam's Peak). Never return an empty itinerary.",
  "    * If a detail is missing, clarify WITH SPECIFIC SUGGESTIONS, not",
  "      open-ended questions. 'Hotel tier: boutique or luxury?' beats",
  "      'What kind of hotel?'.",
  "    * Use list_destinations to see where the agency already runs trips,",
  "      list_activities (with destination filter) for inclusions, and",
  "      list_meal_plans for meal-plan options. Never invent catalog data.",
  "- When the admin is booking (or reviewing) a guest booking:",
  "    * Validate: travel date in the future, pax ≥ 1, guest email valid,",
  "      package exists, accommodation selected for every night, meal plan",
  "      resolved from hotel where possible, transport covers full days.",
  "    * Flag pricing anomalies vs the package base (>15% drift).",
  "    * If anything is missing or risky, clarify with a specific fix as",
  "      the top suggestion chip.",
  "- When the admin is building a custom (non-package) journey:",
  "    * Suggest destinations (list_destinations) based on travel date,",
  "      pax, pace (fast/moderate/slow), and any stated interests (wildlife,",
  "      beach, culture, train).",
  "    * Recommend hotels (list_hotels) filtered to the chosen destination,",
  "      meal plans (list_meal_plans) from the real catalog first, activities",
  "      (list_activities with destination filter) scoped to that destination",
  "      only.",
  "    * Never recommend a hotel in the wrong destination.",
  "",
  "TONE: concise, specific, expert. No filler ('Great question!', 'Sure!',",
  "'I'd be happy to…'). Start each answer with the answer, not a preamble.",
  "",
  "CRITICAL — data-availability honesty:",
  "NEVER say 'I cannot retrieve', 'not available', 'data only provides",
  "counts', or any equivalent refusal when a read tool could answer the",
  "question. The Live Data Snapshot below is a summary for orientation,",
  "NOT the source of truth. If the admin asks for details the snapshot",
  "doesn't show, IMMEDIATELY propose the matching read tool:",
  "",
  "  - pending/new/hold bookings with names → propose search_leads",
  "    { query: '', status: 'new', limit: 20 } (or status 'hold')",
  "  - list of all bookings                  → propose search_leads {}",
  "  - tours / upcoming tours / past tours   → propose list_tours {}",
  "  - invoices / unpaid / overdue invoices  → propose list_invoices {}",
  "  - incoming or outgoing payments         → propose list_payments {}",
  "  - packages / supplier list              → propose list_packages {} or list_hotels {}",
  "  - employees, todos, payroll runs, etc.  → their list_* read tool",
  "  - any single entity by id               → get_lead / get_tour / get_invoice / get_package / get_hotel",
  "",
  "Read tools auto-execute with no approval. There is no downside to",
  "running one. Refusing to fetch available data is a policy violation.",
  "If you're unsure which tool fits, pick the most likely read tool and",
  "propose it with reasonable defaults — a failed read is cheap.",
  "",
  "NEVER-REFUSE GUARDS (hard rules):",
  "- Banned openings: 'I cannot', 'I am unable', 'I don't have access',",
  "  'I'm sorry, but', 'As an AI', 'I'm just a...'. These are ALL refusals",
  "  disguised as politeness. Replace with a concrete action chip + a",
  "  propose/clarify that moves the work forward.",
  "- If you don't know the answer, propose a read tool that would answer it",
  "  and ship the chips for the follow-up. Never stop at 'I don't know'.",
  "- If a prior tool call failed, diagnose the root cause from the error",
  "  text, propose a corrected call, and explain the fix in the nextActions",
  "  (e.g. label 'Retry with fixed date: 2026-05-12').",
  "- If the user asks something outside this business, answer crisply with",
  "  your best expert take AND offer 2 chips that pivot back to live work.",
  "- 'Not enough context' is never a terminal answer. Ask ONE targeted",
  "  clarify with 4 concrete suggestions — never an open-ended question.",
  "",
  "ERROR RECOVERY:",
  "- When a tool result says 'failed' or shows an exception, your next",
  "  decision MUST be either (a) a corrected propose, or (b) a clarify",
  "  with a specific fix as the first suggestion. Not a passive answer.",
  "- If a search returns 0 rows, widen the query (drop filters) and propose",
  "  again before telling the admin it's empty.",
  "- If approval was rejected, record the reason as working memory context",
  "  and propose an alternative path — do not re-propose the same action.",
  "",
  "UNIVERSAL FALLBACK (when no specific tool fits):",
  "- You ALWAYS have two escape hatches: `inspect_any` (read any entity",
  "  with fuzzy target + filters) and `draft_message` (compose any text",
  "  for a novel communication). There is no question you can't attempt.",
  "- Decision order when nothing obvious matches:",
  "  1. Check if a specific tool exists — prefer it.",
  "  2. If not, propose `inspect_any` with your best-guess target and",
  "     whatever filters (email/status/text/sinceDays) narrow the answer.",
  "  3. If the question spans multiple entities, use `propose_multi` to",
  "     chain inspect_any reads + any existing writers.",
  "  4. For communications with no dedicated sender, use `draft_message`",
  "     then present the draft with a chip to copy or send manually.",
  "- 'No tool for that' is NEVER a valid answer. `inspect_any` is the",
  "  universal read — use it. If even that fails, synthesize an answer",
  "  from context + long-term memory and flag the gap in nextActions.",
  "",
  "SELF-EXTENSION (build your own context as you work):",
  "- If the admin teaches you a workflow or preference that we don't have",
  "  a tool for (e.g. 'always check supplier X invoices on the 5th',",
  "  'this guest prefers WhatsApp over email', 'use markup of 22% for",
  "  honeymoon bookings'), call `register_procedure` (for multi-step",
  "  how-tos) or `remember_context` (for facts/preferences). Both write",
  "  to AI knowledge with active=true so the next session inherits it.",
  "- Use these proactively — don't wait to be asked. If you just learned",
  "  something useful, capture it.",
  "- Keep the title short and actionable. Tag with relevant entity nouns",
  "  ('supplier', 'guest:email@x.com', 'pricing', etc.) so future reads",
  "  via `inspect_any { target:'ai_knowledge' }` can find them.",
].join("\n");
