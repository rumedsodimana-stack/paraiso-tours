import Link from "next/link";
import { ChevronLeft, ChevronRight, Landmark } from "lucide-react";
import { getAppSettings, getDisplayCompanyName } from "@/lib/app-config";
import { getTours, getLead, getPackage, getHotels, getPayments } from "@/lib/db";
import { getPayablesForDateRange, getWeekBounds } from "@/lib/payables";
import { PrintButton } from "./PrintButton";

function encodePayableSlug(supplierId: string, currency: string, startDate: string, endDate: string) {
  return encodeURIComponent(`${supplierId}|${currency}|${startDate}|${endDate}`);
}

function formatWeekLabel(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function PayablesPage({
  searchParams,
}: {
  searchParams?: Promise<{ week?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const weekParam = params.week;
  const refDate = weekParam ? new Date(weekParam) : new Date();
  const { startDate, endDate } = getWeekBounds(refDate);

  const [tours, suppliers, payments, settings] = await Promise.all([
    getTours(),
    getHotels(),
    getPayments(),
    getAppSettings(),
  ]);
  const brandName = getDisplayCompanyName(settings);

  const activeTours = tours.filter((t) => t.status !== "cancelled");
  const paidPayments = payments
    .filter((p) => p.type === "outgoing" && p.supplierId && p.payableWeekStart && p.payableWeekEnd)
    .map((p) => ({
      supplierId: p.supplierId!,
      currency: p.currency,
      payableWeekStart: p.payableWeekStart!,
      payableWeekEnd: p.payableWeekEnd!,
    }));

  const payables = await getPayablesForDateRange({
    tours: activeTours,
    getLead: getLead,
    getPackage: getPackage,
    suppliers,
    startDate,
    endDate,
    paidPayments,
  });

  const prevWeek = addDays(startDate, -7);
  const nextWeek = addDays(startDate, 7);

  const totalByCurrency = payables.reduce(
    (acc, p) => {
      acc[p.currency] = (acc[p.currency] ?? 0) + p.amount;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
            Payables
          </h1>
          <p className="mt-1 text-stone-600 dark:text-stone-400">
            All supplier payment extraction. Click a payable to view breakdown and mark as paid.
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="flex flex-wrap items-center gap-4 print:hidden">
        <div className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/50 px-3 py-2 backdrop-blur-sm">
          <Link
            href={`/admin/payables?week=${prevWeek}`}
            className="rounded-lg p-1.5 text-stone-600 transition hover:bg-white/70 hover:text-stone-900"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <span className="min-w-[200px] text-center font-medium text-stone-800 dark:text-stone-100">
            {formatWeekLabel(startDate, endDate)}
          </span>
          <Link
            href={`/admin/payables?week=${nextWeek}`}
            className="rounded-lg p-1.5 text-stone-600 transition hover:bg-white/70 hover:text-stone-900"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
        <Link
          href={`/admin/payables?week=${new Date().toISOString().slice(0, 10)}`}
          className="text-sm text-teal-600 hover:text-teal-700"
        >
          This week
        </Link>
        <Link
          href={`/admin/payables?week=${addDays(new Date().toISOString().slice(0, 10), 7)}`}
          className="text-sm text-teal-600 hover:text-teal-700"
        >
          Next week
        </Link>
      </div>

      {payables.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-white/40 bg-white/30 py-16 text-center backdrop-blur-xl">
          <Landmark className="mx-auto h-12 w-12 text-stone-400" />
          <p className="mt-4 text-stone-600 dark:text-stone-400">
            No supplier payables for tours starting this week
          </p>
          <p className="mt-1 text-sm text-stone-500">
            Add tours and ensure packages have suppliers with cost prices.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 print:mb-4">
            {Object.entries(totalByCurrency).map(([currency, amount]) => (
              <div
                key={currency}
                className="rounded-xl border border-stone-200/60 bg-white/60 px-4 py-2 backdrop-blur-sm"
              >
                <span className="text-xs font-medium uppercase text-stone-500">
                  Total {currency}
                </span>
                <p className="font-semibold text-stone-900 dark:text-stone-50">
                  {amount.toLocaleString()} {currency}
                </p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/30 bg-white/50 shadow-lg backdrop-blur-xl">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200/60 bg-stone-50/80 dark:bg-stone-900/30">
                  <th className="px-4 py-3 font-semibold text-stone-700 dark:text-stone-200">
                    Supplier
                  </th>
                  <th className="px-4 py-3 font-semibold text-stone-700 dark:text-stone-200">
                    Amount
                  </th>
                  <th className="px-4 py-3 font-semibold text-stone-700 dark:text-stone-200">
                    Bank Details
                  </th>
                  <th className="px-4 py-3 font-semibold text-stone-700 dark:text-stone-200 print:hidden">
                    Bookings
                  </th>
                  <th className="px-4 py-3 font-semibold text-stone-700 dark:text-stone-200 print:hidden w-24">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {payables.map((p) => (
                  <tr
                    key={`${p.supplierId}-${p.currency}`}
                    className="border-b border-stone-100 last:border-0 hover:bg-white/70 transition print:hover:bg-transparent"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/payables/${encodePayableSlug(p.supplierId, p.currency, startDate, endDate)}`}
                        className="block font-medium text-stone-900 dark:text-stone-50 hover:text-teal-600"
                      >
                        {p.supplierName}
                      </Link>
                      <p className="text-xs capitalize text-stone-500">
                        {p.supplierType}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums">
                      {p.amount.toLocaleString()} {p.currency}
                    </td>
                    <td className="px-4 py-3">
                      {p.bankName || p.accountNumber ? (
                        <div className="space-y-0.5 text-stone-600 dark:text-stone-400">
                          {p.bankName && <p>{p.bankName}{p.bankBranch ? `, ${p.bankBranch}` : ""}</p>}
                          {p.accountName && <p>{p.accountName}</p>}
                          {p.accountNumber && <p className="font-mono text-xs">{p.accountNumber}</p>}
                          {p.swiftCode && <p>SWIFT: {p.swiftCode}</p>}
                          {p.bankCurrency && <p>Currency: {p.bankCurrency}</p>}
                          {p.paymentReference && (
                            <p className="text-xs">Ref: {p.paymentReference}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-amber-600">
                          Add banking details in Hotels & Suppliers
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 print:hidden">
                      <ul className="space-y-1 text-xs text-stone-600">
                        {p.bookings.slice(0, 3).map((b, i) => (
                          <li key={i}>
                            {b.clientName} – {b.packageName} ({b.tourStartDate})
                          </li>
                        ))}
                        {p.bookings.length > 3 && (
                          <li className="text-stone-500">
                            +{p.bookings.length - 3} more
                          </li>
                        )}
                      </ul>
                    </td>
                    <td className="px-4 py-3 print:hidden">
                      <Link
                        href={`/admin/payables/${encodePayableSlug(p.supplierId, p.currency, startDate, endDate)}`}
                        className="text-sm font-medium text-teal-600 hover:text-teal-700 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-stone-500 print:block">
            {brandName} – Payables – {formatWeekLabel(startDate, endDate)}. Use
            Print → Save as PDF for bank transfer instructions.
          </p>
        </>
      )}
    </div>
  );
}
