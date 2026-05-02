"use client";

import { useState, useTransition } from "react";
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
  // Previously this button silently swallowed every failure: no error
  // state, no toast, just a button that flickered to "Processing…" and
  // back to "Paid". If the underlying action returned `{ error }` or
  // threw mid-call, the admin had zero feedback — and the payable
  // stayed in the unpaid list with no indication of why.
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      try {
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
        } else if (result?.error) {
          setError(result.error);
        } else {
          setError("Could not mark as paid. Please try again.");
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't reach the server. Please check your connection and try again."
        );
      }
    });
  };

  return (
    <div className="mt-8 rounded-xl border-2 border-[#e0e4dd] bg-[#f4ecdd] p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-[#11272b]">
            Mark as paid
          </h3>
          <p className="mt-1 text-sm text-[#5e7279]">
            Creates an outgoing payment record and removes this payable from the list.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-6 py-3 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f] disabled:opacity-50"
        >
          <CheckCircle2 className="h-5 w-5" />
          {pending ? "Processing…" : "Paid"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <p className="mt-3 text-xs text-[#5e7279]">
        You can view the payment and print a voucher from the Payments page.
      </p>
    </div>
  );
}
