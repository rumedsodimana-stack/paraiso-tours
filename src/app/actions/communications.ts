"use server";

import { revalidatePath } from "next/cache";
import {
  getInvoice,
  getInvoiceByLeadId,
  getLead,
  getPackage,
  getPaymentByTourId,
  getTour,
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
  template:
    | "tour_confirmation_with_invoice"
    | "supplier_reservation"
    | "payment_receipt"
    | "invoice"
    | "itinerary"
    | "other";
  invoiceId?: string;
  tourId?: string;
  leadId?: string;
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
      default:
        return { error: "This template cannot be resent from here." };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
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
  const result = await sendTourConfirmationWithInvoice({
    clientName: lead.name,
    clientEmail: email,
    packageName: tour.packageName,
    startDate: tour.startDate,
    endDate: tour.endDate,
    pax: tour.pax,
    reference: lead.reference,
    invoice: invoice ?? undefined,
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

