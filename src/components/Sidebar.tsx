"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  Banknote,
  BookOpen,
  Bot,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Compass,
  FileText,
  Landmark,
  LayoutDashboard,
  ListTodo,
  MapPin,
  Package,
  PieChart,
  Settings,
  UserCircle,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: React.ElementType };

function isActiveHref(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === "/admin"
    : pathname === href || pathname.startsWith(href + "/");
}

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
}: NavItem & { pathname: string }) {
  const active = isActiveHref(pathname, href);
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-[#eef4f4] text-[#11272b]"
          : "text-[#5e7279] hover:bg-[#f4ecdd] hover:text-[#11272b]"
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
          active
            ? "bg-[#12343b] text-[#f6ead6]"
            : "text-[#8a9ba1] group-hover:text-[#5e7279]"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="truncate">{label}</span>
      {active && (
        <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9922f]" />
      )}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a9ba1]">
      {children}
    </p>
  );
}

const OPERATIONS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Bookings", icon: Users },
  { href: "/admin/quotations", label: "Quotations", icon: FileText },
  { href: "/admin/calendar", label: "Scheduled Tours", icon: Calendar },
  { href: "/admin/todos", label: "Todos", icon: ListTodo },
];

const CATALOG: NavItem[] = [
  { href: "/admin/packages", label: "Tour Packages", icon: Package },
  { href: "/admin/destinations", label: "Destinations", icon: MapPin },
  { href: "/admin/hotels", label: "Hotels & Transport", icon: Building2 },
  { href: "/admin/activities", label: "Activities", icon: Activity },
];

const FINANCE_ITEMS: NavItem[] = [
  { href: "/admin/finance", label: "Overview", icon: PieChart },
  { href: "/admin/invoices", label: "Invoices", icon: FileText },
  { href: "/admin/payments", label: "Payments", icon: Banknote },
  { href: "/admin/payables", label: "Payables", icon: Landmark },
  { href: "/admin/payroll", label: "Payroll", icon: Wallet },
  { href: "/admin/employees", label: "Employees", icon: UserCog },
];

const INTELLIGENCE: NavItem[] = [
  { href: "/admin/ai", label: "AI Workspace", icon: Bot },
  { href: "/admin/agents", label: "AI Agents", icon: Bot },
];

const financePaths = [
  "/admin/finance",
  "/admin/invoices",
  "/admin/payments",
  "/admin/payables",
  "/admin/payroll",
  "/admin/employees",
];

export function Sidebar({
  brandName,
  logoUrl,
}: {
  brandName: string;
  logoUrl?: string;
}) {
  const pathname = usePathname();
  const isFinanceActive = financePaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const [financeOpen, setFinanceOpen] = useState(false);
  const financeExpanded = isFinanceActive || financeOpen;

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-[#e0e4dd] bg-[#fffbf4] print:hidden">
      {/* Brand */}
      <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-[#e0e4dd] px-4">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#12343b] text-[#f6ead6]">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={brandName}
              fill
              className="object-cover"
              sizes="32px"
            />
          ) : (
            <Compass className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-[#11272b]">
            {brandName}
          </p>
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8a9ba1]">
            Admin
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col overflow-y-auto px-2 pb-4">
        <SectionLabel>Operations</SectionLabel>
        <div className="space-y-0.5">
          {OPERATIONS.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} />
          ))}
        </div>

        <SectionLabel>Catalog</SectionLabel>
        <div className="space-y-0.5">
          {CATALOG.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} />
          ))}
        </div>

        <SectionLabel>Finance</SectionLabel>
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => {
              if (!isFinanceActive) setFinanceOpen((o) => !o);
            }}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              isFinanceActive
                ? "bg-[#eef4f4] text-[#11272b]"
                : "text-[#5e7279] hover:bg-[#f4ecdd] hover:text-[#11272b]"
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                isFinanceActive
                  ? "bg-[#12343b] text-[#f6ead6]"
                  : "text-[#8a9ba1]"
              }`}
            >
              <PieChart className="h-4 w-4" />
            </span>
            <span className="flex-1 truncate text-left">Finance</span>
            {financeExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#8a9ba1]" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#8a9ba1]" />
            )}
          </button>
          {financeExpanded && (
            <div className="ml-4 space-y-0.5 border-l border-[#e0e4dd] pl-2">
              {FINANCE_ITEMS.map((item) => (
                <NavLink key={item.href} {...item} pathname={pathname} />
              ))}
            </div>
          )}
        </div>

        <SectionLabel>Intelligence</SectionLabel>
        <div className="space-y-0.5">
          {INTELLIGENCE.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} />
          ))}
        </div>

        {/* System — bottom */}
        <div className="mt-auto border-t border-[#e0e4dd] pt-3">
          <div className="space-y-0.5">
            <NavLink href="/admin/settings" label="Settings" icon={Settings} pathname={pathname} />
            <NavLink href="/admin/user-guide" label="User Guide" icon={BookOpen} pathname={pathname} />
            <NavLink href="/" label="Client Portal" icon={UserCircle} pathname={pathname} />
          </div>
        </div>
      </nav>
    </aside>
  );
}
