"use client";

import { useState, useTransition } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (invoice) {
    return (
      <Link
        href={`/admin/invoices/${invoice.id}`}
        className="inline-flex items-center gap-2 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-sm font-medium text-[#11272b] transition hover:bg-[#f4ecdd]"
      >
        <Receipt className="h-4 w-4" />
        View Invoice
      </Link>
    );
  }

  if (!canCreate) return null;

  // Wraps the action in try/catch and surfaces both `result.error` and
  // unexpected throws (network, server crash) — without this, a guest
  // sees "Creating…" → button resets → no invoice and no clue why.
  // Also keeps the button stuck on "Creating…" if the action throws,
  // so the admin has explicit feedback rather than silent failure.
  const handleCreate = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createInvoiceFromLead(leadId);
        if (result?.invoiceId) {
          router.push(`/admin/invoices/${result.invoiceId}`);
        } else if (result?.error) {
          setError(result.error);
        } else {
          setError("Invoice was not created. Please try again.");
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't reach the server. Please check your connection and try again."
        );
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleCreate}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-sm font-medium text-[#11272b] transition hover:bg-[#f4ecdd] disabled:opacity-50"
      >
        <Receipt className="h-4 w-4" />
        {pending ? "Creating…" : "Create Invoice"}
      </button>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
