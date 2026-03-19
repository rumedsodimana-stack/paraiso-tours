import { Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen print:block">
      <Sidebar />
      <div className="ml-64 flex flex-1 flex-col min-w-0 print:ml-0">
        <Suspense fallback={<header className="h-16 border-b border-white/20 bg-white/50" />}>
          <Header />
        </Suspense>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
