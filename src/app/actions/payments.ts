"use server";

import { revalidatePath } from "next/cache";
import { getPayment, getInvoice, updatePayment, updateInvoice } from "@/lib/db";

/** Mark payment as received/completed and sync linked invoice to paid */
export async function markPaymentReceived(paymentId: string): Promise<{ success?: boolean; error?: string }> {
  const payment = await getPayment(paymentId);
  if (!payment) return { error: "Payment not found" };
  if (payment.status === "completed") return { success: true };

  await updatePayment(paymentId, { status: "completed" });

  // Sync: update linked invoice to paid
  if (payment.invoiceId) {
    const invoice = await getInvoice(payment.invoiceId);
    if (invoice && invoice.status !== "paid") {
      await updateInvoice(payment.invoiceId, {
        status: "paid",
        paidAt: new Date().toISOString().slice(0, 10),
      });
    }
  }

  revalidatePath("/admin/payments");
  revalidatePath(`/admin/payments/${paymentId}`);
  revalidatePath("/admin/invoices");
  if (payment.invoiceId) revalidatePath(`/admin/invoices/${payment.invoiceId}`);
  return { success: true };
}
