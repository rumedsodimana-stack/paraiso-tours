"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/", label: "Client Portal", icon: UserCircle },
  { href: "/admin/bookings", label: "Bookings", icon: Users },
  { href: "/admin/packages", label: "Tour Packages", icon: Package },
  { href: "/admin/calendar", label: "Calendar", icon: Calendar },
  { href: "/admin/quotations", label: "Quotations", icon: FileText },
  { href: "/admin/payments", label: "Payments", icon: Banknote },
  { href: "/admin/hotels", label: "Hotels & Suppliers", icon: MapPin },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-white/20 bg-white/40 shadow-xl backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2 border-b border-white/30 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-lg shadow-teal-500/25">
          <MapPin className="h-5 w-5" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-stone-800">
          Paraíso Tours
        </span>
      </div>
      <nav className="mt-4 space-y-0.5 px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href ||
            (href !== "/" && pathname.startsWith(href + "/"));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-teal-500/20 text-teal-800 shadow-inner backdrop-blur-sm"
                  : "text-stone-600 hover:bg-white/50 hover:text-stone-800"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
