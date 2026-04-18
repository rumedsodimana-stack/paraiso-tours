"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

  if (tourStatus === "completed") return null;

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
    <div className="rounded-2xl border-2 border-[#f3e8ce] bg-[#f9f2e3] p-6 print:hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-[#11272b]">Mark journey as completed &amp; paid</h3>
          <p className="mt-1 text-sm text-[#5e7279]">
            Updates tour status, marks guest payment received, sends receipt email, and records in Payment History.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#12343b] px-6 py-3 text-sm font-bold text-[#f6ead6] transition hover:bg-[#0f2b31] disabled:opacity-50"
        >
          <CheckCircle2 className="h-5 w-5" />
          {pending ? "Processing…" : "Completed / Guest Paid"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-[#7c3a24]">{error}</p>}
    </div>
  );
}
