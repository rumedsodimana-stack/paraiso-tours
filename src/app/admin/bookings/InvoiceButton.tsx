"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Receipt } from "lucide-react";
import { createInvoiceFromLead } from "@/app/actions/invoices";
import type { Invoice } from "@/lib/types";

interface InvoiceButtonProps {
  leadId: string;
  invoice: Invoice | null;
  canCreate: boolean;
}

export function InvoiceButton({ leadId, invoice, canCreate }: InvoiceButtonProps) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (invoice) {
    return (
      <Link
        href={`/admin/invoices/${invoice.id}`}
        className="inline-flex items-center gap-2 rounded-xl border border-teal-600 bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-700 transition hover:bg-teal-100"
      >
        <Receipt className="h-4 w-4" />
        View Invoice
      </Link>
    );
  }

  if (!canCreate) return null;

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createInvoiceFromLead(leadId);
      if (result?.invoiceId) {
        router.push(`/admin/invoices/${result.invoiceId}`);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleCreate}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-xl border border-teal-600 bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-700 transition hover:bg-teal-100 disabled:opacity-50"
    >
      <Receipt className="h-4 w-4" />
      {pending ? "Creating…" : "Create Invoice"}
    </button>
  );
}
