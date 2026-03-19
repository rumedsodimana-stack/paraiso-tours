"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import { createInvoiceFromLead } from "@/app/actions/invoices";

interface CreateInvoiceForPaymentButtonProps {
  leadId: string;
}

export function CreateInvoiceForPaymentButton({ leadId }: CreateInvoiceForPaymentButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleCreate = () => {
    setError(null);
    startTransition(async () => {
      const result = await createInvoiceFromLead(leadId);
      if (result?.invoiceId) {
        router.refresh();
      } else if (result?.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleCreate}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl border border-teal-600 bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-700 transition hover:bg-teal-100 disabled:opacity-50"
      >
        <FileText className="h-4 w-4" />
        {pending ? "Creating…" : "Create Invoice"}
      </button>
      {error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}
      <Link
        href={`/admin/bookings/${leadId}`}
        className="text-sm text-teal-600 hover:text-teal-700 hover:underline"
      >
        Go to booking
      </Link>
    </div>
  );
}
