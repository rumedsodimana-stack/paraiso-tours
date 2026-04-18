import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";
import { getInvoices } from "@/lib/db";
import type { InvoiceStatus } from "@/lib/types";

function statusLabel(s: InvoiceStatus): string {
  switch (s) {
    case "pending_payment": return "Pending";
    case "paid": return "Paid";
    case "overdue": return "Overdue";
    case "cancelled": return "Cancelled";
    default: return s;
  }
}

function statusBadgeClass(s: InvoiceStatus): string {
  switch (s) {
    case "pending_payment": return "bg-[#f3e8ce] text-[#7a5a17]";
    case "paid":            return "bg-[#dce8dc] text-[#375a3f]";
    case "overdue":         return "bg-[#eed9cf] text-[#7c3a24]";
    case "cancelled":       return "bg-[#e2e3dd] text-[#545a54]";
    default:                return "bg-[#e2e3dd] text-[#545a54]";
  }
}

export default async function InvoicesPage() {
  const invoices = await getInvoices();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#11272b]">Invoices</h1>
          <p className="mt-1 text-sm text-[#5e7279]">View and manage client invoices</p>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="paraiso-card flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center">
          <FileText className="h-10 w-10 text-[#8a9ba1]" />
          <p className="mt-3 font-medium text-[#5e7279]">No invoices yet</p>
          <p className="mt-1 text-sm text-[#8a9ba1]">Create an invoice from a booking detail page.</p>
          <Link
            href="/admin/bookings"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-4 py-2.5 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
          >
            Go to Bookings
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="paraiso-card rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e0e4dd] bg-[#f4ecdd]">
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Invoice</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Client</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Amount</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Status</th>
                <th className="px-6 py-3.5 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e4dd]">
              {invoices.map((inv) => (
                <tr key={inv.id} className="transition hover:bg-[#faf6ef]">
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm font-semibold text-[#12343b]">{inv.invoiceNumber}</span>
                    <p className="mt-0.5 text-xs text-[#8a9ba1]">
                      {new Date(inv.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-[#11272b]">{inv.clientName}</p>
                    <p className="text-sm text-[#5e7279]">{inv.clientEmail}</p>
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-[#11272b]">
                    {inv.totalAmount.toLocaleString()} {inv.currency}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(inv.status)}`}>
                      {statusLabel(inv.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/invoices/${inv.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-3 py-1.5 text-xs font-medium text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
                    >
                      View
                      <ArrowRight className="h-3.5 w-3.5" />
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
