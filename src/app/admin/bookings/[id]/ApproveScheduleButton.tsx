"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
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
            <span className="text-sm font-medium text-stone-700">Travel date (required)</span>
            <input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className="rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </label>
        )}
        <button
          type="button"
          onClick={handleApproveSchedule}
          disabled={pending || (!hasTravelDate && !manualDate.trim())}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
        >
          <Calendar className="h-4 w-4" />
          {pending ? "Scheduling…" : "Approve & Schedule tour"}
        </button>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
