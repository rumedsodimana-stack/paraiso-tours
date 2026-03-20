import Link from "next/link";
import { Suspense } from "react";
import {
  Users,
  Package,
  Calendar,
  TrendingUp,
  MapPin,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { getLeads, getTours } from "@/lib/db";
import { getAppSettings, getDisplayCompanyName } from "@/lib/app-config";
import { supabase } from "@/lib/supabase";
import { WorldClockWidget } from "@/components/WorldClockWidget";
import { ExchangeRatesWidget } from "@/components/ExchangeRatesWidget";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatDate(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysBetween(start: string, end: string) {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  return Math.ceil((b - a) / (1000 * 60 * 60 * 24)) + 1;
}

function RecentLeadsCard({ recentLeads }: { recentLeads: Lead[] }) {
  const statusClasses: Record<string, string> = {
    new: "px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800",
    quoted: "px-2.5 py-1 rounded-full text-xs font-medium bg-sky-100 text-sky-800",
    won: "px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800",
  };
  return (
    <div className="rounded-2xl border border-white/20 bg-white/40 shadow-lg shadow-stone-200/50 backdrop-blur-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/30 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Recent Bookings</h2>
        <Link
          href="/admin/bookings"
          className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
        >
          View all
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="divide-y divide-white/20">
        {recentLeads.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-500">
            No bookings yet
          </div>
        ) : (
          recentLeads.map((lead) => (
            <div
              key={lead.id}
              className="px-6 py-4 flex items-center justify-between hover:bg-white/50 transition-colors"
            >
              <div>
                <p className="font-medium text-slate-900">{lead.name}</p>
                <p className="text-sm text-slate-500">via {lead.source}</p>
                {lead.reference ? (
                  <p className="mt-1 font-mono text-sm font-bold text-teal-700">
                    Ref: {lead.reference}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {lead.reference ? (
                  <span className="px-3 py-1.5 rounded-lg font-mono text-sm font-bold bg-teal-100 text-teal-800 border border-teal-300">
                    {lead.reference}
                  </span>
                ) : null}
                <span className={statusClasses[lead.status] ?? "px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600"}>
                  {lead.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const [leads, tours, settings] = await Promise.all([
    getLeads(),
    getTours(),
    getAppSettings(),
  ]);
  const brandName = getDisplayCompanyName(settings);

  const activeLeads = leads.filter(
    (l) => l.status !== "won" && l.status !== "lost"
  ).length;
  const scheduledTours = tours.filter(
    (t) => t.status !== "cancelled" && t.status !== "completed"
  ).length;
  const totalRevenue = tours
    .filter((t) => t.status !== "cancelled")
    .reduce((sum, t) => sum + t.totalValue, 0);
  const conversion =
    leads.length > 0
      ? Math.round(
          (leads.filter((l) => l.status === "won").length / leads.length) * 100
        )
      : 0;

  const today = new Date().toISOString().slice(0, 10);
  const upcomingTours = tours
    .filter((t) => t.status !== "cancelled" && t.status !== "completed" && t.startDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 5);

  const recentLeads = [...leads]
    .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
    .slice(0, 5);

  const stats = [
    { label: "Active Bookings", value: String(activeLeads), icon: "bookings" as const },
    {
      label: "Scheduled Tours",
      value: String(scheduledTours),
      icon: "tours" as const,
    },
    {
      label: "Revenue",
      value: `$${(totalRevenue / 1000).toFixed(1)}k`,
      icon: "revenue" as const,
    },
    {
      label: "Conversion Rate",
      value: `${conversion}%`,
      icon: "conversion" as const,
    },
  ];

  const isVercel = process.env.VERCEL === "1";
  const hasSupabase = supabase !== null;

  return (
    <div className="space-y-8">
      {isVercel && !hasSupabase && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="font-semibold">Data persistence not configured</p>
            <p className="mt-0.5 text-amber-800">
              Running on Vercel without Supabase — bookings, tours, invoices and payments
              are stored in memory and will be lost on cold start. Set{" "}
              <code className="rounded bg-amber-100 px-1 font-mono text-xs">
                NEXT_PUBLIC_SUPABASE_URL
              </code>{" "}
              and{" "}
              <code className="rounded bg-amber-100 px-1 font-mono text-xs">
                SUPABASE_SERVICE_ROLE_KEY
              </code>{" "}
              in Vercel to enable persistent storage.
            </p>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back to {brandName}
        </h1>
        <p className="mt-1 text-slate-600">
          Here&apos;s what&apos;s happening with your tours today.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-white/20 bg-white/40 p-5 shadow-lg shadow-stone-200/50 backdrop-blur-xl transition-all hover:bg-white/50 hover:shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {stat.value}
                </p>
              </div>
              <div
                className={`p-3 rounded-lg ${
                  stat.icon === "bookings"
                    ? "bg-amber-100 text-amber-700"
                    : stat.icon === "tours"
                    ? "bg-teal-100 text-teal-700"
                    : stat.icon === "revenue"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-sky-100 text-sky-700"
                }`}
              >
                {stat.icon === "bookings" && <Users className="w-6 h-6" />}
                {stat.icon === "tours" && <Calendar className="w-6 h-6" />}
                {stat.icon === "revenue" && <TrendingUp className="w-6 h-6" />}
                {stat.icon === "conversion" && (
                  <Package className="w-6 h-6" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<div className="rounded-2xl border border-white/20 bg-white/40 p-5 h-64 animate-pulse" />}>
          <WorldClockWidget />
        </Suspense>
        <Suspense fallback={<div className="rounded-2xl border border-white/20 bg-white/40 p-5 h-64 animate-pulse" />}>
          <ExchangeRatesWidget />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/20 bg-white/40 shadow-lg shadow-stone-200/50 backdrop-blur-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/30 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Upcoming Tours</h2>
            <Link
              href="/admin/calendar"
              className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
            >
              View scheduled tours
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-white/20">
            {upcomingTours.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-500">
                No upcoming tours
              </div>
            ) : (
              upcomingTours.map((tour) => (
                <div
                  key={tour.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-white/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-teal-50">
                      <MapPin className="w-4 h-4 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">
                        {tour.clientName}
                      </p>
                      <p className="text-sm text-slate-500">
                        {tour.packageName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900">
                      {formatDate(tour.startDate)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {daysBetween(tour.startDate, tour.endDate)} days
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <RecentLeadsCard recentLeads={recentLeads} />
      </div>
    </div>
  );
}
