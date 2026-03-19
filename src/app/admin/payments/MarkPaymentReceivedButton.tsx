"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { markPaymentReceived } from "@/app/actions/payments";

export function MarkPaymentReceivedButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const result = await markPaymentReceived(paymentId);
    setLoading(false);
    if (result?.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-70"
    >
      <CheckCircle className="h-4 w-4" />
      {loading ? "Updating…" : "Mark as received"}
    </button>
  );
}
