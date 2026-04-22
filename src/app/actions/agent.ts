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
import { AGENT_TOOLS, getTool, listToolsForPrompt } from "@/lib/agent-tools";
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
  const liveContext = await buildLiveDataContext();
  const toolsBlock = listToolsForPrompt();

  try {
    const { data } = await generateAiJsonResult<unknown>({
      feature: "agent_decide",
      title: "Agent decide",
      systemPrompt:
        OODA_SYSTEM_PROMPT +
        "\n\n" +
        "Available tools you can propose (use these exact names in `tool`):\n" +
        toolsBlock,
      userPrompt: [
        `Admin request: ${request}`,
        "",
        "Current observation:",
        contextBlock || "(no additional context)",
        "",
        "Live data snapshot (the business right now):",
        liveContext,
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

// ── Live data context (gives the agent eyes on the business) ─────────────

/**
 * Compact, token-budgeted snapshot of active state. The agent sees a rolled-
 * up view of recent bookings, upcoming tours, overdue invoices, catalog
 * highlights. This is what turns "dumb" answers into grounded ones.
 */
async function buildLiveDataContext(): Promise<string> {
  try {
    const [
      { getLeads, getTours, getInvoices, getPackages, getHotels, getTodos },
    ] = await Promise.all([import("@/lib/db")]);
    const [leads, tours, invoices, packages, hotels, todos] = await Promise.all([
      getLeads(),
      getTours(),
      getInvoices(),
      getPackages(),
      getHotels(),
      getTodos(),
    ]);

    const today = new Date().toISOString().slice(0, 10);

    const pendingLeads = leads
      .filter((l) => l.status === "new" || l.status === "hold")
      .slice(0, 8);
    const upcomingTours = tours
      .filter((t) => t.status !== "cancelled" && t.startDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 8);
    const overdueInvoices = invoices
      .filter((i) => i.status === "overdue")
      .slice(0, 5);
    const unpaidInvoices = invoices
      .filter((i) => i.status === "pending_payment")
      .slice(0, 5);
    const openTodos = todos.filter((t) => !t.completed).slice(0, 8);

    const lines: string[] = [];
    lines.push(
      `Summary: ${leads.length} bookings total, ${pendingLeads.length} pending review, ${upcomingTours.length} upcoming tours, ${overdueInvoices.length} overdue invoices, ${unpaidInvoices.length} unpaid invoices, ${openTodos.length} open todos.`
    );

    if (pendingLeads.length > 0) {
      lines.push("\nPending bookings awaiting admin review:");
      for (const l of pendingLeads) {
        lines.push(
          `  - id=${l.id} ref=${l.reference ?? "—"} name="${l.name}" status=${l.status} travel=${l.travelDate ?? "TBD"} pax=${l.pax ?? "—"}`
        );
      }
    }

    if (upcomingTours.length > 0) {
      lines.push("\nUpcoming tours:");
      for (const t of upcomingTours) {
        lines.push(
          `  - id=${t.id} conf=${t.confirmationId ?? "—"} package="${t.packageName}" client="${t.clientName}" start=${t.startDate} pax=${t.pax} status=${t.status}`
        );
      }
    }

    if (overdueInvoices.length > 0 || unpaidInvoices.length > 0) {
      lines.push("\nInvoices needing attention:");
      for (const i of [...overdueInvoices, ...unpaidInvoices]) {
        lines.push(
          `  - id=${i.id} number=${i.invoiceNumber} client="${i.clientName}" status=${i.status} amount=${i.totalAmount} ${i.currency}`
        );
      }
    }

    if (openTodos.length > 0) {
      lines.push("\nOpen todos:");
      for (const t of openTodos) {
        lines.push(`  - id=${t.id} title="${t.title}"`);
      }
    }

    lines.push(
      `\nCatalog: ${packages.length} packages, ${hotels.length} suppliers.`
    );
    const featuredPackages = packages.filter((p) => p.featured).slice(0, 5);
    if (featuredPackages.length > 0) {
      lines.push("Featured packages:");
      for (const p of featuredPackages) {
        lines.push(
          `  - id=${p.id} name="${p.name}" ${p.duration} ${p.destination} ${p.price} ${p.currency}`
        );
      }
    }

    return lines.join("\n");
  } catch (err) {
    return `(Live context unavailable: ${err instanceof Error ? err.message : String(err)})`;
  }
}

// ── Proposal dispatcher (actually execute an approved proposal) ──────────

export interface ExecuteProposalInput {
  tool: string;
  input: unknown;
  /** Pass the proposal id so the audit event can chain to it. */
  proposalId?: string;
}

export interface ExecuteProposalResult {
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: string;
}

/**
 * Dispatcher: looks the tool up in the registry, validates input, runs it,
 * and returns a structured result. Admin-gated. All errors are caught and
 * returned as { ok:false, error } so the UI never sees an unhandled throw.
 */
export async function executeProposalAction(
  input: ExecuteProposalInput
): Promise<ExecuteProposalResult> {
  await requireAdmin();

  const tool = getTool(input.tool);
  if (!tool) {
    return {
      ok: false,
      summary: `Unknown tool: ${input.tool}`,
      error: `Tool "${input.tool}" is not in the registry. Known tools: ${AGENT_TOOLS.map((t) => t.name).join(", ")}`,
    };
  }

  // Validate the payload before touching anything.
  const parsed = tool.inputSchema.safeParse(input.input);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return {
      ok: false,
      summary: `Invalid input for ${tool.name}`,
      error: msg,
    };
  }

  const result = await tool.handler(parsed.data);

  await recordAuditEvent({
    entityType: "system",
    entityId: "agent",
    action: result.ok ? `executed_${tool.name}` : `execute_failed_${tool.name}`,
    summary: result.ok
      ? `Agent executed ${tool.name}: ${result.summary}`
      : `Agent execution failed for ${tool.name}: ${result.error ?? result.summary}`,
    details: input.proposalId ? [`Proposal: ${input.proposalId}`] : undefined,
    metadata: {
      channel: "agent_ui",
      feature: "agent_execute",
      tool: tool.name,
      status: result.ok ? "success" : "failed",
      ...(input.proposalId ? { proposalId: input.proposalId } : {}),
      ...(result.error ? { error: result.error } : {}),
    },
  });

  return {
    ok: result.ok,
    summary: result.summary,
    data: result.data,
    error: result.error,
  };
}
