"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <form className="relative flex-1" action="/packages" method="get">
        <input type="hidden" name="region" value={regionFilter} />
        <input type="hidden" name="sort" value={initialSort} />
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          type="search"
          name="q"
          defaultValue={initialQ}
          placeholder="Search tours..."
          className="w-full rounded-xl border border-white/50 bg-white/70 py-2.5 pl-10 pr-4 text-stone-900 placeholder-stone-500 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
        />
      </form>
      <select
        value={initialSort}
        onChange={(e) => handleSortChange(e.target.value)}
        className="rounded-xl border border-white/50 bg-white/70 px-4 py-2.5 text-stone-700 backdrop-blur-sm"
      >
        <option value="default">Sort by</option>
        <option value="price">Price: Low to high</option>
        <option value="price-desc">Price: High to low</option>
        <option value="rating">Rating</option>
        <option value="name">Name</option>
      </select>
    </div>
  );
}
