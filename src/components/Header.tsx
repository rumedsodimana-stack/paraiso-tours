"use client";

import { Bell } from "lucide-react";
import { APP_RELEASE } from "@/lib/app-release";
import { GlobalSearch } from "./GlobalSearch";
import { AdminLogoutButton } from "./AdminLogoutButton";

export function Header({ title }: { title?: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/20 bg-white/50 px-8 backdrop-blur-xl print:hidden">
      <h1 className="text-xl font-semibold text-stone-800">
        {title || "Dashboard"}
      </h1>
      <div className="flex items-center gap-4">
        <span className="rounded-full border border-white/40 bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
          v{APP_RELEASE.version}
        </span>
        <GlobalSearch />
        <button className="relative rounded-xl p-2 text-stone-500 hover:bg-white/50 hover:text-stone-700 backdrop-blur-sm transition">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-teal-500" />
        </button>
        <AdminLogoutButton />
      </div>
    </header>
  );
}
