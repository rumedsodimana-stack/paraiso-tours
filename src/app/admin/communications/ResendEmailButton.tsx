"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { resendEmailAction, type ResendEmailInput } from "@/app/actions/communications";

interface ResendProps {
  message: {
    template: ResendEmailInput["template"];
    invoiceId?: string;
    tourId?: string;
    leadId?: string;
    recipient?: string;
    supplierName?: string;
  };
}

export function ResendEmailButton({ message }: ResendProps) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();

  // Templates we can re-send reliably:
  const supported =
    message.template === "invoice" ||
    message.template === "itinerary" ||
    message.template === "tour_confirmation_with_invoice" ||
    message.template === "payment_receipt" ||
    message.template === "supplier_reservation";

  if (!supported) return null;

  const handle = () => {
    if (!confirm(`Resend this ${message.template.replace(/_/g, " ")} email${message.recipient ? ` to ${message.recipient}` : ""}?`)) return;
    setToast(null);
    startTransition(async () => {
      const result = await resendEmailAction({
        template: message.template,
        invoiceId: message.invoiceId,
        tourId: message.tourId,
        leadId: message.leadId,
        supplierEmail: message.template === "supplier_reservation" ? message.recipient : undefined,
        supplierName: message.supplierName,
      });
      setToast(result?.success ? "Sent" : result?.error ?? "Failed");
      if (result?.success) router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handle}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg bg-[#c9922f] px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#a87a22] disabled:opacity-50"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {pending ? "Sending…" : "Resend"}
      </button>
      {toast && <span className="text-xs text-[#5e7279]">{toast}</span>}
    </div>
  );
}
