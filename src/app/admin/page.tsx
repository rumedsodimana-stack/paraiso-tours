import Link from "next/link";
import { Suspense } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Inbox,
  MapPin,
  TrendingUp,
  Users,
} from "lucide-react";
import { getLeads, getTours, getInvoices, getAuditLogs } from "@/lib/db";
import { getAppSettings, getDisplayCompanyName } from "@/lib/app-config";
import { supabase } from "@/lib/supabase";
import { isDefaultPassword } from "@/lib/settings";
import { WorldClockWidget } from "@/components/WorldClockWidget";
import { ExchangeRatesWidget } from "@/components/ExchangeRatesWidget";
import type { Lead, Tour } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysBetween(start: string, end: string) {
  return Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
}

function hoursAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
}

function formatTodayHeading() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

const TOUR_STATUS_STYLE: Record<string, string> = {
  scheduled:   "bg-[#f3e8ce] text-[#7a5a17]",
  confirmed:   "bg-[#dce8dc] text-[#375a3f]",
  "in-progress": "bg-[#d6e2e5] text-[#294b55]",
  completed:   "bg-[#e2e3dd] text-[#545a54]",
  cancelled:   "bg-[#e8e1d2] text-[#6b6451]",
};

function PipelineBar({ leads }: { leads: Lead[] }) {
  const statuses = ["new", "scheduled", "completed", "cancelled"] as const;
  const counts = Object.fromEntries(
    statuses.map((s) => [s, leads.filter((l) => l.status === s).length])
  );
  const maxCount = Math.max(...Object.values(counts), 1);

  return (
    <div className="paraiso-card rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#11272b]">Booking Pipeline</h2>
        <Link
          href="/admin/bookings"
          className="flex items-center gap-1 text-xs font-medium text-[#12343b] hover:underline"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="flex items-end gap-2">
        {statuses.map((s, i) => (
          <div key={s} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-lg font-bold text-[#11272b]">{counts[s]}</span>
            <div className="w-full rounded-t" style={{
              height: `${Math.max((counts[s] / maxCount) * 52, 4)}px`,
              background: i === statuses.length - 1 ? "#12343b" : "#dce7e8",
            }} />
            <span className="text-[10px] font-medium text-[#8a9ba1] uppercase tracking-wide">
              {STATUS_LABEL[s]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TodaysTours({ tours }: { tours: Tour[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const active = tours.filter(
    (t) =>
      t.status !== "cancelled" &&
      t.status !== "completed" &&
      t.startDate <= today &&
      t.endDate >= today
  );

  return (
    <div className="paraiso-card rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#11272b]">
          Today&apos;s Tours
          {active.length > 0 && (
            <span className="ml-2 rounded-full bg-[#12343b] px-2 py-0.5 text-[10px] font-semibold text-[#f6ead6]">
              {active.length}
            </span>
          )}
        </h2>
        <Link
          href="/admin/calendar"
          className="flex items-center gap-1 text-xs font-medium text-[#12343b] hover:underline"
        >
          Calendar <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {active.length === 0 ? (
        <p className="py-4 text-center text-sm text-[#8a9ba1]">No tours on today</p>
      ) : (
        <div className="space-y-3">
          {active.map((t) => {
            const dayNum = Math.floor(
              (new Date(today).getTime() - new Date(t.startDate).getTime()) / 86400000
            ) + 1;
            const totalDays = daysBetween(t.startDate, t.endDate);
            const isStart = t.startDate === today;

            return (
              <Link
                key={t.id}
                href={`/admin/bookings/${t.leadId}`}
                className="flex items-start gap-3 rounded-xl border border-[#e0e4dd] bg-[#faf6ef] p-3 transition-colors hover:bg-[#f4ecdd]"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#12343b] text-[#f6ead6]">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#11272b]">{t.clientName}</p>
                  <p className="truncate text-xs text-[#5e7279]">{t.packageName}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TOUR_STATUS_STYLE[t.status] ?? ""}`}>
                      {isStart ? "Starts today" : `Day ${dayNum} of ${totalDays}`}
                    </span>
                    {t.confirmationId && (
                      <span className="font-mono text-[10px] text-[#8a9ba1]">{t.confirmationId}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AttentionItems({
  leads,
  overdueInvoices,
}: {
  leads: Lead[];
  overdueInvoices: number;
}) {
  const staleLeads = leads.filter(
    (l) =>
      l.status === "new" &&
      hoursAgo(l.updatedAt || l.createdAt) > 48
  );
  const items = [
    ...staleLeads.map((l) => ({
      key: l.id,
      text: `${l.name} — new booking, ${Math.floor(hoursAgo(l.updatedAt || l.createdAt) / 24)}d old`,
      href: `/admin/bookings/${l.id}`,
    })),
    ...(overdueInvoices > 0
      ? [{ key: "inv", text: `${overdueInvoices} overdue invoice${overdueInvoices > 1 ? "s" : ""}`, href: "/admin/invoices" }]
      : []),
  ];

  if (items.length === 0) {
    return (
      <div className="paraiso-card flex items-center gap-3 rounded-2xl p-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#dce8dc] text-[#375a3f]">
          ✓
        </span>
        <p className="text-sm font-medium text-[#375a3f]">All clear — nothing needs attention</p>
      </div>
    );
  }

  return (
    <div className="paraiso-card rounded-2xl p-5">
      <h2 className="mb-3 text-sm font-semibold text-[#11272b]">
        Needs Attention
        <span className="ml-2 rounded-full bg-[#eed9cf] px-2 py-0.5 text-[10px] font-semibold text-[#7c3a24]">
          {items.length}
        </span>
      </h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[#5e7279] transition-colors hover:bg-[#f4ecdd] hover:text-[#11272b]"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9922f]" />
              {item.text}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function DashboardPage() {
  const [leads, tours, invoices, settings, usingDefaultPw, auditLogs] = await Promise.all([
    getLeads(),
    getTours(),
    getInvoices(),
    getAppSettings(),
    isDefaultPassword(),
    // Pull recent audit events to compute the comms-health KPI. 500 is
    // plenty to cover a normal day's email volume.
    getAuditLogs({ limit: 500 }),
  ]);
  getDisplayCompanyName(settings);

  const today = new Date().toISOString().slice(0, 10);

  const activeLeads = leads.filter((l) => l.status === "new").length;
  const scheduledTours = tours.filter((t) => t.status !== "cancelled" && t.status !== "completed").length;
  const totalRevenue = tours.filter((t) => t.status !== "cancelled").reduce((s, t) => s + t.totalValue, 0);
  const conversion = leads.length > 0
    ? Math.round(
        (leads.filter((l) => l.status === "scheduled" || l.status === "completed").length /
          leads.length) *
          100
      )
    : 0;
  const overdueInvoices = invoices.filter((i) => i.status === "overdue").length;
  const newLeadsToday = leads.filter(
    (l) => l.createdAt.slice(0, 10) === today
  ).length;

  const upcomingTours = tours
    .filter((t) => t.status !== "cancelled" && t.status !== "completed" && t.startDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 6);

  const recentLeads = [...leads]
    .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
    .slice(0, 6);

  const isVercel = process.env.VERCEL === "1";
  const hasSupabase = supabase !== null;

  // Communications health — count sent vs failed email events today.
  const todayKey = today; // YYYY-MM-DD
  let emailsSentToday = 0;
  let emailsFailedToday = 0;
  for (const log of auditLogs) {
    if (!log.createdAt.startsWith(todayKey)) continue;
    const action = log.action;
    const metaStatus =
      log.metadata && typeof (log.metadata as Record<string, unknown>).status === "string"
        ? ((log.metadata as Record<string, unknown>).status as string)
        : null;
    if (metaStatus === "sent" || /_emailed$/.test(action)) {
      emailsSentToday += 1;
    } else if (metaStatus === "failed" || /_email_failed$/.test(action)) {
      emailsFailedToday += 1;
    }
  }

  const kpis = [
    { label: "Active Bookings", value: activeLeads, sub: newLeadsToday > 0 ? `+${newLeadsToday} today` : null, icon: Users, href: "/admin/bookings" },
    { label: "Scheduled Tours", value: scheduledTours, sub: null, icon: Calendar, href: "/admin/calendar" },
    { label: "Revenue", value: `$${(totalRevenue / 1000).toFixed(1)}k`, sub: null, icon: TrendingUp, href: "/admin/finance" },
    { label: "Conversion", value: `${conversion}%`, sub: `${leads.filter((l) => l.status === "scheduled" || l.status === "completed").length} scheduled`, icon: null, href: "/admin/bookings" },
    {
      label: "Emails today",
      value: emailsSentToday,
      sub: emailsFailedToday > 0
        ? `${emailsFailedToday} failed`
        : emailsSentToday === 0
          ? "no sends yet"
          : "all delivered",
      icon: Inbox,
      href: "/admin/communications",
    },
  ];

  return (
    <div className="space-y-6">
      {/* System alerts */}
      {isVercel && !hasSupabase && (
        <div className="flex items-start gap-3 rounded-xl border border-[#f3e8ce] bg-[#fdf6e8] px-4 py-3 text-sm text-[#7a5a17]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#c9922f]" />
          <div>
            <p className="font-semibold">Data persistence not configured</p>
            <p className="mt-0.5 text-[#9a7230]">
              Your hosting environment is missing the database credentials.
              Ask your technical administrator to configure them before
              creating bookings — changes will not be saved until then.
            </p>
          </div>
        </div>
      )}
      {usingDefaultPw && (
        <div className="flex items-start gap-3 rounded-xl border border-[#eed9cf] bg-[#fdf2ee] px-4 py-3 text-sm text-[#7c3a24]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#c9502f]" />
          <div>
            <p className="font-semibold">Using the default password</p>
            <p className="mt-0.5 text-[#9a4a30]">
              Change it in{" "}
              <Link href="/admin/settings" className="font-medium underline hover:text-[#7c3a24]">
                Settings › Security
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {/* Page heading */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a9ba1]">
          {formatTodayHeading()}
        </p>
        <h1 className="mt-0.5 text-2xl font-bold text-[#11272b]">Operations</h1>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="paraiso-card group rounded-2xl p-5 transition-colors hover:bg-[#f4ecdd]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a9ba1]">
                  {kpi.label}
                </p>
                <p className="mt-2 text-3xl font-bold text-[#11272b]">{kpi.value}</p>
                {kpi.sub && (
                  <p className="mt-1 text-xs text-[#c9922f] font-medium">{kpi.sub}</p>
                )}
              </div>
              {kpi.icon && (
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#12343b] text-[#f6ead6]">
                  <kpi.icon className="h-4 w-4" />
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Attention + Today's tours */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AttentionItems leads={leads} overdueInvoices={overdueInvoices} />
        <TodaysTours tours={tours} />
      </div>

      {/* Pipeline + Upcoming */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PipelineBar leads={leads} />

        {/* Upcoming tours */}
        <div className="paraiso-card rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#e0e4dd] px-5 py-4">
            <h2 className="text-sm font-semibold text-[#11272b]">Upcoming Tours</h2>
            <Link href="/admin/calendar" className="flex items-center gap-1 text-xs font-medium text-[#12343b] hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {upcomingTours.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[#8a9ba1]">No upcoming tours scheduled</div>
          ) : (
            <div className="divide-y divide-[#e0e4dd]">
              {upcomingTours.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/bookings/${t.leadId}`}
                  className="flex items-center justify-between px-5 py-3 text-sm transition-colors hover:bg-[#faf6ef]"
                >
                  <div>
                    <p className="font-medium text-[#11272b]">{t.clientName}</p>
                    <p className="text-xs text-[#8a9ba1]">{t.packageName}</p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="font-medium text-[#11272b]">{formatDateShort(t.startDate)}</p>
                    <p className="text-xs text-[#8a9ba1]">{daysBetween(t.startDate, t.endDate)}d</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent bookings */}
      <div className="paraiso-card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#e0e4dd] px-5 py-4">
          <h2 className="text-sm font-semibold text-[#11272b]">Recent Bookings</h2>
          <Link href="/admin/bookings" className="flex items-center gap-1 text-xs font-medium text-[#12343b] hover:underline">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-[#e0e4dd]">
          {recentLeads.map((lead) => (
            <Link
              key={lead.id}
              href={`/admin/bookings/${lead.id}`}
              className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-[#faf6ef]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#11272b]">{lead.name}</p>
                <p className="text-xs text-[#8a9ba1]">via {lead.source}</p>
              </div>
              <div className="ml-4 flex shrink-0 items-center gap-3">
                {lead.reference && (
                  <span className="font-mono text-xs text-[#8a9ba1]">{lead.reference}</span>
                )}
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  lead.status === "scheduled"  ? "bg-[#12343b] text-[#f6ead6]"
                  : lead.status === "new"      ? "bg-[#f3e8ce] text-[#7a5a17]"
                  : lead.status === "completed" ? "bg-[#dce8dc] text-[#375a3f]"
                  : lead.status === "cancelled"? "bg-[#eed9cf] text-[#7c3a24]"
                  :                             "bg-[#e2e3dd] text-[#545a54]"
                }`}>
                  {STATUS_LABEL[lead.status] ?? lead.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Widgets */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Suspense fallback={<div className="paraiso-card h-48 animate-pulse rounded-2xl" />}>
          <WorldClockWidget />
        </Suspense>
        <Suspense fallback={<div className="paraiso-card h-48 animate-pulse rounded-2xl" />}>
          <ExchangeRatesWidget />
        </Suspense>
      </div>
    </div>
  );
}
