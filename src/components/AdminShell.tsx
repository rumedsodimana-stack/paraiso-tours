"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { AdminReleaseNotice } from "@/components/AdminReleaseNotice";

export function AdminShell({
  children,
  brandName,
  logoUrl,
}: {
  children: React.ReactNode;
  brandName: string;
  logoUrl?: string;
}) {
  const pathname = usePathname();
  const isAuthSurface = pathname === "/admin/login";

  if (isAuthSurface) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen print:block">
      <Sidebar brandName={brandName} logoUrl={logoUrl} />
      <div className="ml-64 flex min-w-0 flex-1 flex-col print:ml-0">
        <Suspense
          fallback={
            <header className="h-16 border-b border-white/20 bg-white/50" />
          }
        >
          <Header />
        </Suspense>
        <AdminReleaseNotice />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
