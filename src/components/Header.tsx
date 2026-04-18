"use client";

import { Bell, Bot } from "lucide-react";
import { APP_RELEASE } from "@/lib/app-release";
import { GlobalSearch } from "./GlobalSearch";
import { AdminLogoutButton } from "./AdminLogoutButton";

export function Header({
  title,
  aiChatOpen = false,
  onToggleAiChat,
  showAiToggle = false,
}: {
  title?: string;
  aiChatOpen?: boolean;
  onToggleAiChat?: () => void;
  showAiToggle?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-[52px] shrink-0 items-center justify-between border-b border-[#e0e4dd] bg-[#fffbf4] px-6 print:hidden">
      <h1 className="text-[15px] font-semibold text-[#11272b]">
        {title || "Dashboard"}
      </h1>

      <div className="flex items-center gap-2">
        <span className="rounded-full border border-[#e0e4dd] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a9ba1]">
          v{APP_RELEASE.version}
        </span>

        <GlobalSearch />

        {showAiToggle ? (
          <button
            type="button"
            onClick={onToggleAiChat}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors ${
              aiChatOpen
                ? "border-[#dce7e8] bg-[#eef4f4] text-[#12343b]"
                : "border-[#e0e4dd] bg-[#fffbf4] text-[#5e7279] hover:bg-[#f4ecdd] hover:text-[#11272b]"
            }`}
          >
            <Bot className="h-4 w-4" />
            AI
          </button>
        ) : null}

        <button
          type="button"
          className="relative rounded-xl border border-[#e0e4dd] bg-[#fffbf4] p-2 text-[#5e7279] transition-colors hover:bg-[#f4ecdd] hover:text-[#11272b]"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#c9922f]" />
        </button>

        <AdminLogoutButton />
      </div>
    </header>
  );
}
