import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  PackageOpen,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  getHotels,
  getInvoices,
  getPackages,
  getPayments,
  getTours,
} from "@/lib/db";
import {
  detectAnomalies,
  getRevenueTrend,
  getSupplierSpend,
} from "@/lib/finance-insights";
import { analyzeCatalogHealth } from "@/lib/catalog-health";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const [tours, invoices, payments, hotels, packages] = await Promise.all([
    getTours(),
    getInvoices(),
    getPayments(),
    getHotels(),
    getPackages(),
  ]);

  const revenueTrend = getRevenueTrend(tours, 6);
  const { rows: supplierSpend, totalOutbound, currency: spendCurrency } =
    getSupplierSpend(payments, hotels);
  const topSuppliers = supplierSpend.slice(0, 5);
  const top3Concentration = supplierSpend
    .slice(0, 3)
    .reduce((s, r) => s + r.shareOfOutbound, 0);
  const anomalies = detectAnomalies({ tours, invoices, payments });
  const catalogHealth = analyzeCatalogHealth(hotels, packages);

  const trendDelta = (() => {
    if (revenueTrend.length < 2) return null;
    const a = revenueTrend[revenueTrend.length - 2].revenue;
    const b = revenueTrend[revenueTrend.length - 1].revenue;
    if (a === 0) return b === 0 ? 0 : 1;
    return (b - a) / a;
  })();

  const maxTrend = Math.max(...revenueTrend.map((p) => p.revenue), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold text-[#11272b]">
          <Sparkles className="h-6 w-6 text-[#12343b]" />
          Insights
        </h1>
        <p className="mt-1 text-sm text-[#5e7279]">
          Revenue trend, supplier concentration, anomaly alerts — what to watch
          this week.
        </p>
      </div>

      {/* Anomalies */}
      <section className="paraiso-card rounded-2xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-[#c9922f]" />
          <h2 className="text-lg font-semibold text-[#11272b]">
            Anomaly alerts ({anomalies.length})
          </h2>
        </div>
        {anomalies.length === 0 ? (
          <p className="text-sm text-[#5e7279]">
            Nothing flagged right now — everything reconciles.
          </p>
        ) : (
          <ul className="space-y-3">
            {anomalies.map((a, i) => {
              const tone =
                a.severity === "critical"
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : a.severity === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-[#e0e4dd] bg-[#f4ecdd] text-[#5e7279]";
              const Icon =
                a.severity === "info" ? Info : AlertTriangle;
              const href =
                a.entityType === "invoice"
                  ? `/admin/invoices/${a.entityId}`
                  : a.entityType === "tour"
                    ? `/admin/tours/${a.entityId}`
                    : a.entityType === "payment"
                      ? `/admin/payments/${a.entityId}`
                      : null;
              const body = (
                <div
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${tone}`}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{a.title}</p>
                    <p className="mt-0.5 text-xs opacity-80">{a.detail}</p>
                  </div>
                </div>
              );
              return (
                <li key={`${a.kind}-${i}`}>
                  {href ? <Link href={href}>{body}</Link> : body}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Catalog health — untagged hotels / missing emails / missing supplier IDs */}
      <section className="paraiso-card rounded-2xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <PackageOpen className="h-5 w-5 text-[#c9922f]" />
          <h2 className="text-lg font-semibold text-[#11272b]">
            Catalog health ({catalogHealth.gaps.length})
          </h2>
          <span className="ml-auto text-xs text-[#8a9ba1]">
            {catalogHealth.stats.hotelsWithDestination}/{catalogHealth.stats.totalHotels} hotels tagged ·
            {" "}{catalogHealth.stats.hotelsWithEmail}/{catalogHealth.stats.totalHotels} have email ·
            {" "}{catalogHealth.stats.optionsWithSupplier}/{catalogHealth.stats.optionsChecked} package options linked
          </span>
        </div>
        {catalogHealth.gaps.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-[#dce8dc] bg-[#ebf4ea] px-4 py-3 text-sm text-[#375a3f]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Everything looks clean. Hotels are all tagged to destinations,
              suppliers have emails, and every package option is linked to a
              catalog supplier.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {catalogHealth.gaps.slice(0, 20).map((g) => {
              const tone =
                g.severity === "critical"
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : g.severity === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-[#e0e4dd] bg-[#f4ecdd] text-[#5e7279]";
              const Icon = g.severity === "info" ? Info : AlertTriangle;
              return (
                <li key={g.id}>
                  <Link
                    href={g.fixHref}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition hover:-translate-y-px hover:shadow-sm ${tone}`}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{g.title}</p>
                      <p className="mt-0.5 text-xs opacity-80">{g.detail}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold uppercase tracking-wider opacity-70">
                      Fix →
                    </span>
                  </Link>
                </li>
              );
            })}
            {catalogHealth.gaps.length > 20 && (
              <li className="text-center text-xs text-[#8a9ba1]">
                …and {catalogHealth.gaps.length - 20} more. Fix the ones above first and refresh.
              </li>
            )}
          </ul>
        )}
      </section>

      {/* Revenue trend */}
      <section className="paraiso-card rounded-2xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[#12343b]" />
          <h2 className="text-lg font-semibold text-[#11272b]">Revenue trend</h2>
          {trendDelta != null && (
            <span
              className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${
                trendDelta >= 0
                  ? "bg-[#dce8dc] text-[#375a3f]"
                  : "bg-[#eed9cf] text-[#7c3a24]"
              }`}
            >
              {trendDelta >= 0 ? "+" : ""}
              {(trendDelta * 100).toFixed(1)}% MoM
            </span>
          )}
        </div>
        <div className="grid grid-cols-6 gap-2 h-40">
          {revenueTrend.map((p) => {
            const pct = (p.revenue / maxTrend) * 100;
            return (
              <div key={p.month} className="flex flex-col items-center justify-end gap-1">
                <div
                  className="w-full rounded-t-md bg-[#12343b] transition"
                  style={{ height: `${Math.max(2, pct)}%` }}
                  title={`${p.revenue.toLocaleString()} · ${p.tours} tours`}
                />
                <span className="text-[10px] font-medium text-[#8a9ba1]">
                  {p.month.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-6 gap-2 text-center">
          {revenueTrend.map((p) => (
            <div key={p.month} className="text-[11px] text-[#5e7279]">
              <div className="font-semibold text-[#11272b]">
                {Math.round(p.revenue / 1000)}k
              </div>
              <div>{p.tours} tour{p.tours === 1 ? "" : "s"}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Supplier concentration */}
      <section className="paraiso-card rounded-2xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-[#12343b]" />
          <h2 className="text-lg font-semibold text-[#11272b]">
            Top suppliers by spend
          </h2>
          {totalOutbound > 0 && (
            <span className="ml-auto rounded-full bg-[#f4ecdd] px-3 py-1 text-xs font-semibold text-[#5e7279]">
              Top 3 = {(top3Concentration * 100).toFixed(0)}% of all outbound
            </span>
          )}
        </div>
        {topSuppliers.length === 0 ? (
          <p className="text-sm text-[#5e7279]">
            No supplier spend recorded yet.
          </p>
        ) : (
          <div className="space-y-3">
            {topSuppliers.map((s) => (
              <div
                key={s.supplierId}
                className="rounded-xl border border-[#e0e4dd] bg-[#fffbf4] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-[#11272b]">{s.supplierName}</p>
                    <p className="text-xs uppercase tracking-wider text-[#8a9ba1]">
                      {s.type}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold text-[#11272b]">
                      {s.total.toLocaleString()} {s.currency}
                    </div>
                    <div className="text-xs text-[#5e7279]">
                      {s.paid.toLocaleString()} paid · {s.pending.toLocaleString()} pending
                    </div>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f4ecdd]">
                  <div
                    className="h-full bg-[#12343b]"
                    style={{ width: `${Math.min(100, s.shareOfOutbound * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-[#5e7279]">
                  {(s.shareOfOutbound * 100).toFixed(1)}% of outbound · {spendCurrency}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
