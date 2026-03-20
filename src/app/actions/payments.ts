"use server";

import { revalidatePath } from "next/cache";
import { getPayment, getInvoice, updatePayment, updateInvoice } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";

/** Mark payment as received/completed and sync linked invoice to paid */
export async function markPaymentReceived(paymentId: string): Promise<{ success?: boolean; error?: string }> {
  const payment = await getPayment(paymentId);
  if (!payment) return { error: "Payment not found" };
  if (payment.status === "completed") return { success: true };

  await updatePayment(paymentId, { status: "completed" });

  await recordAuditEvent({
    entityType: "payment",
    entityId: payment.id,
    action: "marked_received",
    summary: `Payment marked received: ${payment.amount} ${payment.currency}`,
    details: [payment.description],
  });

  // Sync: update linked invoice to paid
  if (payment.invoiceId) {
    const invoice = await getInvoice(payment.invoiceId);
    if (invoice && invoice.status !== "paid") {
      await updateInvoice(payment.invoiceId, {
        status: "paid",
        paidAt: new Date().toISOString().slice(0, 10),
      });
      await recordAuditEvent({
        entityType: "invoice",
        entityId: invoice.id,
        action: "status_changed",
        summary: `Invoice ${invoice.invoiceNumber} marked paid from payment receipt`,
      });
    }
  }

  revalidatePath("/admin/payments");
  revalidatePath(`/admin/payments/${paymentId}`);
  revalidatePath("/admin/invoices");
  if (payment.invoiceId) revalidatePath(`/admin/invoices/${payment.invoiceId}`);
  return { success: true };
}
