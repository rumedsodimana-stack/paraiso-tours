"use client";

import { InvoiceLetterhead } from "@/components/InvoiceLetterhead";
import type { Invoice, InvoiceStatus } from "@/lib/types";

function statusLabel(s: InvoiceStatus): string {
  switch (s) {
    case "pending_payment": return "Pending Payment";
    case "paid": return "Paid";
    case "overdue": return "Overdue";
    case "cancelled": return "Cancelled";
    default: return s;
  }
}

/**
 * Status pill colors. Match the PDF status-pill palette exactly so
 * a screenshotted invoice reads the same as the downloaded one.
 */
function statusBadgeClass(s: InvoiceStatus): string {
  switch (s) {
    case "pending_payment":
      return "bg-amber-100 text-amber-800 print:bg-amber-100";
    case "paid":
      return "bg-emerald-100 text-emerald-800 print:bg-emerald-100";
    case "overdue":
      return "bg-rose-100 text-rose-800 print:bg-rose-100";
    case "cancelled":
      return "bg-stone-100 text-stone-600 print:bg-stone-100";
    default:
      return "bg-stone-100 text-stone-600";
  }
}

interface InvoiceDocumentProps {
  invoice: Invoice;
  letterhead?: {
    companyName?: string;
    tagline?: string;
    address?: string;
    phone?: string;
    email?: string;
    logoUrl?: string;
  };
}

export function InvoiceDocument({ invoice, letterhead }: InvoiceDocumentProps) {
  const issuedDate = new Date(invoice.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const paidDate = invoice.paidAt
    ? new Date(invoice.paidAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div
      className="mx-auto max-w-[210mm] bg-white text-[#11272b] print:max-w-none print:shadow-none"
      style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
    >
      <InvoiceLetterhead {...letterhead} kicker="Invoice" />

      {/* Title row: invoice number + status pill, with issued/paid meta */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#11272b]">
            {invoice.invoiceNumber}
          </h2>
          <p className="mt-2 text-sm text-[#5e7279]">
            <span>Issued {issuedDate}</span>
            {invoice.travelDate && (
              <>
                <span className="mx-2 text-[#c9922f]">·</span>
                <span>Travel {invoice.travelDate}</span>
              </>
            )}
            {invoice.reference && (
              <>
                <span className="mx-2 text-[#c9922f]">·</span>
                <span>Ref {invoice.reference}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${statusBadgeClass(invoice.status)}`}
          >
            {statusLabel(invoice.status)}
          </span>
          {paidDate && (
            <p className="text-xs text-[#5e7279]">Paid {paidDate}</p>
          )}
        </div>
      </div>

      {/* Bill to + Booking details cards */}
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#e0e4dd] bg-[#fffbf4] p-5 print:border-[#e0e4dd]">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c9922f]">
            Bill to
          </h3>
          <p className="mt-3 font-semibold text-[#11272b]">
            {invoice.clientName}
          </p>
          <p className="mt-1 text-sm text-[#5e7279]">{invoice.clientEmail}</p>
          {invoice.clientPhone && (
            <p className="mt-1 text-sm text-[#5e7279]">{invoice.clientPhone}</p>
          )}
        </div>
        <div className="rounded-2xl border border-[#e0e4dd] bg-[#fffbf4] p-5 print:border-[#e0e4dd]">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c9922f]">
            Booking details
          </h3>
          <p className="mt-3 font-semibold text-[#11272b]">
            {invoice.packageName}
          </p>
          <div className="mt-1 space-y-0.5 text-sm text-[#5e7279]">
            {invoice.travelDate && <p>Travel: {invoice.travelDate}</p>}
            {invoice.pax != null && (
              <p>
                {invoice.pax} {invoice.pax === 1 ? "traveller" : "travellers"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Line items table — gold accent header, zebra rows */}
      <div className="overflow-hidden rounded-2xl border border-[#e0e4dd] print:border-[#e0e4dd]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#c9922f] bg-[#fffbf4] print:bg-[#fffbf4]">
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-[#c9922f]">
                Description
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.18em] text-[#c9922f]">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#f4ecdd] odd:bg-[#fffbf4] print:odd:bg-[#fffbf4]">
              <td className="px-4 py-3 text-[#11272b]">Base package</td>
              <td className="px-4 py-3 text-right font-medium text-[#11272b]">
                {invoice.baseAmount.toLocaleString()} {invoice.currency}
              </td>
            </tr>
            {invoice.lineItems.map((item, i) => (
              <tr
                key={i}
                className="border-b border-[#f4ecdd] odd:bg-[#fffbf4] print:odd:bg-[#fffbf4]"
              >
                <td className="px-4 py-3 text-[#11272b]">{item.description}</td>
                <td className="px-4 py-3 text-right font-medium text-[#11272b]">
                  {item.amount.toLocaleString()} {invoice.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total band — gold-tinted, large teal amount, matches PDF */}
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#f6ead6] px-5 py-4 print:bg-[#f6ead6]">
        <span className="text-sm font-bold text-[#11272b]">Total due</span>
        <span className="text-2xl font-bold tracking-tight text-[#12343b]">
          {invoice.totalAmount.toLocaleString()} {invoice.currency}
        </span>
      </div>

      {/* Payment notes + booking summary */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.7fr]">
        <div className="rounded-2xl border border-[#e0e4dd] bg-[#fffbf4] p-5 print:border-[#e0e4dd]">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c9922f]">
            Payment terms
          </h3>
          <p className="mt-3 text-sm text-[#11272b]">
            Payment due within 14 days of invoice date. Bank transfer details
            on request.
          </p>
          {invoice.notes && (
            <div className="mt-4 border-t border-[#f4ecdd] pt-4">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c9922f]">
                Notes
              </h4>
              <p className="mt-2 text-sm text-[#5e7279]">{invoice.notes}</p>
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-[#12343b] p-5 text-[#f6ead6] print:bg-[#12343b]">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c9922f]">
            Summary
          </p>
          <p className="mt-3 text-sm text-[#f6ead6]/85">
            Invoice {invoice.invoiceNumber} for {invoice.clientName}
          </p>
          <p className="mt-2 text-2xl font-bold">
            {invoice.totalAmount.toLocaleString()} {invoice.currency}
          </p>
          <p className="mt-4 text-xs italic text-[#c9922f]">
            Thank you for choosing us — we&apos;re excited to host your journey.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 border-t border-[#e0e4dd] pt-4 text-xs text-[#5e7279]">
        <p>
          Generated on {issuedDate}. Please quote invoice number{" "}
          <span className="font-semibold text-[#11272b]">
            {invoice.invoiceNumber}
          </span>{" "}
          when making payment or contacting support.
        </p>
      </div>
    </div>
  );
}
