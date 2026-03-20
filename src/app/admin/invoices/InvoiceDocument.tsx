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

function statusBadgeClass(s: InvoiceStatus): string {
  switch (s) {
    case "pending_payment": return "bg-amber-100 text-amber-800 print:bg-amber-100";
    case "paid": return "bg-emerald-100 text-emerald-800 print:bg-emerald-100";
    case "overdue": return "bg-rose-100 text-rose-800 print:bg-rose-100";
    case "cancelled": return "bg-stone-100 text-stone-600 print:bg-stone-100";
    default: return "bg-stone-100 text-stone-600";
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
  return (
    <div className="max-w-[210mm] mx-auto bg-white text-stone-900 print:max-w-none print:shadow-none">
      <InvoiceLetterhead {...letterhead} />
      <div className="flex justify-between items-start gap-6 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">INVOICE</h2>
          <p className="mt-1 text-sm text-stone-600">Invoice #{invoice.invoiceNumber}</p>
          <p className="text-sm text-stone-500">
            Date: {new Date(invoice.createdAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(invoice.status)}`}
        >
          {statusLabel(invoice.status)}
        </span>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 mb-8">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Bill to</h3>
          <p className="font-medium text-stone-900">{invoice.clientName}</p>
          <p className="text-sm text-stone-600">{invoice.clientEmail}</p>
          {invoice.clientPhone && (
            <p className="text-sm text-stone-600">{invoice.clientPhone}</p>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Booking details</h3>
        <p className="font-medium text-stone-900">{invoice.packageName}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
          {invoice.travelDate && (
            <span>Travel date: {invoice.travelDate}</span>
          )}
          {invoice.pax != null && (
            <span>Pax: {invoice.pax}</span>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-200 print:border-stone-300">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 print:bg-stone-100">
              <th className="px-4 py-3 text-left font-semibold text-stone-700">Description</th>
              <th className="px-4 py-3 text-right font-semibold text-stone-700">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-stone-100">
              <td className="px-4 py-3 text-stone-700">Base package</td>
              <td className="px-4 py-3 text-right">
                {invoice.baseAmount.toLocaleString()} {invoice.currency}
              </td>
            </tr>
            {invoice.lineItems.map((item, i) => (
              <tr key={i} className="border-b border-stone-100">
                <td className="px-4 py-3 text-stone-700">{item.description}</td>
                <td className="px-4 py-3 text-right">
                  {item.amount.toLocaleString()} {invoice.currency}
                </td>
              </tr>
            ))}
            <tr className="bg-teal-50/50 print:bg-teal-50">
              <td className="px-4 py-3 font-semibold text-stone-900">Total</td>
              <td className="px-4 py-3 text-right font-semibold text-stone-900">
                {invoice.totalAmount.toLocaleString()} {invoice.currency}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-8 pt-6 border-t border-stone-200 space-y-4 text-sm text-stone-600">
        <p>
          <span className="font-medium text-stone-700">Payment terms:</span> Payment due within 14 days of invoice date.
        </p>
        <p>
          <span className="font-medium text-stone-700">Bank details:</span> [Add your bank account details here for wire transfer]
        </p>
        {invoice.notes && (
          <p>
            <span className="font-medium text-stone-700">Notes:</span> {invoice.notes}
          </p>
        )}
      </div>
    </div>
  );
}
