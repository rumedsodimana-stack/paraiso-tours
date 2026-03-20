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
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
        <input
          type="search"
          name="q"
          defaultValue={initialQ}
          placeholder="Search by route, region, or style"
          className="w-full rounded-[1.2rem] border border-white/18 bg-white/14 py-3 pl-11 pr-4 text-stone-900 placeholder:text-stone-500/90 backdrop-blur-sm focus:border-[#f1d8af] focus:outline-none focus:ring-2 focus:ring-[#f1d8af]/30"
        />
      </form>
      <select
        value={initialSort}
        onChange={(e) => handleSortChange(e.target.value)}
        className="rounded-[1.2rem] border border-white/18 bg-white/14 px-4 py-3 text-stone-900 backdrop-blur-sm"
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
