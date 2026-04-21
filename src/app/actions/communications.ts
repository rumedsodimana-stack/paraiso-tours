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
} from "@/lib/email";
import { resolveTourPackage } from "@/lib/package-snapshot";
import { generateItineraryPdf } from "@/lib/itinerary-pdf";

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

