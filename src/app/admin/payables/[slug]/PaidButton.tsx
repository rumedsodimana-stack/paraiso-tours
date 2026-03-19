"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { markPayablePaidAction } from "@/app/actions/payables";

interface PaidButtonProps {
  supplierId: string;
  supplierName: string;
  amount: number;
  currency: string;
  startDate: string;
  endDate: string;
}

export function PaidButton({
  supplierId,
  supplierName,
  amount,
  currency,
  startDate,
  endDate,
}: PaidButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await markPayablePaidAction({
        supplierId,
        supplierName,
        amount,
        currency,
        startDate,
        endDate,
      });
      if (result?.success && result.paymentId) {
        router.push(`/admin/payments?paid=1#${result.paymentId}`);
      }
    });
  };

  return (
    <div className="mt-8 rounded-xl border-2 border-teal-200 bg-teal-50/50 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-stone-900">
            Mark as paid
          </h3>
          <p className="mt-1 text-sm text-stone-600">
            Creates an outgoing payment record and removes this payable from the list.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
        >
          <CheckCircle2 className="h-5 w-5" />
          {pending ? "Processing…" : "Paid"}
        </button>
      </div>
      <p className="mt-3 text-xs text-stone-500">
        You can view the payment and print a voucher from the Payments page.
      </p>
    </div>
  );
}
