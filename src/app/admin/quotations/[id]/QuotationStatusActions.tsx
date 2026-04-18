"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
} from "lucide-react";
import {
  markQuotationSentAction,
  markQuotationRejectedAction,
  acceptQuotationAction,
  deleteQuotationAction,
} from "@/app/actions/quotations";
import type { QuotationStatus } from "@/lib/types";

interface Props {
  quotationId: string;
  status: QuotationStatus;
  travelDate?: string;
  tourId?: string;
}

export function QuotationStatusActions({ quotationId, status, travelDate, tourId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [acceptDate, setAcceptDate] = useState(travelDate ?? "");

  const [emailWarning, setEmailWarning] = useState<string | null>(null);

  function run(fn: () => Promise<{ success?: boolean; tourId?: string; error?: string; emailSent?: boolean; emailError?: string } | undefined>) {
    setError(null);
    setEmailWarning(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) {
        setError(result.error);
      } else if (result?.tourId) {
        router.push(`/admin/tours/${result.tourId}?scheduled=1`);
      } else {
        if (result?.emailError) {
          setEmailWarning(`Quotation marked as sent, but the email could not be delivered: ${result.emailError}`);
        }
        router.refresh();
      }
    });
  }

  if (status === "accepted") {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Accepted — Tour Scheduled
        </div>
        {tourId && (
          <a
            href={`/admin/tours/${tourId}`}
            className="inline-flex items-center gap-2 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-sm font-medium text-[#11272b] hover:bg-[#f4ecdd]"
          >
            View Tour →
          </a>
        )}
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
        <XCircle className="h-4 w-4" />
        Rejected
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {emailWarning && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {emailWarning}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {/* Mark Sent */}
        {status === "draft" && (
          <button
            disabled={pending}
            onClick={() => run(() => markQuotationSentAction(quotationId))}
            className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-medium text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Mark as Sent
          </button>
        )}

        {/* Accept / Won */}
        <button
          disabled={pending}
          onClick={() => setShowAcceptDialog(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-4 py-2.5 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f] disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Accept & Schedule Tour
        </button>

        {/* Reject */}
        <button
          disabled={pending}
          onClick={() => {
            if (confirm("Mark this quotation as rejected?")) {
              run(() => markQuotationRejectedAction(quotationId));
            }
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-sm font-medium text-[#5e7279] transition hover:bg-[#f4ecdd] disabled:opacity-50"
        >
          <XCircle className="h-4 w-4" />
          Reject
        </button>
      </div>

      {/* Accept Dialog */}
      {showAcceptDialog && (
        <div className="rounded-2xl border border-[#e0e4dd] bg-[#f4ecdd] p-5">
          <h3 className="mb-1 font-semibold text-[#11272b]">Confirm: Accept Quotation</h3>
          <p className="mb-4 text-sm text-[#5e7279]">
            This will create a lead, schedule a tour, and generate an invoice and payment record.
          </p>
          <div className="mb-4 flex items-center gap-3">
            <Calendar className="h-4 w-4 shrink-0 text-[#12343b]" />
            <div>
              <label className="block text-xs font-medium text-[#11272b]">Travel Start Date</label>
              <input
                type="date"
                value={acceptDate}
                onChange={(e) => setAcceptDate(e.target.value)}
                className="mt-1 rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-3 py-1.5 text-sm text-[#11272b] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
              />
              {!acceptDate && (
                <p className="mt-1 text-xs text-[#5e7279]">Required — set a start date for the tour</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              disabled={pending || !acceptDate}
              onClick={() => run(() => acceptQuotationAction(quotationId, acceptDate))}
              className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-4 py-2 text-sm font-medium text-[#f6ead6] hover:bg-[#1a474f] disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirm & Schedule
            </button>
            <button
              onClick={() => setShowAcceptDialog(false)}
              className="rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2 text-sm font-medium text-[#5e7279] hover:bg-[#f4ecdd]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
