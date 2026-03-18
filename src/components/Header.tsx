"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";

export function Header({ title }: { title?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearchQuery =
    pathname === "/leads" ? (searchParams.get("q") ?? "") : "";

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = String(formData.get("q") ?? "").trim();
    if (q) {
      router.push(`/leads?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/leads");
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/20 bg-white/50 px-8 backdrop-blur-xl">
      <h1 className="text-xl font-semibold text-stone-800">
        {title || "Dashboard"}
      </h1>
      <div className="flex items-center gap-4">
        <form
          key={`${pathname}:${currentSearchQuery}`}
          onSubmit={handleSearch}
          className="relative flex items-center gap-2"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              name="q"
              placeholder="Search leads..."
              defaultValue={currentSearchQuery}
              className="h-9 w-56 rounded-xl border border-white/40 bg-white/40 pl-9 pr-4 text-sm placeholder:text-stone-500 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            />
          </div>
          <button
            type="submit"
            className="h-9 rounded-xl bg-teal-600 px-3 text-sm font-medium text-white transition hover:bg-teal-700"
          >
            Search
          </button>
        </form>
        <button className="relative rounded-xl p-2 text-stone-500 hover:bg-white/50 hover:text-stone-700 backdrop-blur-sm transition">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-teal-500" />
        </button>
      </div>
    </header>
  );
}
