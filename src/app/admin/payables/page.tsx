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
    getLead,
    getPackage,
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
          <h1 className="text-2xl font-bold text-[#11272b]">Payables</h1>
          <p className="mt-1 text-sm text-[#5e7279]">
            All supplier payment extraction. Click a payable to view breakdown and mark as paid.
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="flex flex-wrap items-center gap-4 print:hidden">
        <div className="paraiso-card flex items-center gap-2 rounded-xl px-3 py-2">
          <Link
            href={`/admin/payables?week=${prevWeek}`}
            className="rounded-lg p-1.5 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <span className="min-w-[200px] text-center text-sm font-medium text-[#11272b]">
            {formatWeekLabel(startDate, endDate)}
          </span>
          <Link
            href={`/admin/payables?week=${nextWeek}`}
            className="rounded-lg p-1.5 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
        <Link href={`/admin/payables?week=${new Date().toISOString().slice(0, 10)}`} className="text-sm font-medium text-[#12343b] hover:underline">
          This week
        </Link>
        <Link href={`/admin/payables?week=${addDays(new Date().toISOString().slice(0, 10), 7)}`} className="text-sm font-medium text-[#12343b] hover:underline">
          Next week
        </Link>
      </div>

      {payables.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#ddd3c4] bg-[#faf6ef] py-16 text-center">
          <Landmark className="mx-auto h-10 w-10 text-[#8a9ba1]" />
          <p className="mt-4 text-[#5e7279]">No supplier payables for tours starting this week</p>
          <p className="mt-1 text-sm text-[#8a9ba1]">
            Add tours and ensure packages have suppliers with cost prices.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 print:mb-4">
            {Object.entries(totalByCurrency).map(([currency, amount]) => (
              <div key={currency} className="paraiso-card rounded-xl px-4 py-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">
                  Total {currency}
                </span>
                <p className="font-bold text-[#11272b]">
                  {amount.toLocaleString()} {currency}
                </p>
              </div>
            ))}
          </div>

          <div className="paraiso-card overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#e0e4dd] bg-[#f4ecdd]">
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Supplier</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Amount</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Bank Details</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1] print:hidden">Bookings</th>
                  <th className="px-5 py-3.5 w-20 print:hidden" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e0e4dd]">
                {payables.map((p) => (
                  <tr key={`${p.supplierId}-${p.currency}`} className="transition hover:bg-[#faf6ef] print:hover:bg-transparent">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/payables/${encodePayableSlug(p.supplierId, p.currency, startDate, endDate)}`}
                        className="block font-medium text-[#11272b] hover:text-[#12343b]"
                      >
                        {p.supplierName}
                      </Link>
                      <p className="text-xs capitalize text-[#8a9ba1]">{p.supplierType}</p>
                    </td>
                    <td className="px-5 py-3.5 font-semibold tabular-nums text-[#11272b]">
                      {p.amount.toLocaleString()} {p.currency}
                    </td>
                    <td className="px-5 py-3.5">
                      {p.bankName || p.accountNumber ? (
                        <div className="space-y-0.5 text-xs text-[#5e7279]">
                          {p.bankName && <p>{p.bankName}{p.bankBranch ? `, ${p.bankBranch}` : ""}</p>}
                          {p.accountName && <p>{p.accountName}</p>}
                          {p.accountNumber && <p className="font-mono">{p.accountNumber}</p>}
                          {p.swiftCode && <p>SWIFT: {p.swiftCode}</p>}
                          {p.bankCurrency && <p>Currency: {p.bankCurrency}</p>}
                          {p.paymentReference && <p>Ref: {p.paymentReference}</p>}
                        </div>
                      ) : (
                        <p className="text-xs text-[#7a5a17]">Add banking details in Hotels &amp; Suppliers</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 print:hidden">
                      <ul className="space-y-1 text-xs text-[#5e7279]">
                        {p.bookings.slice(0, 3).map((b, i) => (
                          <li key={i}>{b.clientName} – {b.packageName} ({b.tourStartDate})</li>
                        ))}
                        {p.bookings.length > 3 && (
                          <li className="text-[#8a9ba1]">+{p.bookings.length - 3} more</li>
                        )}
                      </ul>
                    </td>
                    <td className="px-5 py-3.5 text-right print:hidden">
                      <Link
                        href={`/admin/payables/${encodePayableSlug(p.supplierId, p.currency, startDate, endDate)}`}
                        className="text-sm font-medium text-[#12343b] hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-[#8a9ba1] print:block">
            {brandName} – Payables – {formatWeekLabel(startDate, endDate)}. Use Print → Save as PDF for bank transfer instructions.
          </p>
        </>
      )}
    </div>
  );
}
