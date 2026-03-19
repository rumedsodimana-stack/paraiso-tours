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

export default async function FinancePage() {
  const [tours, invoices, suppliers, payments, leads] = await Promise.all([
    getTours(),
    getInvoices(),
    getHotels(),
    getPayments(),
    getLeads(),
  ]);


  const [kpis, revenueCost, cashFlow, marginByPackage, marginByTour] = await Promise.all([
    getFinanceKPIs({
      tours,
      invoices,
      payments,
      getLead,
      getPackage,
      suppliers,
    }),
    getRevenueCostData(
      {
        tours,
        getLead,
        getPackage,
        suppliers,
      },
      6
    ),
    Promise.resolve(getCashFlowData(payments, 6)),
    getMarginByPackage({ tours, getLead, getPackage, suppliers }),
    getMarginByTour({ tours, getLead, getPackage, suppliers }),
  ]);

  const aging = getReceivablesAging(invoices);
  const conversionFunnel = getConversionFunnel(leads);
  const revenueBySource = getRevenueBySource(tours, leads);

  const kpiCards = [
    {
      label: "Cash",
      value: kpis.cash,
      icon: Wallet,
      color: "emerald",
      href: "/admin/payments",
    },
    {
      label: "Receivables",
      value: kpis.receivables,
      icon: Receipt,
      color: "amber",
      href: "/admin/payments",
    },
    {
      label: "Payables",
      value: kpis.payables,
      icon: Landmark,
      color: "rose",
      href: "/admin/payables",
    },
    {
      label: "Revenue",
      value: kpis.revenue,
      icon: TrendingUp,
      color: "teal",
    },
    {
      label: "Margin",
      value: kpis.margin,
      icon: kpis.margin >= 0 ? TrendingUp : TrendingDown,
      color: kpis.margin >= 0 ? "emerald" : "rose",
    },
  ];

  const cashFlowFormatted = cashFlow.map((p) => ({
    month: formatMonth(p.month),
    incoming: p.incoming,
    outgoing: p.outgoing,
  }));

  const revenueCostFormatted = revenueCost.map((p) => ({
    month: formatMonth(p.month),
    revenue: p.revenue,
    cost: p.cost,
    margin: p.margin,
  }));

  const agingFormatted = aging.map((a) => ({
    bucket: a.bucket,
    amount: a.amount,
    count: a.count,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
          Finance
        </h1>
        <p className="mt-1 text-stone-600 dark:text-stone-400">
          Cash flow, revenue, costs, and receivables overview
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpiCards.map(({ label, value, icon: Icon, color, href }) => (
          <Link
            key={label}
            href={href ?? "#"}
            className={`block rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl transition hover:bg-white/60 ${
              !href ? "pointer-events-none cursor-default" : ""
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
                  {label}
                </p>
                <p className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-50">
                  {value.toLocaleString()} {kpis.currency}
                </p>
              </div>
              <div
                className={`rounded-lg p-3 ${
                  color === "emerald"
                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                    : color === "amber"
                    ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30"
                    : color === "rose"
                    ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30"
                    : color === "teal"
                    ? "bg-teal-100 text-teal-600 dark:bg-teal-900/30"
                    : "bg-stone-100 text-stone-600"
                }`}
              >
                <Icon className="h-6 w-6" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
          <h2 className="mb-4 text-lg font-semibold text-stone-900 dark:text-stone-50">
            Cash Flow
          </h2>
          <p className="mb-4 text-sm text-stone-500">
            Incoming vs outgoing payments by month
          </p>
          <CashFlowChart data={cashFlowFormatted} />
        </div>

        <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
          <h2 className="mb-4 text-lg font-semibold text-stone-900 dark:text-stone-50">
            Revenue vs Cost
          </h2>
          <p className="mb-4 text-sm text-stone-500">
            Tour revenue and supplier costs by month
          </p>
          <RevenueCostChart data={revenueCostFormatted} />
        </div>
      </div>

      <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">
              Receivables Aging
            </h2>
            <p className="text-sm text-stone-500">
              Outstanding invoices by days since issue
            </p>
          </div>
          <Link
            href="/admin/payments"
            className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700"
          >
            View payments
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <AgingChart data={agingFormatted} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
          <h2 className="mb-4 text-lg font-semibold text-stone-900 dark:text-stone-50">
            Conversion Funnel
          </h2>
          <p className="mb-4 text-sm text-stone-500">
            Lead pipeline by status
          </p>
          <ConversionFunnelChart data={conversionFunnel} />
        </div>

        <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
          <h2 className="mb-4 text-lg font-semibold text-stone-900 dark:text-stone-50">
            Revenue by Source
          </h2>
          <p className="mb-4 text-sm text-stone-500">
            Tour revenue attributed to lead source
          </p>
          <RevenueBySourceChart data={revenueBySource} />
        </div>
      </div>

      <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
        <h2 className="mb-4 text-lg font-semibold text-stone-900 dark:text-stone-50">
          Margin by Package
        </h2>
        <p className="mb-4 text-sm text-stone-500">
          Revenue, cost, and margin aggregated by package
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-700">
                <th className="py-2 text-left font-medium">Package</th>
                <th className="py-2 text-right font-medium">Revenue</th>
                <th className="py-2 text-right font-medium">Cost</th>
                <th className="py-2 text-right font-medium">Margin</th>
                <th className="py-2 text-right font-medium">Margin %</th>
                <th className="py-2 text-right font-medium">Tours</th>
              </tr>
            </thead>
            <tbody>
              {marginByPackage.map((row) => (
                <tr key={row.packageId} className="border-b border-stone-100 dark:border-stone-800">
                  <td className="py-2">{row.packageName}</td>
                  <td className="py-2 text-right">{row.revenue.toLocaleString()}</td>
                  <td className="py-2 text-right">{row.cost.toLocaleString()}</td>
                  <td className="py-2 text-right">{row.margin.toLocaleString()}</td>
                  <td className="py-2 text-right">{row.marginPct.toFixed(1)}%</td>
                  <td className="py-2 text-right">{row.tourCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
        <h2 className="mb-4 text-lg font-semibold text-stone-900 dark:text-stone-50">
          Margin by Tour
        </h2>
        <p className="mb-4 text-sm text-stone-500">
          Revenue, cost, and margin per confirmed tour
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-700">
                <th className="py-2 text-left font-medium">Client</th>
                <th className="py-2 text-left font-medium">Package</th>
                <th className="py-2 text-left font-medium">Start</th>
                <th className="py-2 text-right font-medium">Revenue</th>
                <th className="py-2 text-right font-medium">Cost</th>
                <th className="py-2 text-right font-medium">Margin</th>
                <th className="py-2 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {marginByTour.map((row) => (
                <tr key={row.tourId} className="border-b border-stone-100 dark:border-stone-800">
                  <td className="py-2">{row.clientName}</td>
                  <td className="py-2">{row.packageName}</td>
                  <td className="py-2">{row.startDate}</td>
                  <td className="py-2 text-right">{row.revenue.toLocaleString()}</td>
                  <td className="py-2 text-right">{row.cost.toLocaleString()}</td>
                  <td className="py-2 text-right">{row.margin.toLocaleString()}</td>
                  <td className="py-2 text-right">{row.marginPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
