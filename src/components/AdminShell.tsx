"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

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
    <div className="admin-shell flex h-screen overflow-hidden print:block print:h-auto print:overflow-auto">
      <Sidebar brandName={brandName} logoUrl={logoUrl} />
      <div className="relative z-10 ml-64 flex h-full min-w-0 flex-1 flex-col overflow-hidden print:ml-0">
        <Suspense
          fallback={
            <div className="h-[52px] shrink-0 border-b border-[#e0e4dd] bg-[#fffbf4]" />
          }
        >
          <Header
            aiChatOpen={showGlobalAiChat && aiChatOpen}
            onToggleAiChat={handleToggleAiChat}
            showAiToggle={showGlobalAiChat}
          />
        </Suspense>
        <main className="flex-1 overflow-y-auto bg-[#faf6ef] px-6 py-6">
          <div className="mx-auto w-full max-w-[1680px]">
            {children}
          </div>
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
  );
}
