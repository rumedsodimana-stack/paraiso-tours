"use server";

import { revalidatePath } from "next/cache";
import {
  getLead,
  getPackage,
  getHotels,
  getInvoice,
  getInvoiceByLeadId,
  createInvoice,
  updateInvoice,
  getPayment,
  getPayments,
  createLead,
  updateLead,
  updatePayment,
} from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { getLeadBookingFinancials } from "@/lib/booking-pricing";
import { generateDocumentNumber } from "@/lib/document-number";
import {
  createPackageSnapshotFromLead,
  resolveLeadPackage,
} from "@/lib/package-snapshot";
import type { InvoiceStatus } from "@/lib/types";

export async function createInvoiceFromLead(leadId: string) {
  const lead = await getLead(leadId);
  if (!lead) return { error: "Lead not found" };

  const existing = await getInvoiceByLeadId(leadId);
  if (existing) return { success: true, invoiceId: existing.id, created: false };

  if (!lead.packageId && !lead.packageSnapshot) {
    return { error: "Lead has no package selected" };
  }

  const [livePackage, suppliers] = await Promise.all([
    lead.packageId ? getPackage(lead.packageId) : Promise.resolve(null),
    getHotels(),
  ]);
  if (!lead.packageSnapshot && livePackage) {
    const snappedLead = await updateLead(lead.id, {
      packageSnapshot: createPackageSnapshotFromLead(lead, livePackage),
    });
    if (snappedLead) {
      lead.packageSnapshot = snappedLead.packageSnapshot;
    } else {
      lead.packageSnapshot = createPackageSnapshotFromLead(lead, livePackage);
    }
  }
  const pkg = resolveLeadPackage(lead, livePackage);
  if (!pkg) return { error: "Package not found" };

  const financials = getLeadBookingFinancials(lead, pkg, suppliers);
  const breakdown = financials.breakdown;
  const invoiceNumber = generateDocumentNumber("INV");
  const lineItems =
    breakdown?.supplierItems.map((item) => {
      const typeLabel =
        item.supplierType === "hotel"
          ? "Accommodation"
          : item.supplierType === "transport"
            ? "Transport"
            : "Meals";
      return {
        description: `${typeLabel}: ${item.optionLabel}`,
        amount: item.amount,
      };
    }) ?? [];

  if (financials.adjustmentAmount !== 0) {
    lineItems.push({
      description: "Booked total adjustment",
      amount: financials.adjustmentAmount,
    });
  }

  const invoice = await createInvoice({
    leadId: lead.id,
    reference: lead.reference,
    invoiceNumber,
    status: "pending_payment",
    clientName: lead.name,
    clientEmail: lead.email,
    clientPhone: lead.phone,
    packageName: pkg.name,
    travelDate: lead.travelDate,
    pax: lead.pax,
    baseAmount: breakdown?.baseAmount ?? financials.totalPrice,
    lineItems,
    totalAmount: financials.totalPrice,
    currency: breakdown?.currency ?? pkg.currency,
  });

  await recordAuditEvent({
    entityType: "invoice",
    entityId: invoice.id,
    action: "created",
    summary: `Invoice created: ${invoice.invoiceNumber}`,
    details: [
      `Client: ${invoice.clientName}`,
      `Total: ${invoice.totalAmount} ${invoice.currency}`,
      `Lead reference: ${lead.reference ?? lead.id}`,
    ],
  });

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${invoice.id}`);
  revalidatePath(`/admin/bookings/${leadId}`);
  return { success: true, invoiceId: invoice.id, created: true };
}

export async function updateInvoiceStatus(invoiceId: string, status: InvoiceStatus): Promise<{ success?: boolean; error?: string }> {
  const updates: { status: InvoiceStatus; paidAt?: string } = { status };
  if (status === "paid") {
    updates.paidAt = new Date().toISOString().slice(0, 10);
  }
  const updated = await updateInvoice(invoiceId, updates);
  if (!updated) return { error: "Invoice not found" };

  await recordAuditEvent({
    entityType: "invoice",
    entityId: updated.id,
    action: "status_changed",
    summary: `Invoice ${updated.invoiceNumber} marked ${status.replace(/_/g, " ")}`,
  });

  // Sync: when invoice is marked paid, update linked payments to completed
  if (status === "paid") {
    const payments = await getPayments();
    for (const p of payments) {
      if (p.invoiceId === invoiceId && p.status !== "completed") {
        await updatePayment(p.id, { status: "completed" });
      }
    }
  }

  revalidatePath("/admin/invoices");
  revalidatePath("/admin/invoices/[id]", "page");
  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath("/admin/payments");
  revalidatePath(`/admin/payments/[id]`, "page");
  revalidatePath(`/admin/bookings/${updated.leadId}`);
  return { success: true };
}

/**
 * Create an invoice/voucher directly from a payment (incoming or outgoing).
 * For incoming: client is the payer. For outgoing: clientName is the payee (supplier).
 */
export async function createInvoiceFromPayment(paymentId: string) {
  const payment = await getPayment(paymentId);
  if (!payment) return { error: "Payment not found" };

  if (payment.invoiceId) {
    const existing = await getInvoice(payment.invoiceId);
    if (existing) return { success: true, invoiceId: existing.id };
  }

  const invoiceNumber = generateDocumentNumber(
    payment.type === "outgoing" ? "PAY" : "INV"
  );

  const clientName =
    payment.type === "outgoing"
      ? (payment.supplierName || payment.description || "Supplier").trim()
      : (payment.clientName?.trim() || "Client");
  const email =
    payment.type === "outgoing"
      ? `pay-${paymentId.slice(-8)}@payment.paraiso.lk`
      : payment.reference
        ? `${payment.reference.toLowerCase().replace(/\s/g, "_")}@payment.paraiso.lk`
        : "client@payment.paraiso.lk";

  const lead = await createLead({
    name: clientName,
    email,
    phone: "",
    source: payment.type === "outgoing" ? "Supplier payment" : "Payment record",
    status: "won",
  });

  const description =
    payment.type === "outgoing"
      ? (payment.description || `Payment to ${clientName}`)
      : (payment.description || "Payment received");

  const invoice = await createInvoice({
    leadId: lead.id,
    reference: payment.reference,
    invoiceNumber,
    status: payment.status === "completed" ? "paid" : "pending_payment",
    clientName,
    clientEmail: lead.email,
    clientPhone: lead.phone || undefined,
    packageName: payment.type === "outgoing" ? "Supplier payment" : (payment.description || "Tour / Service"),
    baseAmount: payment.amount,
    lineItems: [{ description, amount: payment.amount }],
    totalAmount: payment.amount,
    currency: payment.currency,
  });

  await updatePayment(paymentId, { leadId: lead.id, invoiceId: invoice.id });

  await recordAuditEvent({
    entityType: "invoice",
    entityId: invoice.id,
    action: "created_from_payment",
    summary: `Invoice created from payment: ${invoice.invoiceNumber}`,
    details: [
      `Payment amount: ${payment.amount} ${payment.currency}`,
      `Payment type: ${payment.type}`,
    ],
  });

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${invoice.id}`);
  revalidatePath(`/admin/payments`);
  revalidatePath(`/admin/payments/${paymentId}`);
  return { success: true, invoiceId: invoice.id };
}
