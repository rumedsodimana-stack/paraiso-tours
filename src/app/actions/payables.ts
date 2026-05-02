"use server";

import { revalidatePath } from "next/cache";
import { createPayment, extractErrorMessage } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-session";

/**
 * Mark a weekly supplier payable as paid by recording an outgoing
 * payment with the matching `payable_week_start` / `payable_week_end`
 * markers. The /admin/payables aggregation uses those markers to filter
 * the supplier+week combo out of the "still owed" list — so writing
 * them is the canonical signal that the payable is settled.
 *
 * On success we also record an audit event so /admin/communications
 * shows the action (with admin who clicked + amount). On failure we
 * record a failed-action event with the underlying Supabase / network
 * error message — never a generic "something went wrong" — so the
 * admin can act on the real cause.
 */
export async function markPayablePaidAction(params: {
  supplierId: string;
  supplierName: string;
  amount: number;
  currency: string;
  startDate: string;
  endDate: string;
}): Promise<{ success: boolean; paymentId?: string; error?: string }> {
  await requireAdmin();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const payment = await createPayment({
      type: "outgoing",
      amount: params.amount,
      currency: params.currency,
      description: `Supplier payment – ${params.supplierName} (${params.startDate} – ${params.endDate})`,
      supplierId: params.supplierId,
      supplierName: params.supplierName,
      status: "completed",
      date: today,
      payableWeekStart: params.startDate,
      payableWeekEnd: params.endDate,
    });

    await recordAuditEvent({
      entityType: "payment",
      entityId: payment.id,
      action: "payable_marked_paid",
      summary: `Payable marked paid: ${params.supplierName} — ${params.amount.toLocaleString()} ${params.currency}`,
      details: [
        `Supplier: ${params.supplierName}`,
        `Week: ${params.startDate} → ${params.endDate}`,
        `Amount: ${params.amount.toLocaleString()} ${params.currency}`,
      ],
      metadata: {
        supplierId: params.supplierId,
        amount: params.amount,
        currency: params.currency,
        payableWeekStart: params.startDate,
        payableWeekEnd: params.endDate,
      },
    });

    revalidatePath("/admin/payables");
    revalidatePath("/admin/payments");
    return { success: true, paymentId: payment.id };
  } catch (err) {
    const errMsg = extractErrorMessage(err);
    // Record the failure so the admin sees in /admin/communications
    // (or audit log) that a payable mark-paid attempt failed —
    // otherwise a transient FK / RLS / network error would silently
    // leave the payable in the "owed" list and admin would only
    // notice when the supplier complained.
    try {
      await recordAuditEvent({
        entityType: "payment",
        entityId: `payable:${params.supplierId}:${params.startDate}`,
        action: "payable_mark_paid_failed",
        summary: `Mark-paid failed for ${params.supplierName}: ${errMsg}`,
        details: [
          `Supplier: ${params.supplierName}`,
          `Week: ${params.startDate} → ${params.endDate}`,
          `Amount: ${params.amount.toLocaleString()} ${params.currency}`,
          `Error: ${errMsg}`,
        ],
        metadata: {
          supplierId: params.supplierId,
          amount: params.amount,
          currency: params.currency,
          payableWeekStart: params.startDate,
          payableWeekEnd: params.endDate,
          error: errMsg,
        },
      });
    } catch {
      // Don't shadow the original error — if audit logging itself
      // fails, the user still gets the real underlying cause.
    }
    return {
      success: false,
      error: errMsg,
    };
  }
}
