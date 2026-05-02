"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import {
  resendEmailAction,
  type ResendEmailInput,
} from "@/app/actions/communications";

interface ResendProps {
  message: {
    template: ResendEmailInput["template"];
    invoiceId?: string;
    tourId?: string;
    leadId?: string;
    paymentId?: string;
    recipient?: string;
    supplierName?: string;
  };
}

// Templates that the central `resendEmailAction` can re-fire from
// reconstructible state (audit metadata + current DB). Anything else
// renders no button — the admin should re-trigger from the relevant
// detail page (booking change notice, supplier change notice, etc.)
// where the original input fields exist.
const RESENDABLE_TEMPLATES = new Set<ResendEmailInput["template"]>([
  "invoice",
  "itinerary",
  "tour_confirmation_with_invoice",
  "payment_receipt",
  "supplier_reservation",
  "pre_trip_reminder",
  "post_trip_followup",
  "supplier_remittance",
]);

function humanizeTemplate(t: string): string {
  return t.replace(/_/g, " ");
}

export function ResendEmailButton({ message }: ResendProps) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();

  if (!RESENDABLE_TEMPLATES.has(message.template)) return null;

  const handle = () => {
    if (
      !confirm(
        `Resend this ${humanizeTemplate(message.template)} email${
          message.recipient ? ` to ${message.recipient}` : ""
        }?`
      )
    )
      return;
    setToast(null);
    startTransition(async () => {
      try {
        const result = await resendEmailAction({
          template: message.template,
          invoiceId: message.invoiceId,
          tourId: message.tourId,
          leadId: message.leadId,
          paymentId: message.paymentId,
          // Supplier-targeted templates need the recipient as the lookup
          // key (we match by email first, name second). Guest templates
          // ignore this field.
          supplierEmail:
            message.template === "supplier_reservation" ||
            message.template === "supplier_remittance"
              ? message.recipient
              : undefined,
          supplierName: message.supplierName,
        });
        setToast(result?.success ? "Sent" : (result?.error ?? "Failed"));
        if (result?.success) router.refresh();
      } catch (err) {
        // Network drop or server-action throw — surface to toast so
        // admin sees the cause instead of a silent button reset.
        setToast(
          err instanceof Error ? err.message : "Network error. Try again."
        );
      }
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
