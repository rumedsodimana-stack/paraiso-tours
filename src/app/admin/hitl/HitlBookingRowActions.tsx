"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { updateLeadStatusAction } from "@/app/actions/leads";

export function HitlBookingRowActions({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const run = (status: "scheduled" | "cancelled", label: string) => {
    if (!confirm(`${label} this booking?`)) return;
    setToast(null);
    startTransition(async () => {
      try {
        const result = await updateLeadStatusAction(leadId, status);
        if (result?.success) {
          setToast(`Marked ${status}`);
          router.refresh();
        } else {
          setToast(result?.error ?? "Failed");
        }
      } catch (err) {
        setToast(
          err instanceof Error ? err.message : "Network error. Try again."
        );
      }
    });
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          run("scheduled", "Approve");
        }}
        className="inline-flex items-center gap-1 rounded-lg border border-[#dce8dc] bg-[#dce8dc]/40 px-2 py-1 text-xs font-semibold text-[#375a3f] transition hover:bg-[#dce8dc] disabled:opacity-50"
        title="Approve & schedule"
      >
        <CheckCircle2 className="h-3 w-3" />
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          run("cancelled", "Reject / cancel");
        }}
        className="inline-flex items-center gap-1 rounded-lg border border-[#eed9cf] bg-[#eed9cf]/40 px-2 py-1 text-xs font-semibold text-[#7c3a24] transition hover:bg-[#eed9cf] disabled:opacity-50"
        title="Reject & mark cancelled"
      >
        <XCircle className="h-3 w-3" />
        Reject
      </button>
      {toast && <span className="ml-1 text-xs text-[#5e7279]">{toast}</span>}
    </div>
  );
}
