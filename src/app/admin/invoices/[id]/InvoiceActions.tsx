"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Printer, FileText } from "lucide-react";
import type { Invoice } from "@/lib/types";
import { updateInvoiceStatus } from "@/app/actions/invoices";

const STATUS_OPTIONS = [
  { value: "pending_payment", label: "Pending Payment" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
] as const;

interface InvoiceActionsProps {
  invoice: Invoice;
}

export function InvoiceActions({ invoice }: InvoiceActionsProps) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handlePrint = () => {
    window.print();
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const status = e.target.value as Invoice["status"];
    startTransition(async () => {
      const result = await updateInvoiceStatus(invoice.id, status);
      if (result?.success) router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-3 print:hidden">
      <select
        value={invoice.status}
        onChange={handleStatusChange}
        disabled={pending}
        className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <Link
        href={`/admin/bookings/${invoice.leadId}`}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
      >
        <FileText className="h-4 w-4" />
        View booking
      </Link>
      <button
        type="button"
        onClick={handlePrint}
        className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
      >
        <Printer className="h-4 w-4" />
        Print
      </button>
    </div>
  );
}
