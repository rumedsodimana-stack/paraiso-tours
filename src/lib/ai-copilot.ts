import "server-only";

import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/audit";
import {
  createTodo,
  updateTodo,
  deleteTodo,
  getTodos,
  getLeads,
  createLead,
  updateLead,
  deleteLead,
  getInvoices,
  getPayments,
  getHotels,
  getTours,
  deleteTour,
  getPackages,
  createPackage,
  deletePackage,
  getQuotations,
  createQuotation,
  deleteQuotation,
  createHotel,
  deleteHotel,
  createPlannerActivity,
  createHotelMealPlan,
} from "@/lib/db";
import type {
  Invoice,
  Lead,
  LeadStatus,
  Payment,
  Tour,
  Todo,
  Quotation,
  HotelSupplier,
  TourStatus,
} from "@/lib/types";
import {
  createInvoiceFromLead,
  updateInvoiceStatus,
} from "@/app/actions/invoices";
import { updateLeadStatusAction } from "@/app/actions/leads";
import { markPaymentReceived } from "@/app/actions/payments";
import {
  scheduleTourFromLeadAction,
  updateTourStatusAction as updateTourStatusServerAction,
  markTourCompletedPaidAction,
} from "@/app/actions/tours";
import {
  markQuotationSentAction,
  acceptQuotationAction,
} from "@/app/actions/quotations";

/* ── Action type ────────────────────────────────────── */

export type WorkspaceCopilotAction =
  | { type: "answer_only" }
  // Bookings / leads
  | { type: "create_booking"; name?: string; email?: string; phone?: string; source?: string; destination?: string; travelDate?: string; pax?: number; notes?: string }
  | { type: "update_booking"; bookingQuery?: string; name?: string; email?: string; phone?: string; destination?: string; travelDate?: string; pax?: number; notes?: string; status?: LeadStatus }
  | { type: "delete_booking"; bookingQuery?: string }
  | { type: "update_booking_status"; bookingQuery?: string; status?: LeadStatus }
  | { type: "create_invoice_from_booking"; bookingQuery?: string }
  | { type: "schedule_tour_from_booking"; bookingQuery?: string; startDate?: string; guestPaidOnline?: boolean }
  // Todos
  | { type: "create_todo"; title?: string }
  | { type: "toggle_todo"; todoQuery?: string }
  | { type: "delete_todo"; todoQuery?: string }
  // Tours
  | { type: "update_tour_status"; tourQuery?: string; status?: string }
  | { type: "delete_tour"; tourQuery?: string }
  | { type: "mark_tour_completed"; tourQuery?: string }
  // Invoices
  | { type: "mark_invoice_paid"; invoiceQuery?: string }
  | { type: "update_invoice_status"; invoiceQuery?: string; status?: "pending_payment" | "paid" | "overdue" | "cancelled" }
  // Payments
  | { type: "mark_payment_received"; paymentQuery?: string }
  // Packages
  | { type: "create_package"; name?: string; destination?: string; duration?: string; price?: number; currency?: string; description?: string; region?: string }
  | { type: "delete_package"; packageQuery?: string }
  // Quotations
  | { type: "create_quotation"; contactName?: string; contactEmail?: string; companyName?: string; destination?: string; travelDate?: string; pax?: number; notes?: string; lineItems?: Array<{ label: string; quantity: number; unitPrice: number }> }
  | { type: "mark_quotation_sent"; quotationQuery?: string }
  | { type: "accept_quotation"; quotationQuery?: string; startDate?: string }
  | { type: "delete_quotation"; quotationQuery?: string }
  // Suppliers
  | { type: "create_supplier"; name?: string; supplierType?: string; location?: string; email?: string; contact?: string; defaultPricePerNight?: number; currency?: string }
  | { type: "delete_supplier"; supplierQuery?: string }
  // Activities & meal plans
  | { type: "create_activity"; destinationId?: string; title?: string; summary?: string; durationLabel?: string; energy?: string; estimatedPrice?: number }
  | { type: "create_meal_plan"; hotelQuery?: string; label?: string; pricePerPerson?: number; currency?: string }
  // Communication
  | { type: "send_supplier_email"; supplierQuery?: string; subject?: string; body?: string }
  | { type: "send_client_email"; bookingQuery?: string; subject?: string; body?: string }
  // Agents
  | { type: "start_booking_agent"; bookingQuery?: string };

export interface WorkspaceCopilotPlan {
  response: string;
  action: WorkspaceCopilotAction;
}

export interface WorkspaceCopilotExecutionResult {
  ok: boolean;
  message: string;
  details?: string;
}

/* ── Entity resolution helpers ──────────────────────── */

type QueryResolution<T> =
  | { item: T }
  | { ambiguous: T[] }
  | { error: string };

const leadStatuses: LeadStatus[] = [
  "new", "contacted", "quoted", "negotiating", "won", "lost",
];

const tourStatuses: TourStatus[] = [
  "scheduled", "confirmed", "in-progress", "completed", "cancelled",
];

const invoiceStatuses = ["pending_payment", "paid", "overdue", "cancelled"];

function normalizeText(value: string | null | undefined) {
  return value?.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ?? "";
}

function describeCandidates<T>(
  items: T[],
  formatter: (item: T) => string,
  limit = 3,
) {
  return items.slice(0, limit).map(formatter).join("; ");
}

function resolveFromQuery<T>(input: {
  query?: string;
  items: T[];
  exactFields: Array<(item: T) => string | undefined>;
  containsFields: Array<(item: T) => string | undefined>;
}): QueryResolution<T> {
  const query = input.query?.trim();
  if (!query) return { error: "The request is missing the target reference." };

  const nq = normalizeText(query);

  const exactMatches = input.items.filter((item) =>
    input.exactFields.some((field) => normalizeText(field(item)) === nq),
  );
  if (exactMatches.length === 1) return { item: exactMatches[0] };
  if (exactMatches.length > 1) return { ambiguous: exactMatches };

  const containsMatches = input.items.filter((item) =>
    input.containsFields.some((field) => normalizeText(field(item)).includes(nq)),
  );
  if (containsMatches.length === 1) return { item: containsMatches[0] };
  if (containsMatches.length > 1) return { ambiguous: containsMatches };

  return { error: "No matching record was found." };
}

async function resolveLead(query?: string) {
  const leads = await getLeads();
  return resolveFromQuery<Lead>({
    query,
    items: leads,
    exactFields: [(l) => l.id, (l) => l.reference, (l) => l.email],
    containsFields: [(l) => l.reference, (l) => l.name, (l) => l.email, (l) => l.id],
  });
}

async function resolveInvoice(query?: string) {
  const invoices = await getInvoices();
  return resolveFromQuery<Invoice>({
    query,
    items: invoices,
    exactFields: [(i) => i.id, (i) => i.invoiceNumber, (i) => i.reference],
    containsFields: [(i) => i.invoiceNumber, (i) => i.reference, (i) => i.clientName, (i) => i.id],
  });
}

async function resolvePayment(query?: string) {
  const payments = await getPayments();
  return resolveFromQuery<Payment>({
    query,
    items: payments,
    exactFields: [(p) => p.id, (p) => p.reference],
    containsFields: [(p) => p.reference, (p) => p.clientName, (p) => p.description, (p) => p.id],
  });
}

async function resolveTour(query?: string) {
  const tours = await getTours();
  return resolveFromQuery<Tour>({
    query,
    items: tours,
    exactFields: [(t) => t.id, (t) => t.confirmationId, (t) => t.leadId],
    containsFields: [(t) => t.confirmationId, (t) => t.clientName, (t) => t.packageName, (t) => t.id],
  });
}

async function resolveTodo(query?: string) {
  const todos = await getTodos();
  return resolveFromQuery<Todo>({
    query,
    items: todos,
    exactFields: [(t) => t.id],
    containsFields: [(t) => t.title, (t) => t.id],
  });
}

async function resolveQuotation(query?: string) {
  const quotations = await getQuotations();
  return resolveFromQuery<Quotation>({
    query,
    items: quotations,
    exactFields: [(q) => q.id, (q) => q.reference],
    containsFields: [(q) => q.reference, (q) => q.contactName, (q) => q.companyName, (q) => q.contactEmail, (q) => q.id],
  });
}

async function resolveSupplier(query?: string) {
  const hotels = await getHotels();
  return resolveFromQuery<HotelSupplier>({
    query,
    items: hotels,
    exactFields: [(h) => h.id],
    containsFields: [(h) => h.name, (h) => h.location, (h) => h.id],
  });
}

async function resolvePackage(query?: string) {
  const packages = await getPackages();
  return resolveFromQuery<{ id: string; name: string; reference?: string; destination?: string }>({
    query,
    items: packages.map((p) => ({ id: p.id, name: p.name, reference: p.reference, destination: p.destination })),
    exactFields: [(p) => p.id, (p) => p.reference],
    containsFields: [(p) => p.reference, (p) => p.name, (p) => p.destination, (p) => p.id],
  });
}

/* ── Coerce AI output ───────────────────────────────── */

const KNOWN_ACTION_TYPES = new Set([
  "answer_only",
  "create_booking", "update_booking", "delete_booking",
  "update_booking_status", "create_invoice_from_booking", "schedule_tour_from_booking",
  "create_todo", "toggle_todo", "delete_todo",
  "update_tour_status", "delete_tour", "mark_tour_completed",
  "mark_invoice_paid", "update_invoice_status", "mark_payment_received",
  "create_package", "delete_package",
  "create_quotation", "mark_quotation_sent", "accept_quotation", "delete_quotation",
  "create_supplier", "delete_supplier",
  "create_activity", "create_meal_plan",
  "send_supplier_email", "send_client_email",
  "start_booking_agent",
]);

export function coerceWorkspaceCopilotPlan(payload: unknown): WorkspaceCopilotPlan {
  if (!payload || typeof payload !== "object") {
    return { response: "I could not interpret that request safely.", action: { type: "answer_only" } };
  }

  const p = payload as { response?: unknown; action?: Record<string, unknown> };
  const response =
    typeof p.response === "string" && p.response.trim()
      ? p.response.trim()
      : "Done.";
  const rawAction = p.action ?? {};
  const type = typeof rawAction.type === "string" ? rawAction.type : "answer_only";

  if (!KNOWN_ACTION_TYPES.has(type)) {
    return { response, action: { type: "answer_only" } };
  }

  // Pass through all action properties with basic type safety
  const action: Record<string, unknown> = { type };
  for (const [key, value] of Object.entries(rawAction)) {
    if (key === "type") continue;
    if (typeof value === "string") action[key] = value.trim();
    else if (typeof value === "number" || typeof value === "boolean") action[key] = value;
    else if (Array.isArray(value)) action[key] = value;
  }

  return { response, action: action as WorkspaceCopilotAction };
}

/* ── Execute action ─────────────────────────────────── */

export async function executeWorkspaceCopilotAction(
  action: WorkspaceCopilotAction,
): Promise<WorkspaceCopilotExecutionResult> {

  /* ─── Answer only ─── */
  if (action.type === "answer_only") {
    return { ok: true, message: "No app action was executed." };
  }

  /* ─── BOOKINGS ─── */

  if (action.type === "create_booking") {
    const name = action.name?.trim();
    const email = action.email?.trim();
    if (!name || !email) {
      return { ok: false, message: "Booking requires at least a client name and email." };
    }
    const lead = await createLead({
      name,
      email,
      phone: action.phone ?? "",
      source: action.source ?? "ai-copilot",
      status: "new",
      destination: action.destination ?? "",
      travelDate: action.travelDate ?? "",
      pax: action.pax ?? 1,
      notes: action.notes ?? "",
    });
    await recordAuditEvent({
      entityType: "lead", entityId: lead.id, action: "ai_booking_created",
      summary: `AI copilot created booking for ${name}`, actor: "Admin AI",
      details: [`Booking ID: ${lead.id}`, `Reference: ${lead.reference}`],
    });
    revalidatePath("/admin/bookings");
    revalidatePath("/admin");
    return { ok: true, message: `Booking created for ${name}.`, details: `Reference: ${lead.reference}\nBooking ID: ${lead.id}` };
  }

  if (action.type === "update_booking") {
    const resolution = await resolveLead(action.bookingQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (l) => `${l.reference ?? l.id} (${l.name})`)}` };

    const updates: Record<string, unknown> = {};
    if (action.name) updates.name = action.name;
    if (action.email) updates.email = action.email;
    if (action.phone) updates.phone = action.phone;
    if (action.destination) updates.destination = action.destination;
    if (action.travelDate) updates.travelDate = action.travelDate;
    if (action.pax) updates.pax = action.pax;
    if (action.notes) updates.notes = action.notes;
    if (action.status && leadStatuses.includes(action.status)) updates.status = action.status;

    if (Object.keys(updates).length === 0) {
      return { ok: false, message: "No fields to update were provided." };
    }

    await updateLead(resolution.item.id, updates);
    await recordAuditEvent({
      entityType: "lead", entityId: resolution.item.id, action: "ai_booking_updated",
      summary: `AI copilot updated booking ${resolution.item.reference ?? resolution.item.name}`,
      actor: "Admin AI", details: [`Updated fields: ${Object.keys(updates).join(", ")}`],
    });
    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${resolution.item.id}`);
    return { ok: true, message: `Booking ${resolution.item.reference ?? resolution.item.name} updated.`, details: `Updated: ${Object.keys(updates).join(", ")}` };
  }

  if (action.type === "delete_booking") {
    const resolution = await resolveLead(action.bookingQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (l) => `${l.reference ?? l.id} (${l.name})`)}` };

    await deleteLead(resolution.item.id);
    await recordAuditEvent({
      entityType: "lead", entityId: resolution.item.id, action: "ai_booking_deleted",
      summary: `AI copilot archived booking ${resolution.item.reference ?? resolution.item.name}`,
      actor: "Admin AI", details: [],
    });
    revalidatePath("/admin/bookings");
    revalidatePath("/admin");
    return { ok: true, message: `Booking ${resolution.item.reference ?? resolution.item.name} archived.` };
  }

  if (action.type === "update_booking_status") {
    if (!action.status) return { ok: false, message: "The target booking status is missing." };
    const resolution = await resolveLead(action.bookingQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (l) => `${l.reference ?? l.id} (${l.name})`)}` };

    const result = await updateLeadStatusAction(resolution.item.id, action.status);
    if (result.error) return { ok: false, message: result.error };
    return { ok: true, message: `Booking ${resolution.item.reference ?? resolution.item.name} marked ${action.status}.` };
  }

  if (action.type === "create_invoice_from_booking") {
    const resolution = await resolveLead(action.bookingQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (l) => `${l.reference ?? l.id} (${l.name})`)}` };

    const result = await createInvoiceFromLead(resolution.item.id);
    if (result.error) return { ok: false, message: result.error };
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
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (l) => `${l.reference ?? l.id} (${l.name})`)}` };

    const result = await scheduleTourFromLeadAction(resolution.item.id, action.startDate, action.guestPaidOnline);
    if (result.error) return { ok: false, message: result.error };
    return {
      ok: true,
      message: `Tour scheduled from booking ${resolution.item.reference ?? resolution.item.name}.`,
      details: [result.id ? `Tour ID: ${result.id}` : "", result.warnings?.length ? `Warnings: ${result.warnings.join(" | ")}` : ""].filter(Boolean).join("\n"),
    };
  }

  /* ─── TODOS ─── */

  if (action.type === "create_todo") {
    const title = action.title?.trim();
    if (!title) return { ok: false, message: "Todo title is missing." };
    const todo = await createTodo({ title, completed: false });
    await recordAuditEvent({
      entityType: "system", entityId: "ai_workspace_copilot", action: "ai_todo_created",
      summary: `AI copilot created todo: ${title}`, actor: "Admin AI",
      details: [`Todo ID: ${todo.id}`],
    });
    revalidatePath("/admin/todos");
    return { ok: true, message: `Todo created: ${title}`, details: `Todo ID: ${todo.id}` };
  }

  if (action.type === "toggle_todo") {
    const resolution = await resolveTodo(action.todoQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (t) => `"${t.title}"`)}`};

    const toggled = !resolution.item.completed;
    await updateTodo(resolution.item.id, { completed: toggled });
    revalidatePath("/admin/todos");
    return { ok: true, message: `Todo "${resolution.item.title}" marked ${toggled ? "complete" : "incomplete"}.` };
  }

  if (action.type === "delete_todo") {
    const resolution = await resolveTodo(action.todoQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (t) => `"${t.title}"`)}`};

    await deleteTodo(resolution.item.id);
    revalidatePath("/admin/todos");
    return { ok: true, message: `Todo "${resolution.item.title}" deleted.` };
  }

  /* ─── TOURS ─── */

  if (action.type === "update_tour_status") {
    const status = action.status as TourStatus | undefined;
    if (!status || !tourStatuses.includes(status)) {
      return { ok: false, message: `Invalid tour status. Use: ${tourStatuses.join(", ")}` };
    }
    const resolution = await resolveTour(action.tourQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (t) => `${t.confirmationId ?? t.id} (${t.clientName})`)}` };

    const result = await updateTourStatusServerAction(resolution.item.id, status);
    if (result.error) return { ok: false, message: result.error };
    return { ok: true, message: `Tour ${resolution.item.confirmationId ?? resolution.item.clientName} marked ${status}.` };
  }

  if (action.type === "delete_tour") {
    const resolution = await resolveTour(action.tourQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (t) => `${t.confirmationId ?? t.id} (${t.clientName})`)}` };

    await deleteTour(resolution.item.id);
    await recordAuditEvent({
      entityType: "tour", entityId: resolution.item.id, action: "ai_tour_deleted",
      summary: `AI copilot deleted tour ${resolution.item.confirmationId ?? resolution.item.clientName}`,
      actor: "Admin AI", details: [],
    });
    revalidatePath("/admin/tours");
    revalidatePath("/admin/calendar");
    revalidatePath("/admin");
    return { ok: true, message: `Tour ${resolution.item.confirmationId ?? resolution.item.clientName} deleted.` };
  }

  if (action.type === "mark_tour_completed") {
    const resolution = await resolveTour(action.tourQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (t) => `${t.confirmationId ?? t.id} (${t.clientName})`)}` };

    const result = await markTourCompletedPaidAction(resolution.item.id);
    if (result.error) return { ok: false, message: result.error };
    return { ok: true, message: `Tour ${resolution.item.confirmationId ?? resolution.item.clientName} completed and settled.`, details: result.paymentId ? `Payment ID: ${result.paymentId}` : undefined };
  }

  /* ─── INVOICES ─── */

  if (action.type === "mark_invoice_paid") {
    const resolution = await resolveInvoice(action.invoiceQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (i) => `${i.invoiceNumber} (${i.clientName})`)}` };

    const result = await updateInvoiceStatus(resolution.item.id, "paid");
    if (result.error) return { ok: false, message: result.error };
    return { ok: true, message: `Invoice ${resolution.item.invoiceNumber} marked paid.` };
  }

  if (action.type === "update_invoice_status") {
    const status = action.status;
    if (!status || !invoiceStatuses.includes(status)) {
      return { ok: false, message: `Invalid invoice status. Use: ${invoiceStatuses.join(", ")}` };
    }
    const resolution = await resolveInvoice(action.invoiceQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (i) => `${i.invoiceNumber} (${i.clientName})`)}` };

    const result = await updateInvoiceStatus(resolution.item.id, status as "pending_payment" | "paid" | "overdue" | "cancelled");
    if (result.error) return { ok: false, message: result.error };
    return { ok: true, message: `Invoice ${resolution.item.invoiceNumber} marked ${status}.` };
  }

  /* ─── PAYMENTS ─── */

  if (action.type === "mark_payment_received") {
    const resolution = await resolvePayment(action.paymentQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (p) => `${p.reference ?? p.id} (${p.description})`)}` };

    const result = await markPaymentReceived(resolution.item.id);
    if (result.error) return { ok: false, message: result.error };
    return { ok: true, message: `Payment ${resolution.item.reference ?? resolution.item.id} marked received.` };
  }

  /* ─── PACKAGES ─── */

  if (action.type === "create_package") {
    const name = action.name?.trim();
    if (!name) return { ok: false, message: "Package name is required." };

    const pkg = await createPackage({
      name,
      destination: action.destination ?? "",
      region: action.region ?? "",
      duration: action.duration ?? "",
      price: action.price ?? 0,
      currency: action.currency ?? "USD",
      description: action.description ?? "",
      itinerary: [],
      inclusions: [],
      exclusions: [],
      cancellationPolicy: "",
    });
    await recordAuditEvent({
      entityType: "package", entityId: pkg.id, action: "ai_package_created",
      summary: `AI copilot created package: ${name}`, actor: "Admin AI",
      details: [`Package ID: ${pkg.id}`, `Reference: ${pkg.reference ?? "n/a"}`],
    });
    revalidatePath("/admin/packages");
    return { ok: true, message: `Package "${name}" created.`, details: `Package ID: ${pkg.id}\nReference: ${pkg.reference ?? "n/a"}` };
  }

  if (action.type === "delete_package") {
    const resolution = await resolvePackage(action.packageQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (p) => `${p.reference ?? p.id} (${p.name})`)}` };

    await deletePackage(resolution.item.id);
    await recordAuditEvent({
      entityType: "package", entityId: resolution.item.id, action: "ai_package_deleted",
      summary: `AI copilot archived package ${resolution.item.name}`, actor: "Admin AI", details: [],
    });
    revalidatePath("/admin/packages");
    return { ok: true, message: `Package "${resolution.item.name}" archived.` };
  }

  /* ─── QUOTATIONS ─── */

  if (action.type === "create_quotation") {
    const contactName = action.contactName?.trim();
    const contactEmail = action.contactEmail?.trim();
    if (!contactName || !contactEmail) return { ok: false, message: "Quotation requires contact name and email." };

    const lineItems = (action.lineItems ?? []).map((li, i) => ({
      id: `ai-li-${i}`,
      label: li.label,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      total: li.quantity * li.unitPrice,
      notes: "",
    }));
    const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0);

    const quotation = await createQuotation({
      contactName,
      contactEmail,
      companyName: action.companyName ?? "",
      contactPhone: "",
      travelDate: action.travelDate ?? "",
      duration: "",
      pax: action.pax ?? 1,
      destination: action.destination ?? "",
      title: "",
      itinerary: [],
      inclusions: [],
      exclusions: [],
      termsAndConditions: "",
      notes: action.notes ?? "",
      validUntil: "",
      lineItems,
      subtotal,
      discountAmount: 0,
      totalAmount: subtotal,
      currency: "USD",
      status: "draft",
    });
    await recordAuditEvent({
      entityType: "system", entityId: quotation.id, action: "ai_quotation_created",
      summary: `AI copilot created quotation for ${contactName}`, actor: "Admin AI",
      details: [`Reference: ${quotation.reference}`, `Total: ${subtotal}`],
    });
    revalidatePath("/admin/quotations");
    return { ok: true, message: `Quotation created for ${contactName}.`, details: `Reference: ${quotation.reference}\nQuotation ID: ${quotation.id}` };
  }

  if (action.type === "mark_quotation_sent") {
    const resolution = await resolveQuotation(action.quotationQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (q) => `${q.reference} (${q.contactName})`)}` };

    const result = await markQuotationSentAction(resolution.item.id);
    if (result.error) return { ok: false, message: result.error };
    return { ok: true, message: `Quotation ${resolution.item.reference} marked as sent.` };
  }

  if (action.type === "accept_quotation") {
    const resolution = await resolveQuotation(action.quotationQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (q) => `${q.reference} (${q.contactName})`)}` };

    const result = await acceptQuotationAction(resolution.item.id, action.startDate);
    if (result.error) return { ok: false, message: result.error };
    return { ok: true, message: `Quotation ${resolution.item.reference} accepted and converted.`, details: result.tourId ? `Tour ID: ${result.tourId}` : undefined };
  }

  if (action.type === "delete_quotation") {
    const resolution = await resolveQuotation(action.quotationQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (q) => `${q.reference} (${q.contactName})`)}` };

    await deleteQuotation(resolution.item.id);
    revalidatePath("/admin/quotations");
    return { ok: true, message: `Quotation ${resolution.item.reference} deleted.` };
  }

  /* ─── SUPPLIERS ─── */

  if (action.type === "create_supplier") {
    const name = action.name?.trim();
    if (!name) return { ok: false, message: "Supplier name is required." };

    const supplier = await createHotel({
      name,
      type: (action.supplierType === "meal_provider" ? "meal" : action.supplierType as "hotel" | "transport" | "meal" | "supplier") ?? "hotel",
      location: action.location ?? "",
      contact: action.contact ?? "",
      email: action.email ?? "",
      defaultPricePerNight: action.defaultPricePerNight ?? 0,
      maxConcurrentBookings: 10,
      currency: action.currency ?? "USD",
    });
    await recordAuditEvent({
      entityType: "supplier", entityId: supplier.id, action: "ai_supplier_created",
      summary: `AI copilot created supplier: ${name}`, actor: "Admin AI",
      details: [`Supplier ID: ${supplier.id}`, `Type: ${action.supplierType ?? "hotel"}`],
    });
    revalidatePath("/admin/destinations");
    return { ok: true, message: `Supplier "${name}" created.`, details: `Supplier ID: ${supplier.id}` };
  }

  if (action.type === "delete_supplier") {
    const resolution = await resolveSupplier(action.supplierQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (h) => `${h.name} (${h.location})`)}` };

    const ok = await deleteHotel(resolution.item.id);
    if (!ok) return { ok: false, message: `Could not delete ${resolution.item.name}. It may be linked to packages or payments.` };
    revalidatePath("/admin/destinations");
    return { ok: true, message: `Supplier "${resolution.item.name}" archived.` };
  }

  /* ─── ACTIVITIES & MEAL PLANS ─── */

  if (action.type === "create_activity") {
    if (!action.destinationId || !action.title || !action.summary) {
      return { ok: false, message: "Destination ID, title, and summary are required." };
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
    return { ok: true, message: `Activity "${action.title}" created.`, details: `Activity ID: ${activity.id}` };
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

  /* ─── COMMUNICATION ─── */

  if (action.type === "send_supplier_email") {
    if (!action.subject || !action.body) return { ok: false, message: "Email subject and body are required." };
    const resolution = await resolveSupplier(action.supplierQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (h) => h.name)}` };
    if (!resolution.item.email) return { ok: false, message: `${resolution.item.name} has no email configured.` };
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";
      await resend.emails.send({ from: fromEmail, to: [resolution.item.email], subject: action.subject, text: action.body });
      return { ok: true, message: `Email sent to ${resolution.item.name} (${resolution.item.email}).` };
    } catch (err) {
      return { ok: false, message: `Email failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  if (action.type === "send_client_email") {
    if (!action.subject || !action.body) return { ok: false, message: "Email subject and body are required." };
    const resolution = await resolveLead(action.bookingQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (l) => `${l.reference ?? l.id} (${l.name})`)}` };
    if (!resolution.item.email) return { ok: false, message: `${resolution.item.name} has no email on file.` };
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";
      await resend.emails.send({ from: fromEmail, to: [resolution.item.email], subject: action.subject, text: action.body });
      return { ok: true, message: `Email sent to ${resolution.item.name} (${resolution.item.email}).` };
    } catch (err) {
      return { ok: false, message: `Email failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  /* ─── AGENTS ─── */

  if (action.type === "start_booking_agent") {
    const resolution = await resolveLead(action.bookingQuery);
    if ("error" in resolution) return { ok: false, message: resolution.error };
    if ("ambiguous" in resolution) return { ok: false, message: `Ambiguous: ${describeCandidates(resolution.ambiguous, (l) => `${l.reference ?? l.id} (${l.name})`)}` };
    try {
      const { startBookingProcessorAction } = await import("@/app/actions/agents");
      const { threadId } = await startBookingProcessorAction(resolution.item.id);
      revalidatePath("/admin/agents");
      return { ok: true, message: `Booking processor started for ${resolution.item.reference ?? resolution.item.name}.`, details: `Thread ID: ${threadId}` };
    } catch (err) {
      return { ok: false, message: `Agent failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  return { ok: false, message: "Unsupported copilot action." };
}
