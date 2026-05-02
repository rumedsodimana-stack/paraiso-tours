"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { createInvoiceFromPayment } from "@/app/actions/invoices";

interface CreateInvoiceFromPaymentButtonProps {
  paymentId: string;
}

/**
 * Create an invoice directly from a payment (when payment is not linked to a booking).
 * Use this for incoming payments that have no leadId.
 */
export function CreateInvoiceFromPaymentButton({ paymentId }: CreateInvoiceFromPaymentButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleCreate = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createInvoiceFromPayment(paymentId);
        if (result?.invoiceId) {
          router.refresh();
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
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleCreate}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-sm font-medium text-[#12343b] transition hover:bg-[#f4ecdd] disabled:opacity-50"
      >
        <FileText className="h-4 w-4" />
        {pending ? "Creating…" : "Create Invoice"}
      </button>
      {error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}
    </div>
  );
}
