"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

/**
 * PackageFilters — the search + sort toolbar for the packages index.
 *
 * Sits on a cream surface (no longer inside the dark hero) so the
 * input is a quiet light field with token borders. Sort is a native
 * select that syncs the URL through router.push.
 */
export function PackageFilters({
  regionFilter,
  initialQ,
  initialSort,
}: {
  regionFilter: string;
  initialQ: string;
  initialSort: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSortChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "default") params.delete("sort");
    else params.set("sort", value);
    router.push(`/packages?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <form className="relative flex-1" action="/packages" method="get">
        <input type="hidden" name="region" value={regionFilter} />
        <input type="hidden" name="sort" value={initialSort} />
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          type="search"
          name="q"
          defaultValue={initialQ}
          placeholder="Search by route, region, or style"
          className="w-full rounded-full border border-[var(--portal-border)] bg-white/85 py-3 pl-11 pr-4 text-sm text-stone-900 placeholder:text-stone-500 focus:border-[var(--portal-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--portal-ink)]/15"
        />
      </form>
      <select
        value={initialSort}
        onChange={(e) => handleSortChange(e.target.value)}
        className="rounded-full border border-[var(--portal-border)] bg-white/85 px-4 py-3 text-sm text-stone-900 focus:border-[var(--portal-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--portal-ink)]/15"
      >
        <option value="default">Sort by</option>
        <option value="price">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
        <option value="rating">Rating</option>
        <option value="name">Name</option>
      </select>
    </div>
  );
}
