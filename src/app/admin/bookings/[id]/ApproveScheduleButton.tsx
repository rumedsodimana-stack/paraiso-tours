"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { scheduleTourFromLeadAction } from "@/app/actions/tours";

interface ApproveScheduleButtonProps {
  leadId: string;
  hasTravelDate: boolean;
}

export function ApproveScheduleButton({ leadId, hasTravelDate }: ApproveScheduleButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [manualDate, setManualDate] = useState("");
  // When scheduling succeeds with warnings (e.g. RESEND_API_KEY missing,
  // availability conflicts, invoice creation deferred), we hold here
  // and surface them BEFORE redirecting. Otherwise the admin would land
  // on the tour page assuming everything went out, when in reality some
  // emails were skipped or some sub-step needs follow-up.
  const [postScheduleWarnings, setPostScheduleWarnings] = useState<{
    tourId: string;
    warnings: string[];
  } | null>(null);

  const handleApproveSchedule = () => {
    setError(null);
    setPostScheduleWarnings(null);
    if (!hasTravelDate && !manualDate.trim()) {
      setError("Please select a travel date first (or set it in Edit booking)");
      return;
    }
    startTransition(async () => {
      try {
        const result = await scheduleTourFromLeadAction(
          leadId,
          hasTravelDate ? undefined : manualDate.trim()
        );
        if (result?.error) {
          setError(result.error);
          return;
        }
        if (!result?.id) {
          setError("Something went wrong. Please try again.");
          return;
        }
        const warnings = result.warnings ?? [];
        if (warnings.length > 0) {
          // Hold the redirect so the admin sees what was skipped or
          // needs follow-up. They can click "Continue" to proceed.
          setPostScheduleWarnings({ tourId: result.id, warnings });
          return;
        }
        window.location.href = `/admin/tours/${result.id}?scheduled=1`;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to schedule tour");
      }
    });
  };

  // Once we have warnings to show, render the warning panel + a
  // single Continue affordance. We keep the form fields hidden
  // because the action already succeeded — no need to re-arm them.
  if (postScheduleWarnings) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-[#e9d49a] bg-[#fdf4dd] p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#a06b15]" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-semibold text-[#7d5a13]">
              Tour scheduled with warnings
            </p>
            <p className="text-xs text-[#7d5a13]">
              The booking moved to Scheduled Tours and core records (payment,
              payables) were created. The following items need follow-up:
            </p>
            <ul className="ml-1 list-disc space-y-1 pl-4 text-xs text-[#7d5a13]">
              {postScheduleWarnings.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/admin/tours/${postScheduleWarnings.tourId}?scheduled=1`}
            className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-4 py-2 text-sm font-semibold text-[#f6ead6] transition hover:bg-[#0f2b31]"
          >
            Continue to tour
          </a>
          <a
            href="/admin/communications"
            className="inline-flex items-center gap-2 rounded-xl border border-[#e9d49a] bg-[#fffbf4] px-4 py-2 text-sm font-medium text-[#7d5a13] transition hover:bg-[#fdf4dd]"
          >
            Review communications
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {!hasTravelDate && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[#5e7279]">Travel date (required)</span>
            <input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className="rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
            />
          </label>
        )}
        <button
          type="button"
          onClick={handleApproveSchedule}
          disabled={pending || (!hasTravelDate && !manualDate.trim())}
          className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-5 py-2.5 text-sm font-bold text-[#f6ead6] transition hover:bg-[#0f2b31] disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          {pending ? "Scheduling…" : "Approve & Schedule Tour"}
        </button>
      </div>
      {error && <p className="text-sm text-[#7c3a24]">{error}</p>}
    </div>
  );
}
