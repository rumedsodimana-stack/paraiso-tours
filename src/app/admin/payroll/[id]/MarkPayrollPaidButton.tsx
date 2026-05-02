"use client";

import { useState, useTransition } from "react";
import { CheckCircle } from "lucide-react";
import { markPayrollPaidAction } from "@/app/actions/payroll";

export function MarkPayrollPaidButton({ runId }: { runId: string }) {
  const [pending, startTransition] = useTransition();
  // Previously this button blindly assumed success and reloaded the
  // page. If the action errored or threw, the page just reloaded with
  // unchanged state and the admin had no signal. Now: errors surface,
  // the page only reloads on success.
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const result = await markPayrollPaidAction(runId);
              // Older action signatures returned void; treat that as
              // success and reload. Newer signatures return
              // { success, error } — surface error if present.
              if (result && "error" in result && result.error) {
                setError(result.error);
                return;
              }
              window.location.reload();
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Couldn't reach the server. Please check your connection and try again."
              );
            }
          });
        }}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        <CheckCircle className="h-4 w-4" />
        {pending ? "Processing…" : "Mark as Paid"}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
