"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

const TEMPLATE_OPTIONS = [
  { value: "all", label: "All templates" },
  { value: "tour_confirmation_with_invoice", label: "Tour confirmation" },
  { value: "supplier_reservation", label: "Supplier reservation" },
  { value: "payment_receipt", label: "Payment receipt" },
  { value: "invoice", label: "Invoice" },
  { value: "itinerary", label: "Itinerary" },
];

export function CommunicationsFilters({
  status,
  template,
  query,
}: {
  status: string;
  template: string;
  query: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

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
      <div className="flex items-center gap-1 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] p-1">
        {[
          { value: "all", label: "All" },
          { value: "sent", label: "Sent" },
          { value: "failed", label: "Failed" },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
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

      <select
        value={template}
        onChange={(e) => push({ template: e.target.value })}
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
          onKeyDown={(e) => {
            if (e.key === "Enter") push({ q: e.currentTarget.value.trim() || undefined });
          }}
          className="w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] pl-9 pr-3 py-2 text-sm text-[#11272b] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
        />
      </div>
    </div>
  );
}
