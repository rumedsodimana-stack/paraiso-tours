/**
 * Agent tool registry.
 *
 * Every tool the agent can propose is declared here with:
 *   - a stable name (used in the decision payload)
 *   - a short description (fed to the LLM so it knows what's available)
 *   - a Zod schema for the input (so we reject bad payloads before
 *     touching the DB)
 *   - a server-side handler that wraps an existing server action
 *
 * The dispatcher in `app/actions/agent-execute.ts` is the only caller of
 * these handlers — it enforces admin auth, validates input, runs, and
 * returns a structured result back into the agent loop.
 */

import { z } from "zod";

// ── Tool registry schema ────────────────────────────────────────────────

export interface ToolDescriptor {
  name: string;
  summary: string;
  /** Zod schema for the input payload. */
  inputSchema: z.ZodTypeAny;
  /** Optional — show the admin a friendly confirmation string before
   *  running. The agent fills in the blanks via the proposal title. */
  danger?: "low" | "medium" | "high";
  /** Execute the tool. Handlers MUST be idempotent-friendly (e.g. mark-
   *  sent emails should be safe to retry) and never throw; return
   *  { ok: false, error } on failure. */
  handler: (input: unknown) => Promise<ToolResult>;
}

export interface ToolResult {
  ok: boolean;
  summary: string; // one-line human-readable outcome
  data?: unknown;  // raw payload for the agent's next turn
  error?: string;
}

// ── Shared helpers ──────────────────────────────────────────────────────

function ok(summary: string, data?: unknown): ToolResult {
  return { ok: true, summary, data };
}

function fail(error: string): ToolResult {
  return { ok: false, summary: error, error };
}

async function safe<T>(
  label: string,
  fn: () => Promise<T>
): Promise<ToolResult> {
  try {
    const data = await fn();
    return ok(`${label} succeeded.`, data);
  } catch (err) {
    return fail(
      err instanceof Error ? `${label} failed: ${err.message}` : `${label} failed.`
    );
  }
}

// ── Tools ───────────────────────────────────────────────────────────────

const ToolSearchLeadsInput = z.object({
  query: z.string().max(200).optional(),
  status: z.enum(["new", "hold", "cancelled", "won"]).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const ToolGetLeadInput = z.object({
  id: z.string().min(1).max(200),
});

const ToolGetTourInput = z.object({
  id: z.string().min(1).max(200),
});

const ToolScheduleTourInput = z.object({
  leadId: z.string().min(1).max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const ToolMarkTourCompletedInput = z.object({
  tourId: z.string().min(1).max(200),
});

const ToolCreateInvoiceInput = z.object({
  leadId: z.string().min(1).max(200),
});

const ToolSendInvoiceInput = z.object({
  invoiceId: z.string().min(1).max(200),
});

const ToolSendItineraryInput = z.object({
  tourId: z.string().min(1).max(200),
});

const ToolSendPreTripInput = z.object({
  tourId: z.string().min(1).max(200),
});

const ToolSendPostTripInput = z.object({
  tourId: z.string().min(1).max(200),
});

const ToolSendBookingChangeInput = z.object({
  tourId: z.string().min(1).max(200),
  changeType: z.enum(["revision", "cancellation"]),
  summary: z.string().min(1).max(2000),
});

const ToolCreateTodoInput = z.object({
  title: z.string().min(1).max(500),
});

const ToolToggleTodoInput = z.object({
  id: z.string().min(1).max(200),
});

const ToolUpdateLeadStatusInput = z.object({
  id: z.string().min(1).max(200),
  status: z.enum(["new", "hold", "cancelled", "won"]),
});

// ── Registry ────────────────────────────────────────────────────────────

export const AGENT_TOOLS: ToolDescriptor[] = [
  {
    name: "search_leads",
    summary:
      "Search bookings (leads) by name/email/reference, optionally filter by status. Read-only.",
    inputSchema: ToolSearchLeadsInput,
    danger: "low",
    handler: async (raw) => {
      const input = ToolSearchLeadsInput.parse(raw);
      const { getLeads } = await import("./db");
      const all = await getLeads();
      const needle = input.query?.toLowerCase().trim();
      let rows = all;
      if (needle) {
        rows = rows.filter(
          (l) =>
            l.name.toLowerCase().includes(needle) ||
            l.email.toLowerCase().includes(needle) ||
            (l.reference ?? "").toLowerCase().includes(needle)
        );
      }
      if (input.status) rows = rows.filter((l) => l.status === input.status);
      rows = rows.slice(0, input.limit ?? 10);
      return ok(
        `Found ${rows.length} booking${rows.length === 1 ? "" : "s"}.`,
        rows.map((l) => ({
          id: l.id,
          reference: l.reference,
          name: l.name,
          email: l.email,
          status: l.status,
          travelDate: l.travelDate,
          pax: l.pax,
        }))
      );
    },
  },
  {
    name: "get_lead",
    summary: "Get full detail of a single booking by id. Read-only.",
    inputSchema: ToolGetLeadInput,
    danger: "low",
    handler: async (raw) => {
      const input = ToolGetLeadInput.parse(raw);
      const { getLead } = await import("./db");
      const lead = await getLead(input.id);
      if (!lead) return fail(`No booking with id ${input.id}.`);
      return ok(`Loaded booking ${lead.name}.`, lead);
    },
  },
  {
    name: "get_tour",
    summary: "Get full detail of a scheduled tour by id. Read-only.",
    inputSchema: ToolGetTourInput,
    danger: "low",
    handler: async (raw) => {
      const input = ToolGetTourInput.parse(raw);
      const { getTour } = await import("./db");
      const tour = await getTour(input.id);
      if (!tour) return fail(`No tour with id ${input.id}.`);
      return ok(`Loaded tour ${tour.packageName}.`, tour);
    },
  },
  {
    name: "update_lead_status",
    summary:
      "Approve or cancel a booking by changing its status (new/hold/won/cancelled).",
    inputSchema: ToolUpdateLeadStatusInput,
    danger: "medium",
    handler: async (raw) => {
      const input = ToolUpdateLeadStatusInput.parse(raw);
      const { updateLeadStatusAction } = await import("@/app/actions/leads");
      return safe("Update booking status", async () => {
        const r = await updateLeadStatusAction(input.id, input.status);
        if (!r?.success) throw new Error(r?.error ?? "Status change failed");
        return r;
      });
    },
  },
  {
    name: "schedule_tour_from_lead",
    summary:
      "Schedule the tour for an approved booking. Creates the tour, invoice, payment, and supplier payables. Sends confirmation emails.",
    inputSchema: ToolScheduleTourInput,
    danger: "high",
    handler: async (raw) => {
      const input = ToolScheduleTourInput.parse(raw);
      const { scheduleTourFromLeadAction } = await import("@/app/actions/tours");
      return safe("Schedule tour", async () => {
        const r = await scheduleTourFromLeadAction(input.leadId, input.startDate);
        if (r.error || !r.id) throw new Error(r.error ?? "Scheduling failed");
        return r;
      });
    },
  },
  {
    name: "mark_tour_completed",
    summary:
      "Mark a scheduled tour as completed and settle payment. Sends payment receipt email.",
    inputSchema: ToolMarkTourCompletedInput,
    danger: "high",
    handler: async (raw) => {
      const input = ToolMarkTourCompletedInput.parse(raw);
      const { markTourCompletedPaidAction } = await import("@/app/actions/tours");
      return safe("Mark tour completed", async () => {
        const r = await markTourCompletedPaidAction(input.tourId);
        if (r.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "create_invoice_from_lead",
    summary: "Create an invoice for a booking if one doesn't exist yet.",
    inputSchema: ToolCreateInvoiceInput,
    danger: "medium",
    handler: async (raw) => {
      const input = ToolCreateInvoiceInput.parse(raw);
      const { createInvoiceFromLead } = await import("@/app/actions/invoices");
      return safe("Create invoice", async () => {
        const r = await createInvoiceFromLead(input.leadId);
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "send_invoice_to_guest",
    summary: "Email an invoice PDF to the guest on file.",
    inputSchema: ToolSendInvoiceInput,
    danger: "medium",
    handler: async (raw) => {
      const input = ToolSendInvoiceInput.parse(raw);
      const { sendInvoiceToGuestAction } = await import("@/app/actions/invoices");
      return safe("Send invoice", async () => {
        const r = await sendInvoiceToGuestAction(input.invoiceId);
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "send_itinerary_to_guest",
    summary: "Email the tour itinerary PDF to the guest.",
    inputSchema: ToolSendItineraryInput,
    danger: "medium",
    handler: async (raw) => {
      const input = ToolSendItineraryInput.parse(raw);
      const { sendItineraryToGuestAction } = await import("@/app/actions/tours");
      return safe("Send itinerary", async () => {
        const r = await sendItineraryToGuestAction(input.tourId);
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "send_pre_trip_reminder",
    summary: "Email a pre-trip reminder to the guest.",
    inputSchema: ToolSendPreTripInput,
    danger: "low",
    handler: async (raw) => {
      const input = ToolSendPreTripInput.parse(raw);
      const { sendPreTripReminderAction } = await import(
        "@/app/actions/communications"
      );
      return safe("Send pre-trip reminder", async () => {
        const r = await sendPreTripReminderAction(input.tourId);
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "send_post_trip_followup",
    summary: "Email a post-trip thank-you / feedback request to the guest.",
    inputSchema: ToolSendPostTripInput,
    danger: "low",
    handler: async (raw) => {
      const input = ToolSendPostTripInput.parse(raw);
      const { sendPostTripFollowUpAction } = await import(
        "@/app/actions/communications"
      );
      return safe("Send post-trip follow-up", async () => {
        const r = await sendPostTripFollowUpAction(input.tourId);
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "send_booking_change_notice",
    summary:
      "Email a guest about a booking revision or cancellation. changeType: revision | cancellation.",
    inputSchema: ToolSendBookingChangeInput,
    danger: "medium",
    handler: async (raw) => {
      const input = ToolSendBookingChangeInput.parse(raw);
      const { sendBookingChangeNoticeAction } = await import(
        "@/app/actions/communications"
      );
      return safe("Send booking change notice", async () => {
        const r = await sendBookingChangeNoticeAction(input.tourId, {
          changeType: input.changeType,
          summary: input.summary,
        });
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "create_todo",
    summary: "Create a todo for the team.",
    inputSchema: ToolCreateTodoInput,
    danger: "low",
    handler: async (raw) => {
      const input = ToolCreateTodoInput.parse(raw);
      const { createTodo } = await import("./db");
      return safe("Create todo", async () => {
        const todo = await createTodo({ title: input.title, completed: false });
        return todo;
      });
    },
  },
  {
    name: "toggle_todo",
    summary: "Mark a todo complete (toggles).",
    inputSchema: ToolToggleTodoInput,
    danger: "low",
    handler: async (raw) => {
      const input = ToolToggleTodoInput.parse(raw);
      const { toggleTodoAction } = await import("@/app/actions/todos");
      return safe("Toggle todo", async () => {
        const r = await toggleTodoAction(input.id);
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },
];

const TOOLS_BY_NAME = new Map(AGENT_TOOLS.map((t) => [t.name, t]));

export function getTool(name: string): ToolDescriptor | null {
  return TOOLS_BY_NAME.get(name) ?? null;
}

export function listToolsForPrompt(): string {
  return AGENT_TOOLS
    .map(
      (t) =>
        `  - ${t.name} (${t.danger ?? "low"} risk): ${t.summary}\n    input schema: ${describeSchema(t.inputSchema)}`
    )
    .join("\n");
}

/** Produce a compact, LLM-friendly description of a Zod object schema.
 *  Tolerant of both zod v3 (shape() getter) and v4 (shape object). */
function describeSchema(schema: z.ZodTypeAny): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (schema as any)._def ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let shape: Record<string, z.ZodTypeAny> | undefined;
  if (typeof def.shape === "function") {
    shape = def.shape();
  } else if (def.shape && typeof def.shape === "object") {
    shape = def.shape as Record<string, z.ZodTypeAny>;
  }
  if (!shape) return "object";
  const parts: string[] = [];
  for (const [key, field] of Object.entries(shape)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fdef = (field as any)._def ?? {};
    const type =
      (typeof fdef.typeName === "string" && fdef.typeName) ||
      (typeof fdef.type === "string" && fdef.type) ||
      "unknown";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const optional = (field as any).isOptional?.() ? "?" : "";
    parts.push(`${key}${optional}: ${String(type).replace(/^Zod/, "")}`);
  }
  return `{ ${parts.join(", ")} }`;
}
