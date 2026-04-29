"use server";

import { revalidatePath } from "next/cache";
import {
  getInvoice,
  getInvoiceByLeadId,
  getLead,
  getPackage,
  getPaymentByTourId,
  getTour,
  extractErrorMessage,
} from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import {
  sendInvoiceEmail,
  sendItineraryEmail,
  sendPaymentReceiptEmail,
  sendTourConfirmationWithInvoice,
  sendPreTripReminderEmail,
  sendPostTripFollowUpEmail,
  sendBookingChangeEmail,
  sendSupplierRemittanceEmail,
  sendSupplierScheduleUpdateEmail,
} from "@/lib/email";
import { resolveTourPackage } from "@/lib/package-snapshot";
import { generateItineraryPdf } from "@/lib/itinerary-pdf";
import { requireAdmin } from "@/lib/admin-session";

export type ResendEmailInput = {
  /**
   * Full set of email templates the system emits. Note that not every
   * template is *resendable* from this action — booking-change and
   * supplier-change notices need a fresh `summary` the admin types in,
   * and `internal_new_booking` is a one-shot internal alert. Those
   * fall through to the default branch which surfaces a friendly
   * "cannot be resent from here" error.
   */
  template:
    | "tour_confirmation_with_invoice"
    | "supplier_reservation"
    | "payment_receipt"
    | "invoice"
    | "itinerary"
    | "pre_trip_reminder"
    | "post_trip_followup"
    | "booking_revision"
    | "booking_cancellation"
    | "booking_request_confirmation"
    | "quotation"
    | "supplier_remittance"
    | "supplier_schedule_update"
    | "supplier_cancellation"
    | "internal_new_booking"
    | "other";
  invoiceId?: string;
  tourId?: string;
  leadId?: string;
  /** Used for supplier_remittance — the source-of-truth lookup key. */
  paymentId?: string;
  /** Supplier-specific resend context. Recipient email used to find the
   *  supplier when only that much of the history is preserved. */
  supplierEmail?: string;
  supplierName?: string;
};

type Result = { success?: boolean; error?: string };

export async function resendEmailAction(input: ResendEmailInput): Promise<Result> {
  await requireAdmin();
  try {
    switch (input.template) {
      case "invoice":
        return await resendInvoice(input.invoiceId);
      case "itinerary":
        return await resendItinerary(input.tourId);
      case "tour_confirmation_with_invoice":
        return await resendTourConfirmation(input.tourId);
      case "payment_receipt":
        return await resendPaymentReceipt(input.tourId);
      case "supplier_reservation":
        return await resendSupplierReservation(
          input.tourId,
          input.supplierEmail,
          input.supplierName
        );
      case "pre_trip_reminder":
        return await sendPreTripReminderAction(input.tourId ?? "");
      case "post_trip_followup":
        return await sendPostTripFollowUpAction(input.tourId ?? "");
      case "supplier_remittance":
        return await sendSupplierRemittanceAction(input.paymentId ?? "");
      // Fall-through templates: the admin must re-trigger from the
      // detail page where the original input lives. Surfacing this
      // explicitly so the UI can hide the resend button instead of
      // showing a confusing error.
      case "booking_revision":
      case "booking_cancellation":
      case "booking_request_confirmation":
      case "quotation":
      case "supplier_schedule_update":
      case "supplier_cancellation":
      case "internal_new_booking":
      case "other":
      default:
        return { error: "This template cannot be resent from here." };
    }
  } catch (err) {
    return { error: extractErrorMessage(err) };
  }
}

async function resendInvoice(invoiceId?: string): Promise<Result> {
  if (!invoiceId) return { error: "Missing invoice id" };
  const invoice = await getInvoice(invoiceId);
  if (!invoice) return { error: "Invoice not found" };
  const email = invoice.clientEmail?.trim();
  if (!email) return { error: "No client email on invoice" };

  const result = await sendInvoiceEmail({
    clientName: invoice.clientName || "Client",
    clientEmail: email,
    invoice,
  });

  await recordAuditEvent({
    entityType: "invoice",
    entityId: invoice.id,
    action: result.ok ? "invoice_emailed" : "invoice_email_failed",
    summary: result.ok
      ? `Invoice ${invoice.invoiceNumber} resent to ${email}`
      : `Invoice resend failed: ${result.error ?? "unknown"}`,
    details: [`Recipient: ${email}`, `Trigger: manual resend`],
    metadata: {
      channel: "email",
      recipient: email,
      template: "invoice",
      invoiceNumber: invoice.invoiceNumber,
      status: result.ok ? "sent" : "failed",
      resent: true,
      ...(result.ok ? {} : { error: result.error ?? "unknown" }),
    },
  });

  revalidatePath("/admin/communications");
  return result.ok ? { success: true } : { error: result.error ?? "Send failed" };
}

async function resendItinerary(tourId?: string): Promise<Result> {
  if (!tourId) return { error: "Missing tour id" };
  const tour = await getTour(tourId);
  if (!tour) return { error: "Tour not found" };
  const lead = await getLead(tour.leadId);
  if (!lead) return { error: "Booking not found for tour" };
  const email = lead.email?.trim();
  if (!email) return { error: "No guest email on booking" };

  const livePackage = await getPackage(tour.packageId);
  const pkg = resolveTourPackage(tour, livePackage, lead);
  const pdfBuffer = await generateItineraryPdf({ tour, pkg, lead });

  const result = await sendItineraryEmail({
    clientName: lead.name,
    clientEmail: email,
    packageName: tour.packageName,
    startDate: tour.startDate,
    endDate: tour.endDate,
    reference: lead.reference,
    pdfBuffer,
    filename: `Itinerary-${(tour.confirmationId || tour.id).replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`,
  });

  await recordAuditEvent({
    entityType: "tour",
    entityId: tour.id,
    action: result.ok ? "itinerary_emailed" : "itinerary_email_failed",
    summary: result.ok
      ? `Itinerary resent to ${email}`
      : `Itinerary resend failed: ${result.error ?? "unknown"}`,
    details: [`Recipient: ${email}`, `Trigger: manual resend`],
    metadata: {
      channel: "email",
      recipient: email,
      template: "itinerary",
      status: result.ok ? "sent" : "failed",
      resent: true,
      ...(result.ok ? {} : { error: result.error ?? "unknown" }),
    },
  });

  revalidatePath("/admin/communications");
  return result.ok ? { success: true } : { error: result.error ?? "Send failed" };
}

async function resendTourConfirmation(tourId?: string): Promise<Result> {
  if (!tourId) return { error: "Missing tour id" };
  const tour = await getTour(tourId);
  if (!tour) return { error: "Tour not found" };
  const lead = await getLead(tour.leadId);
  if (!lead) return { error: "Booking not found for tour" };
  const email = lead.email?.trim();
  if (!email) return { error: "No guest email on booking" };

  const invoice = await getInvoiceByLeadId(lead.id);

  // Re-render the itinerary so the resend matches the original
  // confirmation (invoice + itinerary PDFs). If the package has
  // drifted since scheduling, `resolveTourPackage` falls back to the
  // frozen snapshot stored on the tour — same logic the standalone
  // itinerary resend uses.
  let itineraryAttachment: { content: Buffer; filename?: string } | undefined;
  try {
    const livePackage = await getPackage(tour.packageId);
    const pkg = resolveTourPackage(tour, livePackage, lead);
    const itineraryBuffer = await generateItineraryPdf({ tour, pkg, lead });
    itineraryAttachment = {
      content: itineraryBuffer,
      filename: `Itinerary-${(tour.confirmationId || tour.id).replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`,
    };
  } catch {
    // Itinerary failure must not block the resend — invoice still goes.
  }

  const result = await sendTourConfirmationWithInvoice({
    clientName: lead.name,
    clientEmail: email,
    packageName: tour.packageName,
    startDate: tour.startDate,
    endDate: tour.endDate,
    pax: tour.pax,
    reference: lead.reference,
    invoice: invoice ?? undefined,
    itineraryPdf: itineraryAttachment,
  });

  await recordAuditEvent({
    entityType: "tour",
    entityId: tour.id,
    action: result.ok ? "guest_confirmation_emailed" : "guest_confirmation_email_failed",
    summary: result.ok
      ? `Tour confirmation resent to ${email}`
      : `Tour confirmation resend failed: ${result.error ?? "unknown"}`,
    details: [`Recipient: ${email}`, `Trigger: manual resend`],
    metadata: {
      channel: "email",
      recipient: email,
      template: "tour_confirmation_with_invoice",
      status: result.ok ? "sent" : "failed",
      resent: true,
      ...(result.ok ? {} : { error: result.error ?? "unknown" }),
    },
  });

  revalidatePath("/admin/communications");
  return result.ok ? { success: true } : { error: result.error ?? "Send failed" };
}

async function resendPaymentReceipt(tourId?: string): Promise<Result> {
  if (!tourId) return { error: "Missing tour id" };
  const tour = await getTour(tourId);
  if (!tour) return { error: "Tour not found" };
  const lead = await getLead(tour.leadId);
  if (!lead) return { error: "Booking not found for tour" };
  const email = lead.email?.trim();
  if (!email) return { error: "No guest email on booking" };

  const payment = await getPaymentByTourId(tourId);
  const description = payment?.description || `Tour: ${tour.packageName} – ${lead.name}`;
  const amount = payment?.amount ?? tour.totalValue;
  const currency = payment?.currency ?? tour.currency;
  const date = payment?.date;

  const result = await sendPaymentReceiptEmail({
    clientEmail: email,
    clientName: lead.name,
    amount,
    currency,
    description,
    reference: lead.reference,
    date,
  });

  await recordAuditEvent({
    entityType: "tour",
    entityId: tour.id,
    action: result.ok ? "payment_receipt_emailed" : "payment_receipt_email_failed",
    summary: result.ok
      ? `Payment receipt resent to ${email}`
      : `Payment receipt resend failed: ${result.error ?? "unknown"}`,
    details: [`Recipient: ${email}`, `Trigger: manual resend`],
    metadata: {
      channel: "email",
      recipient: email,
      template: "payment_receipt",
      status: result.ok ? "sent" : "failed",
      resent: true,
      ...(result.ok ? {} : { error: result.error ?? "unknown" }),
    },
  });

  revalidatePath("/admin/communications");
  return result.ok ? { success: true } : { error: result.error ?? "Send failed" };
}

async function resendSupplierReservation(
  tourId: string | undefined,
  supplierEmail: string | undefined,
  supplierNameHint: string | undefined
): Promise<Result> {
  if (!tourId) return { error: "Missing tour id" };
  if (!supplierEmail) return { error: "Missing supplier email" };

  const tour = await getTour(tourId);
  if (!tour) return { error: "Tour not found" };
  const lead = await getLead(tour.leadId);
  if (!lead) return { error: "Booking not found for tour" };

  const livePackage = await getPackage(tour.packageId);
  const pkg = resolveTourPackage(tour, livePackage, lead);
  if (!pkg) return { error: "Package not found" };

  const { getHotels } = await import("@/lib/db");
  const { getSuppliersForSchedule } = await import("@/lib/booking-breakdown");
  const suppliers = await getHotels();

  // Find the supplier by email (preferred) or name fallback.
  const needleEmail = supplierEmail.trim().toLowerCase();
  const supplier =
    suppliers.find((s) => s.email?.trim().toLowerCase() === needleEmail) ??
    (supplierNameHint
      ? suppliers.find(
          (s) => s.name.trim().toLowerCase() === supplierNameHint.trim().toLowerCase()
        )
      : undefined);

  if (!supplier) {
    return {
      error: `No supplier in the catalog matches ${supplierEmail}. Add the supplier or update their email.`,
    };
  }

  // Recompute the reservation context so the email mirrors a real scheduling.
  const scheduleSuppliers = getSuppliersForSchedule(lead, pkg, suppliers);
  const match = scheduleSuppliers?.withEmail.find(
    (s) => s.email.trim().toLowerCase() === (supplier.email ?? "").trim().toLowerCase()
  );

  const { sendSupplierReservationEmail } = await import("@/lib/email");
  const result = await sendSupplierReservationEmail({
    supplierEmail: supplier.email || supplierEmail,
    supplierName: supplier.name,
    supplierType:
      (match?.supplierType as "Accommodation" | "Transport" | "Meals") ||
      (supplier.type === "hotel"
        ? "Accommodation"
        : supplier.type === "transport"
          ? "Transport"
          : "Meals"),
    clientName: lead.name,
    accompaniedGuestName: lead.accompaniedGuestName,
    reference: lead.reference || tour.id,
    packageName: pkg.name,
    optionLabel: match?.optionLabel || "As per package",
    checkInDate: tour.startDate,
    checkOutDate: tour.endDate,
    pax: tour.pax,
    duration: pkg.duration,
  });

  await recordAuditEvent({
    entityType: "tour",
    entityId: tour.id,
    action: result.ok ? "supplier_reservation_emailed" : "supplier_reservation_email_failed",
    summary: result.ok
      ? `Reservation resent to ${supplier.name}`
      : `Supplier resend failed: ${result.error ?? "unknown"}`,
    details: [
      `Supplier: ${supplier.name}`,
      `Recipient: ${supplier.email || supplierEmail}`,
      `Trigger: manual resend`,
    ],
    metadata: {
      channel: "email",
      recipient: supplier.email || supplierEmail,
      template: "supplier_reservation",
      supplierName: supplier.name,
      supplierType: supplier.type,
      status: result.ok ? "sent" : "failed",
      resent: true,
      ...(result.ok ? {} : { error: result.error ?? "unknown" }),
    },
  });

  revalidatePath("/admin/communications");
  return result.ok ? { success: true } : { error: result.error ?? "Send failed" };
}

// ── Admin-triggered: pre-trip reminder, post-trip follow-up, change notice ──

export async function sendPreTripReminderAction(
  tourId: string
): Promise<Result> {
  await requireAdmin();
  const tour = await getTour(tourId);
  if (!tour) return { error: "Tour not found" };
  const lead = await getLead(tour.leadId);
  if (!lead) return { error: "Booking not found" };
  const email = lead.email?.trim();
  if (!email) return { error: "No guest email on booking" };

  const msDay = 24 * 60 * 60 * 1000;
  const daysUntil = Math.max(
    0,
    Math.round((new Date(tour.startDate).getTime() - Date.now()) / msDay)
  );
  const result = await sendPreTripReminderEmail({
    clientName: lead.name,
    clientEmail: email,
    packageName: tour.packageName,
    startDate: tour.startDate,
    daysUntil,
    reference: lead.reference,
  });

  await recordAuditEvent({
    entityType: "tour",
    entityId: tour.id,
    action: result.ok ? "pre_trip_reminder_emailed" : "pre_trip_reminder_email_failed",
    summary: result.ok
      ? `Pre-trip reminder sent to ${email}`
      : `Pre-trip reminder failed: ${result.error ?? "unknown"}`,
    details: [`Recipient: ${email}`, `Days until: ${daysUntil}`],
    metadata: {
      channel: "email",
      recipient: email,
      template: "pre_trip_reminder",
      status: result.ok ? "sent" : "failed",
      ...(result.ok ? {} : { error: result.error ?? "unknown" }),
    },
  });

  revalidatePath("/admin/communications");
  revalidatePath(`/admin/tours/${tour.id}`);
  return result.ok ? { success: true } : { error: result.error ?? "Send failed" };
}

export async function sendPostTripFollowUpAction(
  tourId: string
): Promise<Result> {
  await requireAdmin();
  const tour = await getTour(tourId);
  if (!tour) return { error: "Tour not found" };
  const lead = await getLead(tour.leadId);
  if (!lead) return { error: "Booking not found" };
  const email = lead.email?.trim();
  if (!email) return { error: "No guest email on booking" };

  const result = await sendPostTripFollowUpEmail({
    clientName: lead.name,
    clientEmail: email,
    packageName: tour.packageName,
    reference: lead.reference,
  });

  await recordAuditEvent({
    entityType: "tour",
    entityId: tour.id,
    action: result.ok ? "post_trip_followup_emailed" : "post_trip_followup_email_failed",
    summary: result.ok
      ? `Post-trip follow-up sent to ${email}`
      : `Post-trip follow-up failed: ${result.error ?? "unknown"}`,
    details: [`Recipient: ${email}`],
    metadata: {
      channel: "email",
      recipient: email,
      template: "post_trip_followup",
      status: result.ok ? "sent" : "failed",
      ...(result.ok ? {} : { error: result.error ?? "unknown" }),
    },
  });

  revalidatePath("/admin/communications");
  return result.ok ? { success: true } : { error: result.error ?? "Send failed" };
}

export async function sendBookingChangeNoticeAction(
  tourId: string,
  input: { changeType: "revision" | "cancellation"; summary: string }
): Promise<Result> {
  await requireAdmin();
  const tour = await getTour(tourId);
  if (!tour) return { error: "Tour not found" };
  const lead = await getLead(tour.leadId);
  if (!lead) return { error: "Booking not found" };
  const email = lead.email?.trim();
  if (!email) return { error: "No guest email on booking" };

  const result = await sendBookingChangeEmail({
    clientName: lead.name,
    clientEmail: email,
    packageName: tour.packageName,
    changeType: input.changeType,
    summary: input.summary,
    reference: lead.reference,
  });

  await recordAuditEvent({
    entityType: "tour",
    entityId: tour.id,
    action: result.ok ? "booking_change_notice_emailed" : "booking_change_notice_email_failed",
    summary: result.ok
      ? `${input.changeType === "cancellation" ? "Cancellation" : "Revision"} notice sent to ${email}`
      : `Change notice failed: ${result.error ?? "unknown"}`,
    details: [`Recipient: ${email}`, `Change: ${input.summary}`],
    metadata: {
      channel: "email",
      recipient: email,
      template: input.changeType === "cancellation" ? "booking_cancellation" : "booking_revision",
      status: result.ok ? "sent" : "failed",
      ...(result.ok ? {} : { error: result.error ?? "unknown" }),
    },
  });

  revalidatePath("/admin/communications");
  return result.ok ? { success: true } : { error: result.error ?? "Send failed" };
}

// ── Supplier-facing actions ───────────────────────────────────────────────

export async function sendSupplierRemittanceAction(
  paymentId: string
): Promise<Result> {
  await requireAdmin();
  const { getPayment, getHotels } = await import("@/lib/db");
  const payment = await getPayment(paymentId);
  if (!payment) return { error: "Payment not found" };
  if (payment.type !== "outgoing" || !payment.supplierId) {
    return { error: "Only outgoing supplier payments can be remitted." };
  }
  const suppliers = await getHotels();
  const supplier = suppliers.find((s) => s.id === payment.supplierId);
  const email = supplier?.email?.trim();
  if (!email) return { error: "Supplier has no email on file." };

  const result = await sendSupplierRemittanceEmail({
    supplierName: payment.supplierName || supplier?.name || "Supplier",
    supplierEmail: email,
    amount: payment.amount,
    currency: payment.currency,
    reference: payment.reference,
    date: payment.date,
    description: payment.description,
  });

  await recordAuditEvent({
    entityType: "payment",
    entityId: payment.id,
    action: result.ok ? "remittance_emailed" : "remittance_email_failed",
    summary: result.ok
      ? `Remittance advice sent to ${email}`
      : `Remittance email failed: ${result.error ?? "unknown"}`,
    details: [`Recipient: ${email}`, `Amount: ${payment.amount} ${payment.currency}`],
    metadata: {
      channel: "email",
      recipient: email,
      template: "supplier_remittance",
      status: result.ok ? "sent" : "failed",
      supplierName: payment.supplierName || supplier?.name,
      ...(result.ok ? {} : { error: result.error ?? "unknown" }),
    },
  });

  revalidatePath("/admin/communications");
  revalidatePath(`/admin/payments/${paymentId}`);
  return result.ok ? { success: true } : { error: result.error ?? "Send failed" };
}

export async function sendSupplierChangeNoticeAction(
  tourId: string,
  input: {
    supplierId: string;
    supplierName?: string;
    changeType: "update" | "cancellation";
    summary: string;
  }
): Promise<Result> {
  await requireAdmin();
  const { getHotels } = await import("@/lib/db");
  const tour = await getTour(tourId);
  if (!tour) return { error: "Tour not found" };
  const lead = await getLead(tour.leadId);
  if (!lead) return { error: "Booking not found" };
  const suppliers = await getHotels();
  const supplier = suppliers.find((s) => s.id === input.supplierId);
  if (!supplier) return { error: "Supplier not found." };
  const email = supplier.email?.trim();
  if (!email) return { error: "Supplier has no email on file." };

  const result = await sendSupplierScheduleUpdateEmail({
    supplierName: input.supplierName || supplier.name,
    supplierEmail: email,
    clientName: lead.name,
    reference: lead.reference || tour.id,
    changeType: input.changeType,
    summary: input.summary,
  });

  await recordAuditEvent({
    entityType: "tour",
    entityId: tour.id,
    action: result.ok ? "supplier_change_notice_emailed" : "supplier_change_notice_email_failed",
    summary: result.ok
      ? `${input.changeType === "cancellation" ? "Cancellation" : "Update"} sent to ${supplier.name}`
      : `Supplier change notice failed: ${result.error ?? "unknown"}`,
    details: [`Recipient: ${email}`, `Supplier: ${supplier.name}`, `Change: ${input.summary}`],
    metadata: {
      channel: "email",
      recipient: email,
      template: input.changeType === "cancellation" ? "supplier_cancellation" : "supplier_schedule_update",
      status: result.ok ? "sent" : "failed",
      supplierName: supplier.name,
      ...(result.ok ? {} : { error: result.error ?? "unknown" }),
    },
  });

  revalidatePath("/admin/communications");
  return result.ok ? { success: true } : { error: result.error ?? "Send failed" };
}

// ── Bulk retry ────────────────────────────────────────────────────────────

/**
 * Subset of `ResendEmailInput` the bulk-retry button posts per failed
 * row. We accept the audit-log `id` purely so the server can include
 * it in error reporting later if we need to — it's not used as a key
 * for fetching anything (we don't have a single-row audit-log getter
 * and the resend handlers only need the entity references below).
 */
export interface BulkRetryItem {
  id: string;
  template: ResendEmailInput["template"];
  invoiceId?: string;
  tourId?: string;
  leadId?: string;
  paymentId?: string;
  supplierEmail?: string;
  supplierName?: string;
}

export interface BulkRetryResult {
  ok: number;
  failed: number;
  /** Templates we deliberately can't resend without fresh admin input. */
  skipped: number;
  error?: string;
}

/**
 * Re-fire each resendable failed message in sequence. We do NOT
 * parallelize — the underlying resend handlers each touch Resend, the
 * audit log, and `revalidatePath`, and going wide would just rate-limit
 * us into more failures. Sequential keeps the audit trail clean too:
 * each retry's audit event lands before the next one starts.
 */
export async function retryFailedMessagesAction(
  items: BulkRetryItem[]
): Promise<BulkRetryResult> {
  await requireAdmin();
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: 0, failed: 0, skipped: 0 };
  }
  // Hard cap to keep a runaway click from holding the request open
  // forever — admins running a real flood should reload and retry the
  // remainder rather than queue 500 emails behind one button.
  const MAX = 50;
  const slice = items.slice(0, MAX);

  let ok = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of slice) {
    try {
      const result = await resendEmailAction({
        template: item.template,
        invoiceId: item.invoiceId,
        tourId: item.tourId,
        leadId: item.leadId,
        paymentId: item.paymentId,
        supplierEmail: item.supplierEmail,
        supplierName: item.supplierName,
      });
      if (result.success) {
        ok += 1;
      } else if (
        result.error === "This template cannot be resent from here."
      ) {
        skipped += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  revalidatePath("/admin/communications");
  return { ok, failed, skipped };
}

