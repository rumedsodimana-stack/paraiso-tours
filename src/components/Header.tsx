"use client";

import { Bell } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";

export function Header({ title }: { title?: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/20 bg-white/50 px-8 backdrop-blur-xl print:hidden">
      <h1 className="text-xl font-semibold text-stone-800">
        {title || "Dashboard"}
      </h1>
      <div className="flex items-center gap-4">
        <GlobalSearch />
        <button className="relative rounded-xl p-2 text-stone-500 hover:bg-white/50 hover:text-stone-700 backdrop-blur-sm transition">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-teal-500" />
        </button>
      </div>
    </header>
  );
}
