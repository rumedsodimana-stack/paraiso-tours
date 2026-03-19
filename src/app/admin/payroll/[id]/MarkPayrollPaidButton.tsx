"use client";

import { useTransition } from "react";
import { CheckCircle } from "lucide-react";
import { markPayrollPaidAction } from "@/app/actions/payroll";

export function MarkPayrollPaidButton({ runId }: { runId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        startTransition(async () => {
          await markPayrollPaidAction(runId);
          window.location.reload();
        });
      }}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
    >
      <CheckCircle className="h-4 w-4" />
      {pending ? "Processing…" : "Mark as Paid"}
    </button>
  );
}
