import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";
import { getInvoices } from "@/lib/db";
import type { InvoiceStatus } from "@/lib/types";

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
    case "pending_payment": return "bg-amber-100 text-amber-800";
    case "paid": return "bg-emerald-100 text-emerald-800";
    case "overdue": return "bg-rose-100 text-rose-800";
    case "cancelled": return "bg-stone-100 text-stone-600";
    default: return "bg-stone-100 text-stone-600";
  }
}

export default async function InvoicesPage() {
  const invoices = await getInvoices();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
          Invoices
        </h1>
        <p className="mt-1 text-stone-600 dark:text-stone-400">
          View and manage client invoices
        </p>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-white/30 bg-white/50 px-6 py-12 text-center shadow-lg backdrop-blur-xl">
          <FileText className="mx-auto h-12 w-12 text-stone-300" />
          <p className="mt-3 font-medium text-stone-600">No invoices yet</p>
          <p className="mt-1 text-sm text-stone-500">
            Create an invoice from a booking detail page.
          </p>
          <Link
            href="/admin/bookings"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
          >
            Go to Bookings
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/30 bg-white/50 shadow-lg backdrop-blur-xl">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/20 bg-amber-500/10">
                <th className="px-6 py-4 text-left text-sm font-semibold text-stone-700">Invoice</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-stone-700">Client</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-stone-700">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-stone-700">Status</th>
                <th className="px-6 py-4 w-10" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-white/20 last:border-0 transition hover:bg-white/30"
                >
                  <td className="px-6 py-4">
                    <span className="font-mono font-medium text-teal-700">{inv.invoiceNumber}</span>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {new Date(inv.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-stone-900">{inv.clientName}</p>
                    <p className="text-sm text-stone-600">{inv.clientEmail}</p>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-stone-900">
                    {inv.totalAmount.toLocaleString()} {inv.currency}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(inv.status)}`}
                    >
                      {statusLabel(inv.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/invoices/${inv.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-teal-600 transition hover:bg-teal-50"
                    >
                      View
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
