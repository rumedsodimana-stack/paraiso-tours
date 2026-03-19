"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { markTourCompletedPaidAction } from "@/app/actions/tours";

interface CompletedPaidButtonProps {
  tourId: string;
  tourStatus: string;
}

export function CompletedPaidButton({ tourId, tourStatus }: CompletedPaidButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (tourStatus === "completed") {
    return null;
  }

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      const result = await markTourCompletedPaidAction(tourId);
      if (result?.success) {
        router.refresh();
        if (result.paymentId) {
          router.push(`/admin/payments?completed=1#${result.paymentId}`);
        }
      } else if (result?.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="mt-8 rounded-xl border-2 border-teal-200 bg-teal-50/50 p-6 print:hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-stone-900">
            Mark journey as completed & paid
          </h3>
          <p className="mt-1 text-sm text-stone-600">
            Updates tour status, marks payment as received, sends receipt to client, and moves to Payments.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
        >
          <CheckCircle2 className="h-5 w-5" />
          {pending ? "Processing…" : "Completed / Paid"}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-rose-600">{error}</p>
      )}
      <p className="mt-3 text-xs text-stone-500">
        From Payments you can{" "}
        <Link href="/admin/payments" className="text-teal-600 hover:underline">
          generate an invoice
        </Link>{" "}
        for each transaction.
      </p>
    </div>
  );
}
