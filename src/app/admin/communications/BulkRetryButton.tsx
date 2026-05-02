"use client";

/**
 * Bulk-retry control for the Failed KPI card.
 *
 * The server keeps the heavy lifting (looking up the audit log,
 * hydrating tour/lead/invoice/payment, calling the right `send*`
 * helper, writing a fresh audit event). This component just submits
 * the IDs the page already knows are failed in the current date range
 * and reports the rolled-up counts.
 *
 * One pass per click — we do NOT loop with backoff. If a retry fails
 * again (Resend down, supplier email bad, etc.) the new failure shows
 * up as its own row, and the admin can hit Retry again.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import {
  retryFailedMessagesAction,
  type ResendEmailInput,
} from "@/app/actions/communications";

interface FailedMessage {
  id: string;
  template: ResendEmailInput["template"];
  invoiceId?: string;
  tourId?: string;
  leadId?: string;
  paymentId?: string;
  recipient?: string;
  supplierName?: string;
}

export function BulkRetryButton({ messages }: { messages: FailedMessage[] }) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();

  if (messages.length === 0) return null;

  const handle = () => {
    if (
      !confirm(
        `Retry ${messages.length} failed message${
          messages.length === 1 ? "" : "s"
        }? Each one will be re-sent if it can be reconstructed from current data.`
      )
    )
      return;
    setToast(null);
    startTransition(async () => {
      try {
        const result = await retryFailedMessagesAction(
          messages.map((m) => ({
            id: m.id,
            template: m.template,
            invoiceId: m.invoiceId,
            tourId: m.tourId,
            leadId: m.leadId,
            paymentId: m.paymentId,
            supplierEmail: m.recipient,
            supplierName: m.supplierName,
          }))
        );
        if (result.error) {
          setToast(result.error);
          return;
        }
        // Build a tight summary that mentions only the non-zero buckets.
        const parts: string[] = [];
        if (result.ok) parts.push(`${result.ok} sent`);
        if (result.failed) parts.push(`${result.failed} failed`);
        if (result.skipped) parts.push(`${result.skipped} skipped`);
        setToast(parts.length > 0 ? parts.join(" · ") : "No work to do");
        router.refresh();
      } catch (err) {
        // If the bulk-retry action itself throws (network or server
        // crash), surface to the inline toast so admin sees something
        // actionable instead of the button silently resetting.
        setToast(
          err instanceof Error ? err.message : "Network error. Try again."
        );
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handle}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg border border-[#7c3a24] bg-[#fffbf4] px-2.5 py-1.5 text-xs font-semibold text-[#7c3a24] transition hover:bg-[#eed9cf] disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RotateCcw className="h-3.5 w-3.5" />
        )}
        {pending ? "Retrying…" : `Retry ${messages.length}`}
      </button>
      {toast && (
        <span className="max-w-[200px] truncate text-[11px] text-[#5e7279]">
          {toast}
        </span>
      )}
    </div>
  );
}
