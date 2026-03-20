"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { AdminReleaseNotice } from "@/components/AdminReleaseNotice";
import { GlobalAdminAiChat } from "@/components/GlobalAdminAiChat";

interface RuntimeSummary {
  enabled: boolean;
  configured: boolean;
  providerLabel: string;
  baseUrl: string;
  model: string;
  simpleModel: string;
  defaultModel: string;
  heavyModel: string;
  promptCacheEnabled: boolean;
  promptCacheTtl: "5m" | "1h";
  superpowerEnabled: boolean;
  missingReason?: string;
}

export function AdminShell({
  children,
  brandName,
  logoUrl,
  aiRuntime,
}: {
  children: React.ReactNode;
  brandName: string;
  logoUrl?: string;
  aiRuntime: RuntimeSummary;
}) {
  const pathname = usePathname();
  const isAuthSurface = pathname === "/admin/login";
  const showGlobalAiChat = !isAuthSurface && pathname !== "/admin/ai";
  const [desktopAiCollapsed, setDesktopAiCollapsed] = useState(
    pathname === "/admin/settings" || pathname === "/admin/user-guide"
  );
  const [mobileAiOpen, setMobileAiOpen] = useState(false);
  const [mainGlow, setMainGlow] = useState(false);
  const glowTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (glowTimeoutRef.current) {
        window.clearTimeout(glowTimeoutRef.current);
      }
    };
  }, []);

  function triggerMainGlow() {
    if (glowTimeoutRef.current) {
      window.clearTimeout(glowTimeoutRef.current);
    }
    setMainGlow(true);
    glowTimeoutRef.current = window.setTimeout(() => {
      setMainGlow(false);
      glowTimeoutRef.current = null;
    }, 3600);
  }

  function handleToggleAiChat() {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches) {
      setDesktopAiCollapsed((collapsed) => !collapsed);
      return;
    }
    setMobileAiOpen((open) => !open);
  }

  function handleCloseAiChat() {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches) {
      setDesktopAiCollapsed(true);
      return;
    }
    setMobileAiOpen(false);
  }

  const aiChatOpen = !desktopAiCollapsed || mobileAiOpen;

  if (isAuthSurface) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen print:block">
      <Sidebar brandName={brandName} logoUrl={logoUrl} />
      <div className="ml-64 flex min-w-0 flex-1 print:ml-0">
        <div className="flex min-w-0 flex-1 flex-col">
          <Suspense
            fallback={
              <header className="h-16 border-b border-white/20 bg-white/50" />
            }
          >
            <Header
              aiChatOpen={showGlobalAiChat && aiChatOpen}
              onToggleAiChat={handleToggleAiChat}
              showAiToggle={showGlobalAiChat}
            />
          </Suspense>
          <AdminReleaseNotice />
          <main
            className={`flex-1 overflow-auto p-6 transition-all duration-500 ${
              mainGlow
                ? "ring-2 ring-sky-300/80 shadow-[0_0_38px_rgba(56,189,248,0.24)]"
                : ""
            }`}
          >
            {children}
          </main>
        </div>
        {showGlobalAiChat ? (
          <GlobalAdminAiChat
            runtime={aiRuntime}
            desktopOpen={!desktopAiCollapsed}
            mobileOpen={mobileAiOpen}
            onClose={handleCloseAiChat}
            onFinalize={triggerMainGlow}
          />
        ) : null}
      </div>
    </div>
  );
}
