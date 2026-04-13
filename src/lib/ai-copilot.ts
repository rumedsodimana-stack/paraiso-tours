import "server-only";

import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/audit";
import {
  createTodo,
  getInvoices,
  getLeads,
  getPayments,
  getHotels,
  createPlannerActivity,
  createHotelMealPlan,
} from "@/lib/db";
import type { Invoice, Lead, LeadStatus, Payment } from "@/lib/types";
import { createInvoiceFromLead, updateInvoiceStatus } from "@/app/actions/invoices";
import { updateLeadStatusAction } from "@/app/actions/leads";
import { markPaymentReceived } from "@/app/actions/payments";
import { scheduleTourFromLeadAction } from "@/app/actions/tours";

export type WorkspaceCopilotAction =
  | { type: "answer_only" }
  | { type: "create_todo"; title?: string }
  | {
      type: "update_booking_status";
      bookingQuery?: string;
      status?: LeadStatus;
    }
  | { type: "create_invoice_from_booking"; bookingQuery?: string }
  | {
      type: "schedule_tour_from_booking";
      bookingQuery?: string;
      startDate?: string;
      guestPaidOnline?: boolean;
    }
  | { type: "mark_invoice_paid"; invoiceQuery?: string }
  | { type: "mark_payment_received"; paymentQuery?: string }
  | { type: "create_activity"; destinationId?: string; title?: string; summary?: string; durationLabel?: string; energy?: string; estimatedPrice?: number }
  | { type: "create_meal_plan"; hotelQuery?: string; label?: string; pricePerPerson?: number; currency?: string }
  | { type: "start_booking_agent"; bookingQuery?: string }
  | { type: "send_supplier_email"; supplierQuery?: string; subject?: string; body?: string };

export interface WorkspaceCopilotPlan {
  response: string;
  action: WorkspaceCopilotAction;
}

export interface WorkspaceCopilotExecutionResult {
  ok: boolean;
  message: string;
  details?: string;
}

type QueryResolution<T> =
  | { item: T }
  | { ambiguous: T[] }
  | { error: string };

const leadStatuses: LeadStatus[] = [
  "new",
  "contacted",
  "quoted",
  "negotiating",
  "won",
  "lost",
];

function normalizeText(value: string | null | undefined) {
  return value?.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ?? "";
}

function describeCandidates<T>(
  items: T[],
  formatter: (item: T) => string,
  limit = 3
) {
  return items
    .slice(0, limit)
    .map(formatter)
    .join("; ");
}

function resolveFromQuery<T>(input: {
  query?: string;
  items: T[];
  exactFields: Array<(item: T) => string | undefined>;
  containsFields: Array<(item: T) => string | undefined>;
}): QueryResolution<T> {
  const query = input.query?.trim();
  if (!query) {
    return { error: "The request is missing the target reference." as const };
  }

  const normalizedQuery = normalizeText(query);
  const exactMatches = input.items.filter((item) =>
    input.exactFields.some((field) => normalizeText(field(item)) === normalizedQuery)
  );
  if (exactMatches.length === 1) {
    return { item: exactMatches[0] };
  }
  if (exactMatches.length > 1) {
    return { ambiguous: exactMatches };
  }

  const containsMatches = input.items.filter((item) =>
    input.containsFields.some((field) =>
      normalizeText(field(item)).includes(normalizedQuery)
    )
  );
  if (containsMatches.length === 1) {
    return { item: containsMatches[0] };
  }
  if (containsMatches.length > 1) {
    return { ambiguous: containsMatches };
  }

  return { error: "No matching record was found." as const };
}

async function resolveLead(query?: string) {
  const leads = await getLeads();
  return resolveFromQuery<Lead>({
    query,
    items: leads,
    exactFields: [
      (lead) => lead.id,
      (lead) => lead.reference,
      (lead) => lead.email,
    ],
    containsFields: [
      (lead) => lead.reference,
      (lead) => lead.name,
      (lead) => lead.email,
      (lead) => lead.id,
    ],
  });
}

async function resolveInvoice(query?: string) {
  const invoices = await getInvoices();
  return resolveFromQuery<Invoice>({
    query,
    items: invoices,
    exactFields: [
      (invoice) => invoice.id,
      (invoice) => invoice.invoiceNumber,
      (invoice) => invoice.reference,
    ],
    containsFields: [
      (invoice) => invoice.invoiceNumber,
      (invoice) => invoice.reference,
      (invoice) => invoice.clientName,
      (invoice) => invoice.id,
    ],
  });
}

async function resolvePayment(query?: string) {
  const payments = await getPayments();
  return resolveFromQuery<Payment>({
    query,
    items: payments,
    exactFields: [
      (payment) => payment.id,
      (payment) => payment.reference,
    ],
    containsFields: [
      (payment) => payment.reference,
      (payment) => payment.clientName,
      (payment) => payment.description,
      (payment) => payment.id,
    ],
  });
}

export function coerceWorkspaceCopilotPlan(payload: unknown): WorkspaceCopilotPlan {
  if (!payload || typeof payload !== "object") {
    return {
      response: "I could not interpret that request safely.",
      action: { type: "answer_only" },
    };
  }

  const typedPayload = payload as {
    response?: unknown;
    action?: Record<string, unknown>;
  };
  const response =
    typeof typedPayload.response === "string" && typedPayload.response.trim()
      ? typedPayload.response.trim()
      : "I reviewed the request.";
  const action = typedPayload.action ?? {};
  const type =
    typeof action.type === "string" ? action.type : "answer_only";

  switch (type) {
    case "create_todo":
      return {
        response,
        action: {
          type,
          title:
            typeof action.title === "string" ? action.title.trim() : undefined,
        },
      };
    case "update_booking_status":
      return {
        response,
        action: {
          type,
          bookingQuery:
            typeof action.bookingQuery === "string"
              ? action.bookingQuery.trim()
              : undefined,
          status:
            typeof action.status === "string" &&
            leadStatuses.includes(action.status as LeadStatus)
              ? (action.status as LeadStatus)
              : undefined,
        },
      };
    case "create_invoice_from_booking":
      return {
        response,
        action: {
          type,
          bookingQuery:
            typeof action.bookingQuery === "string"
              ? action.bookingQuery.trim()
              : undefined,
        },
      };
    case "schedule_tour_from_booking":
      return {
        response,
        action: {
          type,
          bookingQuery:
            typeof action.bookingQuery === "string"
              ? action.bookingQuery.trim()
              : undefined,
          startDate:
            typeof action.startDate === "string"
              ? action.startDate.trim()
              : undefined,
          guestPaidOnline:
            typeof action.guestPaidOnline === "boolean"
              ? action.guestPaidOnline
              : false,
        },
      };
    case "mark_invoice_paid":
      return {
        response,
        action: {
          type,
          invoiceQuery:
            typeof action.invoiceQuery === "string"
              ? action.invoiceQuery.trim()
              : undefined,
        },
      };
    case "mark_payment_received":
      return {
        response,
        action: {
          type,
          paymentQuery:
            typeof action.paymentQuery === "string"
              ? action.paymentQuery.trim()
              : undefined,
        },
      };
    default:
      return {
        response,
        action: { type: "answer_only" },
      };
  }
}

export async function executeWorkspaceCopilotAction(
  action: WorkspaceCopilotAction
): Promise<WorkspaceCopilotExecutionResult> {
  if (action.type === "answer_only") {
    return {
      ok: true,
      message: "No app action was executed.",
    };
  }

  if (action.type === "create_todo") {
    const title = action.title?.trim();
    if (!title) {
      return {
        ok: false,
        message: "The todo title is missing.",
      };
    }

    const todo = await createTodo({ title, completed: false });
    await recordAuditEvent({
      entityType: "system",
      entityId: "ai_workspace_copilot",
      action: "ai_todo_created",
      summary: `AI copilot created todo: ${title}`,
      actor: "Admin AI Studio",
      details: [`Todo ID: ${todo.id}`],
    });
    revalidatePath("/admin/todos");
    return {
      ok: true,
      message: `Todo created: ${title}`,
      details: `Todo ID: ${todo.id}`,
    };
  }

  if (action.type === "update_booking_status") {
    if (!action.status) {
      return { ok: false, message: "The target booking status is missing." };
    }

    const resolution = await resolveLead(action.bookingQuery);
    if ("error" in resolution) {
      return {
        ok: false,
        message: resolution.error ?? "No matching booking was found.",
      };
    }
    if ("ambiguous" in resolution) {
      return {
        ok: false,
        message: `Booking match is ambiguous: ${describeCandidates(
          resolution.ambiguous,
          (lead) => `${lead.reference ?? lead.id} (${lead.name})`
        )}`,
      };
    }

    const result = await updateLeadStatusAction(resolution.item.id, action.status);
    if (result.error) {
      return { ok: false, message: result.error };
    }

    return {
      ok: true,
      message: `Booking ${resolution.item.reference ?? resolution.item.name} marked ${action.status}.`,
    };
  }

  if (action.type === "create_invoice_from_booking") {
    const resolution = await resolveLead(action.bookingQuery);
    if ("error" in resolution) {
      return {
        ok: false,
        message: resolution.error ?? "No matching booking was found.",
      };
    }
    if ("ambiguous" in resolution) {
      return {
        ok: false,
        message: `Booking match is ambiguous: ${describeCandidates(
          resolution.ambiguous,
          (lead) => `${lead.reference ?? lead.id} (${lead.name})`
        )}`,
      };
    }

    const result = await createInvoiceFromLead(resolution.item.id);
    if (result.error) {
      return { ok: false, message: result.error };
    }

    return {
      ok: true,
      message: result.created
        ? `Invoice created for ${resolution.item.reference ?? resolution.item.name}.`
        : `Invoice already existed for ${resolution.item.reference ?? resolution.item.name}.`,
      details: result.invoiceId ? `Invoice ID: ${result.invoiceId}` : undefined,
    };
  }

  if (action.type === "schedule_tour_from_booking") {
    const resolution = await resolveLead(action.bookingQuery);
    if ("error" in resolution) {
      return {
        ok: false,
        message: resolution.error ?? "No matching booking was found.",
      };
    }
    if ("ambiguous" in resolution) {
      return {
        ok: false,
        message: `Booking match is ambiguous: ${describeCandidates(
          resolution.ambiguous,
          (lead) => `${lead.reference ?? lead.id} (${lead.name})`
        )}`,
      };
    }

    const result = await scheduleTourFromLeadAction(
      resolution.item.id,
      action.startDate,
      action.guestPaidOnline
    );
    if (result.error) {
      return { ok: false, message: result.error };
    }

    return {
      ok: true,
      message: `Tour scheduled from booking ${resolution.item.reference ?? resolution.item.name}.`,
      details: [
        result.id ? `Tour ID: ${result.id}` : "",
        result.warnings?.length
          ? `Warnings: ${result.warnings.join(" | ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  if (action.type === "mark_invoice_paid") {
    const resolution = await resolveInvoice(action.invoiceQuery);
    if ("error" in resolution) {
      return {
        ok: false,
        message: resolution.error ?? "No matching invoice was found.",
      };
    }
    if ("ambiguous" in resolution) {
      return {
        ok: false,
        message: `Invoice match is ambiguous: ${describeCandidates(
          resolution.ambiguous,
          (invoice) => `${invoice.invoiceNumber} (${invoice.clientName})`
        )}`,
      };
    }

    const result = await updateInvoiceStatus(resolution.item.id, "paid");
    if (result.error) {
      return { ok: false, message: result.error };
    }

    return {
      ok: true,
      message: `Invoice ${resolution.item.invoiceNumber} marked paid.`,
    };
  }

  if (action.type === "mark_payment_received") {
    const resolution = await resolvePayment(action.paymentQuery);
    if ("error" in resolution) {
      return {
        ok: false,
        message: resolution.error ?? "No matching payment was found.",
      };
    }
    if ("ambiguous" in resolution) {
      return {
        ok: false,
        message: `Payment match is ambiguous: ${describeCandidates(
          resolution.ambiguous,
          (payment) => `${payment.reference ?? payment.id} (${payment.description})`
        )}`,
      };
    }

    const result = await markPaymentReceived(resolution.item.id);
    if (result.error) {
      return { ok: false, message: result.error };
    }

    return {
      ok: true,
      message: `Payment ${resolution.item.reference ?? resolution.item.id} marked received.`,
    };
  }

  if (action.type === "create_activity") {
    if (!action.destinationId || !action.title || !action.summary) {
      return { ok: false, message: "Destination ID, title, and summary are required to create an activity." };
    }
    const activity = await createPlannerActivity({
      destinationId: action.destinationId,
      title: action.title,
      summary: action.summary,
      durationLabel: action.durationLabel || "2 hours",
      energy: (action.energy as "easy" | "moderate" | "active") || "easy",
      estimatedPrice: action.estimatedPrice || 0,
      tags: [],
    });
    revalidatePath("/admin/activities");
    revalidatePath("/admin/destinations");
    return { ok: true, message: `Activity "${action.title}" created for ${action.destinationId}.`, details: `Activity ID: ${activity.id}` };
  }

  if (action.type === "create_meal_plan") {
    if (!action.label) return { ok: false, message: "Meal plan label is required." };
    const hotels = await getHotels();
    const query = action.hotelQuery?.toLowerCase() || "";
    const hotel = hotels.find((h) => h.type === "hotel" && (h.name.toLowerCase().includes(query) || h.id === query));
    if (!hotel) return { ok: false, message: `No hotel found matching "${action.hotelQuery}".` };
    const mp = await createHotelMealPlan({
      hotelId: hotel.id,
      label: action.label,
      pricePerPerson: action.pricePerPerson || 0,
      priceType: "per_person",
      currency: action.currency || hotel.currency || "USD",
    });
    revalidatePath(`/admin/hotels/${hotel.id}`);
    revalidatePath("/admin/destinations");
    return { ok: true, message: `Meal plan "${action.label}" created for ${hotel.name}.`, details: `Meal plan ID: ${mp.id}` };
  }

  if (action.type === "start_booking_agent") {
    const resolution = await resolveLead(action.bookingQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error ?? "No matching booking found." };
    if ("ambiguous" in resolution) return { ok: false, message: `Booking match is ambiguous: ${describeCandidates(resolution.ambiguous, (l) => `${l.reference ?? l.id} (${l.name})`)}` };
    try {
      const { startBookingProcessorAction } = await import("@/app/actions/agents");
      const { threadId } = await startBookingProcessorAction(resolution.item.id);
      revalidatePath("/admin/agents");
      return { ok: true, message: `Booking processor agent started for ${resolution.item.reference ?? resolution.item.name}.`, details: `Thread ID: ${threadId}` };
    } catch (err) {
      return { ok: false, message: `Agent failed to start: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  if (action.type === "send_supplier_email") {
    if (!action.subject || !action.body) return { ok: false, message: "Email subject and body are required." };
    const hotels = await getHotels();
    const query = action.supplierQuery?.toLowerCase() || "";
    const supplier = hotels.find((h) => h.name.toLowerCase().includes(query) || h.id === query);
    if (!supplier) return { ok: false, message: `No supplier found matching "${action.supplierQuery}".` };
    if (!supplier.email) return { ok: false, message: `${supplier.name} has no email configured.` };
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";
      await resend.emails.send({ from: fromEmail, to: [supplier.email], subject: action.subject, text: action.body });
      return { ok: true, message: `Email sent to ${supplier.name} (${supplier.email}).` };
    } catch (err) {
      return { ok: false, message: `Email failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  return {
    ok: false,
    message: "Unsupported copilot action.",
  };
}
