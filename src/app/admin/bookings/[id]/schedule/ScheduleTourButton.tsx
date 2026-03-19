"use client";

import { useState, useTransition } from "react";
import { Calendar } from "lucide-react";
import { scheduleTourFromLeadAction } from "@/app/actions/tours";

interface ScheduleTourButtonProps {
  leadId: string;
  hasTravelDate: boolean;
}

export function ScheduleTourButton({ leadId, hasTravelDate }: ScheduleTourButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");

  const handleSchedule = () => {
    setError(null);
    const dateToUse = hasTravelDate ? undefined : startDate;
    if (!hasTravelDate && !startDate.trim()) {
      setError("Please select a start date");
      return;
    }
    startTransition(async () => {
      const result = await scheduleTourFromLeadAction(leadId, dateToUse || undefined);
      if (result?.id) {
        if (result.warnings?.length) {
          window.location.href = `/admin/tours/${result.id}`;
          return;
        }
        window.location.href = "/admin/calendar?saved=1";
      } else if (result?.error) {
        setError(result.error);
      }
    });
  };

  if (hasTravelDate) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={handleSchedule}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
        >
          <Calendar className="h-4 w-4" />
          {pending ? "Scheduling…" : "Schedule Tour"}
        </button>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label htmlFor="startDate" className="block text-sm font-medium text-stone-700">
        Start date (booking has no travel date)
      </label>
      <input
        id="startDate"
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        className="rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
      />
      <button
        type="button"
        onClick={handleSchedule}
        disabled={pending || !startDate}
        className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
      >
        <Calendar className="h-4 w-4" />
        {pending ? "Scheduling…" : "Schedule Tour"}
      </button>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
