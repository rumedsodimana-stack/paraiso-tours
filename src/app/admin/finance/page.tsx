import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowRight,
  Receipt,
  Landmark,
} from "lucide-react";
import { CashFlowChart } from "./CashFlowChart";
import { RevenueCostChart } from "./RevenueCostChart";
import { AgingChart } from "./AgingChart";
import { ConversionFunnelChart } from "./ConversionFunnelChart";
import { RevenueBySourceChart } from "./RevenueBySourceChart";
import { getTours, getInvoices, getLead, getPackage, getHotels, getPayments, getLeads } from "@/lib/db";
import {
  getFinanceKPIs,
  getCashFlowData,
  getRevenueCostData,
  getReceivablesAging,
  getMarginByPackage,
  getMarginByTour,
  getConversionFunnel,
  getRevenueBySource,
} from "@/lib/finance";

export const dynamic = "force-dynamic";

function formatMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

const KPI_ICON_STYLE: Record<string, string> = {
  emerald: "bg-[#dce8dc] text-[#375a3f]",
  amber:   "bg-[#f3e8ce] text-[#7a5a17]",
  rose:    "bg-[#eed9cf] text-[#7c3a24]",
  teal:    "bg-[#eef4f4] text-[#12343b]",
  stone:   "bg-[#e2e3dd] text-[#545a54]",
};

export default async function FinancePage() {
  const [tours, invoices, suppliers, payments, leads] = await Promise.all([
    getTours(),
    getInvoices(),
    getHotels(),
    getPayments(),
    getLeads(),
  ]);

  const [kpis, revenueCost, cashFlow, marginByPackage, marginByTour] = await Promise.all([
    getFinanceKPIs({ tours, invoices, payments, getLead, getPackage, suppliers }),
    getRevenueCostData({ tours, getLead, getPackage, suppliers }, 6),
    Promise.resolve(getCashFlowData(payments, 6)),
    getMarginByPackage({ tours, getLead, getPackage, suppliers }),
    getMarginByTour({ tours, getLead, getPackage, suppliers }),
  ]);

  const aging = getReceivablesAging(invoices);
  const conversionFunnel = getConversionFunnel(leads);
  const revenueBySource = getRevenueBySource(tours, leads);

  const kpiCards = [
    { label: "Cash",        value: kpis.cash,        icon: Wallet,    color: "emerald", href: "/admin/payments" },
    { label: "Receivables", value: kpis.receivables,  icon: Receipt,   color: "amber",   href: "/admin/payments" },
    { label: "Payables",    value: kpis.payables,     icon: Landmark,  color: "rose",    href: "/admin/payables" },
    { label: "Revenue",     value: kpis.revenue,      icon: TrendingUp, color: "teal" },
    { label: "Margin",      value: kpis.margin,       icon: kpis.margin >= 0 ? TrendingUp : TrendingDown, color: kpis.margin >= 0 ? "emerald" : "rose" },
  ];

  const cashFlowFormatted = cashFlow.map((p) => ({ month: formatMonth(p.month), incoming: p.incoming, outgoing: p.outgoing }));
  const revenueCostFormatted = revenueCost.map((p) => ({ month: formatMonth(p.month), revenue: p.revenue, cost: p.cost, margin: p.margin }));
  const agingFormatted = aging.map((a) => ({ bucket: a.bucket, amount: a.amount, count: a.count }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#11272b]">Finance</h1>
        <p className="mt-1 text-sm text-[#5e7279]">Cash flow, revenue, costs, and receivables overview</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpiCards.map(({ label, value, icon: Icon, color, href }) => (
          <Link
            key={label}
            href={href ?? "#"}
            className={`paraiso-card block rounded-2xl p-5 transition hover:bg-[#f4ecdd] ${!href ? "pointer-events-none" : ""}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">{label}</p>
                <p className="mt-1 text-xl font-bold text-[#11272b]">
                  {value.toLocaleString()} {kpis.currency}
                </p>
              </div>
              <div className={`rounded-lg p-2.5 ${KPI_ICON_STYLE[color] ?? KPI_ICON_STYLE.stone}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="paraiso-card rounded-2xl p-6">
          <h2 className="mb-1 text-base font-semibold text-[#11272b]">Cash Flow</h2>
          <p className="mb-4 text-sm text-[#8a9ba1]">Incoming vs outgoing payments by month</p>
          <CashFlowChart data={cashFlowFormatted} />
        </div>
        <div className="paraiso-card rounded-2xl p-6">
          <h2 className="mb-1 text-base font-semibold text-[#11272b]">Revenue vs Cost</h2>
          <p className="mb-4 text-sm text-[#8a9ba1]">Tour revenue and supplier costs by month</p>
          <RevenueCostChart data={revenueCostFormatted} />
        </div>
      </div>

      <div className="paraiso-card rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#11272b]">Receivables Aging</h2>
            <p className="text-sm text-[#8a9ba1]">Outstanding invoices by days since issue</p>
          </div>
          <Link href="/admin/payments" className="inline-flex items-center gap-1 text-sm font-medium text-[#12343b] hover:underline">
            View payments <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <AgingChart data={agingFormatted} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="paraiso-card rounded-2xl p-6">
          <h2 className="mb-1 text-base font-semibold text-[#11272b]">Conversion Funnel</h2>
          <p className="mb-4 text-sm text-[#8a9ba1]">Lead pipeline by status</p>
          <ConversionFunnelChart data={conversionFunnel} />
        </div>
        <div className="paraiso-card rounded-2xl p-6">
          <h2 className="mb-1 text-base font-semibold text-[#11272b]">Revenue by Source</h2>
          <p className="mb-4 text-sm text-[#8a9ba1]">Tour revenue attributed to lead source</p>
          <RevenueBySourceChart data={revenueBySource} />
        </div>
      </div>

      <div className="paraiso-card rounded-2xl p-6">
        <h2 className="mb-1 text-base font-semibold text-[#11272b]">Margin by Package</h2>
        <p className="mb-4 text-sm text-[#8a9ba1]">Revenue, cost, and margin aggregated by package</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e0e4dd] bg-[#f4ecdd]">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Package</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Revenue</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Cost</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Margin</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Margin %</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Tours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e4dd]">
              {marginByPackage.map((row) => (
                <tr key={row.packageId} className="hover:bg-[#faf6ef]">
                  <td className="px-3 py-2.5 font-medium text-[#11272b]">{row.packageName}</td>
                  <td className="px-3 py-2.5 text-right text-[#5e7279]">{row.revenue.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-[#5e7279]">{row.cost.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-[#11272b]">{row.margin.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-[#5e7279]">{row.marginPct.toFixed(1)}%</td>
                  <td className="px-3 py-2.5 text-right text-[#5e7279]">{row.tourCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="paraiso-card rounded-2xl p-6">
        <h2 className="mb-1 text-base font-semibold text-[#11272b]">Margin by Tour</h2>
        <p className="mb-4 text-sm text-[#8a9ba1]">Revenue, cost, and margin per confirmed tour</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e0e4dd] bg-[#f4ecdd]">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Client</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Package</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Start</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Revenue</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Cost</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Margin</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e4dd]">
              {marginByTour.map((row) => (
                <tr key={row.tourId} className="hover:bg-[#faf6ef]">
                  <td className="px-3 py-2.5 font-medium text-[#11272b]">{row.clientName}</td>
                  <td className="px-3 py-2.5 text-[#5e7279]">{row.packageName}</td>
                  <td className="px-3 py-2.5 text-[#5e7279]">{row.startDate}</td>
                  <td className="px-3 py-2.5 text-right text-[#5e7279]">{row.revenue.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-[#5e7279]">{row.cost.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-[#11272b]">{row.margin.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-[#5e7279]">{row.marginPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
