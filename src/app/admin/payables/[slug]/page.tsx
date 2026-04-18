import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { getTours, getLead, getPackage, getHotels, getPayments } from "@/lib/db";
import { getPayablesForDateRange, getWeekBounds } from "@/lib/payables";
import { PaidButton } from "./PaidButton";

function decodePayableSlug(slug: string): { supplierId: string; currency: string; startDate: string; endDate: string } | null {
  try {
    const decoded = decodeURIComponent(slug);
    const parts = decoded.split("|");
    if (parts.length !== 4) return null;
    return {
      supplierId: parts[0],
      currency: parts[1],
      startDate: parts[2],
      endDate: parts[3],
    };
  } catch {
    return null;
  }
}

function formatWeekLabel(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

export default async function PayableDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const parsed = decodePayableSlug(slug);
  if (!parsed) notFound();

  const { supplierId, currency, startDate, endDate } = parsed;

  const [tours, suppliers, payments] = await Promise.all([
    getTours(),
    getHotels(),
    getPayments(),
  ]);

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

  const payable = payables.find((p) => p.supplierId === supplierId && p.currency === currency);
  if (!payable) notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/payables?week=${startDate}`}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Payables
      </Link>

      <div className="paraiso-card rounded-2xl p-6">
        <h1 className="text-xl font-semibold text-[#11272b]">
          Payable – {payable.supplierName}
        </h1>
        <p className="mt-1 text-sm text-[#5e7279]">
          Week of {formatWeekLabel(startDate, endDate)}
        </p>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-[#5e7279]">Supplier</dt>
            <dd className="mt-0.5 font-medium text-[#11272b]">{payable.supplierName}</dd>
            <dd className="text-xs capitalize text-[#8a9ba1]">{payable.supplierType}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[#5e7279]">Amount</dt>
            <dd className="mt-0.5 text-xl font-semibold text-rose-600">
              {payable.amount.toLocaleString()} {payable.currency}
            </dd>
          </div>
        </dl>

        <div className="mt-6">
          <h2 className="text-sm font-semibold text-[#11272b]">Breakdown by booking</h2>
          <ul className="mt-2 space-y-2">
            {payable.bookings.map((b, i) => (
              <li key={i} className="flex justify-between rounded-lg border border-[#e0e4dd] bg-[#f4ecdd] px-4 py-3 text-sm">
                <span className="font-medium text-[#11272b]">
                  {b.clientName}
                </span>
                <span className="text-[#5e7279]">
                  {b.packageName} – {b.tourStartDate}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#11272b]">
            <Building2 className="h-4 w-4 text-[#8a9ba1]" />
            Bank details
          </h2>
          {payable.bankName || payable.accountNumber ? (
            <div className="mt-2 space-y-1 rounded-lg border border-[#e0e4dd] bg-[#f4ecdd] p-4 text-sm text-[#11272b]">
              {payable.bankName && (
                <p>{payable.bankName}{payable.bankBranch ? `, ${payable.bankBranch}` : ""}</p>
              )}
              {payable.accountName && <p>{payable.accountName}</p>}
              {payable.accountNumber && <p className="font-mono text-xs">{payable.accountNumber}</p>}
              {payable.swiftCode && <p>SWIFT: {payable.swiftCode}</p>}
              {payable.bankCurrency && <p>Currency: {payable.bankCurrency}</p>}
              {payable.paymentReference && <p className="text-xs">Ref: {payable.paymentReference}</p>}
            </div>
          ) : (
            <p className="mt-2 text-sm text-amber-600">
              Add banking details in Hotels & Suppliers
            </p>
          )}
        </div>

        <PaidButton
          supplierId={payable.supplierId}
          supplierName={payable.supplierName}
          amount={payable.amount}
          currency={payable.currency}
          startDate={startDate}
          endDate={endDate}
        />
      </div>
    </div>
  );
}
