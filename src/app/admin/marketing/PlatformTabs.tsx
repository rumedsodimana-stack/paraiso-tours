"use client";

import Link from "next/link";

const PLATFORMS = [
  { id: "all", label: "All", emoji: "✨" },
  { id: "instagram", label: "Instagram", emoji: "📸" },
  { id: "facebook", label: "Facebook", emoji: "📘" },
  { id: "x", label: "X", emoji: "𝕏" },
  { id: "linkedin", label: "LinkedIn", emoji: "💼" },
] as const;

const STATUSES = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "approved", label: "Approved" },
  { id: "posted", label: "Posted" },
  { id: "archived", label: "Archived" },
];

interface PlatformTabsProps {
  platform: string;
  status: string;
  counts: { all: number; instagram: number; facebook: number; x: number; linkedin: number };
}

export function PlatformTabs({ platform, status, counts }: PlatformTabsProps) {
  // Build URL preserving the other filter so admin can pivot freely.
  const buildUrl = (next: { platform?: string; status?: string }) => {
    const params = new URLSearchParams();
    const p = next.platform ?? platform;
    const s = next.status ?? status;
    if (p && p !== "all") params.set("platform", p);
    if (s && s !== "all") params.set("status", s);
    const qs = params.toString();
    return `/admin/marketing${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="tablist"
        aria-label="Filter by platform"
        className="flex items-center gap-1 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] p-1"
      >
        {PLATFORMS.map((p) => {
          const active = platform === p.id;
          const count = counts[p.id as keyof typeof counts];
          return (
            <Link
              key={p.id}
              href={buildUrl({ platform: p.id })}
              role="tab"
              aria-selected={active}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-[#5e3aa3] text-[#f6ead6]"
                  : "text-[#5e7279] hover:bg-[#f4ecdd] hover:text-[#11272b]"
              }`}
            >
              <span aria-hidden>{p.emoji}</span>
              <span>{p.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  active ? "bg-white/20" : "bg-[#e0e4dd] text-[#11272b]"
                }`}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      <div
        role="tablist"
        aria-label="Filter by status"
        className="flex items-center gap-1 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] p-1"
      >
        {STATUSES.map((s) => {
          const active = status === s.id;
          return (
            <Link
              key={s.id}
              href={buildUrl({ status: s.id })}
              role="tab"
              aria-selected={active}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-[#12343b] text-[#f6ead6]"
                  : "text-[#5e7279] hover:bg-[#f4ecdd] hover:text-[#11272b]"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
