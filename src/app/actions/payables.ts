"use server";

import { revalidatePath } from "next/cache";
import { createPayment } from "@/lib/db";

export async function markPayablePaidAction(params: {
  supplierId: string;
  supplierName: string;
  amount: number;
  currency: string;
  startDate: string;
  endDate: string;
}): Promise<{ success: boolean; paymentId?: string; error?: string }> {
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

    revalidatePath("/admin/payables");
    revalidatePath("/admin/payments");
    return { success: true, paymentId: payment.id };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Failed to mark payable as paid",
    };
  }
}
