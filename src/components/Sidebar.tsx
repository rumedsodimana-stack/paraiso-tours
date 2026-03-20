"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Package,
  Calendar,
  FileText,
  Banknote,
  Settings,
  MapPin,
  UserCircle,
  BookOpen,
  Landmark,
  PieChart,
  UserCog,
  Wallet,
  ChevronDown,
  ChevronRight,
  ListTodo,
  Bot,
} from "lucide-react";

const navBeforeFinance = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Bookings", icon: Users },
  { href: "/admin/packages", label: "Tour Packages", icon: Package },
  { href: "/admin/calendar", label: "Scheduled Tours", icon: Calendar },
  { href: "/admin/quotations", label: "Quotations", icon: FileText },
  { href: "/admin/todos", label: "Todo List", icon: ListTodo },
  { href: "/admin/ai", label: "AI Workspace", icon: Bot },
];

const financeSubItems = [
  { href: "/admin/finance", label: "Overview", icon: PieChart },
  { href: "/admin/payroll", label: "Payroll", icon: Wallet },
  { href: "/admin/employees", label: "Employees", icon: UserCog },
];

const navAfterFinance = [
  { href: "/admin/payables", label: "Payables", icon: Landmark },
  { href: "/admin/payments", label: "Payments", icon: Banknote },
  { href: "/admin/hotels", label: "Hotels & Suppliers", icon: MapPin },
];

const financePaths = ["/admin/finance", "/admin/payroll", "/admin/employees"];

export function Sidebar({
  brandName,
  logoUrl,
}: {
  brandName: string;
  logoUrl?: string;
}) {
  const pathname = usePathname();
  const isFinanceActive = financePaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const [financeOpen, setFinanceOpen] = useState(false);
  const financeExpanded = isFinanceActive || financeOpen;

  const linkClass = (href: string) => {
    const isActive =
      pathname === href ||
      (href !== "/" && pathname.startsWith(href + "/"));
    return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
      isActive
        ? "bg-teal-500/20 text-teal-800 shadow-inner backdrop-blur-sm"
        : "text-stone-600 hover:bg-white/50 hover:text-stone-800"
    }`;
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-white/20 bg-white/40 shadow-xl backdrop-blur-xl print:hidden">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-white/30 px-6">
        <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-lg shadow-teal-500/25">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={brandName}
              fill
              unoptimized
              className="object-cover"
              sizes="100vw"
            />
          ) : (
            <MapPin className="h-5 w-5" />
          )}
        </div>
        <span className="text-lg font-semibold tracking-tight text-stone-800">
          {brandName}
        </span>
      </div>
      <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-auto px-3 pb-4">
        <div className="space-y-0.5">
          {navBeforeFinance.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={linkClass(href)}>
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </Link>
          ))}
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => {
                if (!isFinanceActive) {
                  setFinanceOpen((open) => !open);
                }
              }}
              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isFinanceActive
                  ? "bg-teal-500/20 text-teal-800"
                  : "text-stone-600 hover:bg-white/50 hover:text-stone-800"
              }`}
            >
              <span className="flex items-center gap-3">
                <PieChart className="h-5 w-5 shrink-0" />
                Finance
              </span>
              {financeExpanded ? (
                <ChevronDown className="h-5 w-5 shrink-0" />
              ) : (
                <ChevronRight className="h-5 w-5 shrink-0" />
              )}
            </button>
            {financeExpanded && (
              <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-stone-200 pl-3">
                {financeSubItems.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`block ${linkClass(href)}`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          {navAfterFinance.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={linkClass(href)}>
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </Link>
          ))}
        </div>
        <div className="mt-auto border-t border-white/30 pt-4 space-y-0.5">
          <Link href="/" className={linkClass("/")}>
            <UserCircle className="h-5 w-5 shrink-0" />
            Client Portal
          </Link>
          <Link href="/admin/user-guide" className={linkClass("/admin/user-guide")}>
            <BookOpen className="h-5 w-5 shrink-0" />
            User Guide
          </Link>
          <Link href="/admin/settings" className={linkClass("/admin/settings")}>
            <Settings className="h-5 w-5 shrink-0" />
            Settings
          </Link>
        </div>
      </nav>
    </aside>
  );
}
