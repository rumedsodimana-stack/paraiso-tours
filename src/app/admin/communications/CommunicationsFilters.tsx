"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

// Kept aligned with `MessageTemplate` in page.tsx. The `value` is what
// the row's `template` field holds; the `label` is the admin-facing
// short form (we drop "(with invoice)" from tour confirmation here so
// the dropdown stays compact — the table still shows the long label).
const TEMPLATE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "all", label: "All templates" },
  { value: "tour_confirmation_with_invoice", label: "Tour confirmation" },
  { value: "supplier_reservation", label: "Supplier reservation" },
  { value: "payment_receipt", label: "Payment receipt" },
  { value: "invoice", label: "Invoice" },
  { value: "itinerary", label: "Itinerary" },
  { value: "pre_trip_reminder", label: "Pre-trip reminder" },
  { value: "post_trip_followup", label: "Post-trip follow-up" },
  { value: "booking_revision", label: "Booking revision" },
  { value: "booking_cancellation", label: "Booking cancellation" },
  { value: "supplier_remittance", label: "Supplier remittance" },
  { value: "supplier_schedule_update", label: "Supplier schedule update" },
  { value: "supplier_cancellation", label: "Supplier cancellation" },
  { value: "internal_new_booking", label: "Internal new-booking alert" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "skipped", label: "Skipped" },
];

const RANGE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All time" },
];

export function CommunicationsFilters({
  status,
  template,
  query,
  range,
}: {
  status: string;
  template: string;
  query: string;
  range: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  // Note: `range` is treated specially — `"30d"` is the *default*, so
  // omitting the param means 30d. We still write it to the URL when the
  // user picks it explicitly so navigations from elsewhere (e.g. an "all
  // time" link) round-trip cleanly.
  const push = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params?.toString() ?? "");
    for (const [key, val] of Object.entries(overrides)) {
      if (!val || val === "all") next.delete(key);
      else next.set(key, val);
    }
    router.push(`/admin/communications?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status pill group */}
      <div
        role="tablist"
        aria-label="Filter by status"
        className="flex items-center gap-1 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] p-1"
      >
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={status === opt.value}
            onClick={() => push({ status: opt.value })}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              status === opt.value
                ? "bg-[#12343b] text-[#f6ead6]"
                : "text-[#5e7279] hover:bg-[#f4ecdd] hover:text-[#11272b]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Date-range pill group — separate from status so an admin can
          pivot between "what's broken right now" (failed + 7d) and
          "what's happened all month" (all + 30d) without losing the
          other filter. */}
      <div
        role="tablist"
        aria-label="Filter by date"
        className="flex items-center gap-1 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] p-1"
      >
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={range === opt.value}
            onClick={() => push({ range: opt.value })}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              range === opt.value
                ? "bg-[#7a5a17] text-[#f6ead6]"
                : "text-[#5e7279] hover:bg-[#f4ecdd] hover:text-[#11272b]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <select
        value={template}
        onChange={(e) => push({ template: e.target.value })}
        aria-label="Filter by template"
        className="rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm font-medium text-[#11272b] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
      >
        {TEMPLATE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <div className="relative flex-1 min-w-[220px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a9ba1]" />
        <input
          type="search"
          placeholder="Search recipient or summary…"
          defaultValue={query}
          aria-label="Search messages"
          onKeyDown={(e) => {
            if (e.key === "Enter") push({ q: e.currentTarget.value.trim() || undefined });
          }}
          className="w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] pl-9 pr-3 py-2 text-sm text-[#11272b] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
        />
      </div>
    </div>
  );
}
