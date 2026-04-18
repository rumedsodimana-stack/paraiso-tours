"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { markPaymentReceived } from "@/app/actions/payments";

export function MarkReceivedButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#dce8dc] px-3 py-1.5 text-xs font-semibold text-[#375a3f]">
        <CheckCircle2 className="h-3.5 w-3.5" /> Received
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await markPaymentReceived(paymentId);
            if (result.success) {
              setDone(true);
              router.refresh();
            } else {
              setError(result.error ?? "Failed");
            }
          });
        }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#12343b] px-3 py-1.5 text-xs font-semibold text-[#f6ead6] transition hover:bg-[#0f2b31] disabled:opacity-60"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {pending ? "Marking…" : "Mark Received"}
      </button>
      {error && <p className="text-[10px] text-[#7c3a24]">{error}</p>}
    </div>
  );
}
