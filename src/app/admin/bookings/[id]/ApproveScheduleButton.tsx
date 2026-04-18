"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { scheduleTourFromLeadAction } from "@/app/actions/tours";

interface ApproveScheduleButtonProps {
  leadId: string;
  hasTravelDate: boolean;
  travelDate?: string;
}

export function ApproveScheduleButton({ leadId, hasTravelDate, travelDate }: ApproveScheduleButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [manualDate, setManualDate] = useState("");

  const startDateToUse = hasTravelDate ? undefined : manualDate.trim() || undefined;

  const handleApproveSchedule = () => {
    setError(null);
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
        if (result?.id) {
          router.refresh();
          router.push("/admin/bookings?scheduled=1");
        } else if (result?.error) {
          setError(result.error);
        } else {
          setError("Something went wrong. Please try again.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to schedule tour");
      }
    });
  };

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
