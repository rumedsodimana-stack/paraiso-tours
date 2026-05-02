"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, FileText, Mail, MessageCircle, Printer, Send } from "lucide-react";
import type { Invoice } from "@/lib/types";
import { sendInvoiceToGuestAction, updateInvoiceStatus } from "@/app/actions/invoices";

const STATUS_OPTIONS = [
  { value: "pending_payment", label: "Pending Payment" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
] as const;

interface InvoiceActionsProps {
  invoice: Invoice;
  emailHref?: string;
  whatsappHref?: string;
}

export function InvoiceActions({
  invoice,
  emailHref,
  whatsappHref,
}: InvoiceActionsProps) {
  const [pending, startTransition] = useTransition();
  const [sending, startSendTransition] = useTransition();
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const router = useRouter();

  const handlePrint = () => {
    window.print();
  };

  // Status change wraps in try/catch and surfaces errors to the toast
  // line. Without this, a failed update (e.g. RLS denial, schema cache
  // miss) would just silently leave the dropdown showing the new value
  // while the DB still held the old one — admin would think the change
  // landed, and notice the inconsistency only on next reload.
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const status = e.target.value as Invoice["status"];
    setToast(null);
    startTransition(async () => {
      try {
        const result = await updateInvoiceStatus(invoice.id, status);
        if (result?.success) {
          router.refresh();
        } else if (result?.error) {
          setToast({ type: "err", msg: result.error });
        } else {
          setToast({ type: "err", msg: "Status not updated. Please try again." });
        }
      } catch (err) {
        setToast({
          type: "err",
          msg:
            err instanceof Error
              ? err.message
              : "Couldn't reach the server. Please check your connection and try again.",
        });
      }
    });
  };

  // Send-to-guest also wraps in try/catch — without it, a network
  // failure or server-action throw leaves the button stuck on
  // "Sending…" indefinitely. The toast lets admin see exactly what
  // went wrong (e.g. "Email not configured (RESEND_API_KEY missing)").
  const handleSendToGuest = () => {
    if (!invoice.clientEmail?.trim()) {
      setToast({ type: "err", msg: "No client email on this invoice." });
      return;
    }
    if (!confirm(`Send invoice ${invoice.invoiceNumber} to ${invoice.clientEmail}?`)) return;
    setToast(null);
    startSendTransition(async () => {
      try {
        const result = await sendInvoiceToGuestAction(invoice.id);
        if (result?.success) {
          setToast({ type: "ok", msg: `Invoice sent to ${invoice.clientEmail}` });
          router.refresh();
        } else {
          setToast({ type: "err", msg: result?.error ?? "Failed to send invoice" });
        }
      } catch (err) {
        setToast({
          type: "err",
          msg:
            err instanceof Error
              ? err.message
              : "Couldn't reach the server. Please check your connection and try again.",
        });
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={invoice.status}
          onChange={handleStatusChange}
          disabled={pending}
          className="rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm font-medium text-[#11272b] shadow-sm focus:border-[#c9922f] focus:outline-none focus:ring-1 focus:ring-[#c9922f]/20 disabled:opacity-50"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Link
          href={`/admin/bookings/${invoice.leadId}`}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
        >
          <FileText className="h-4 w-4" />
          View booking
        </Link>
        <button
          type="button"
          onClick={handleSendToGuest}
          disabled={sending || !invoice.clientEmail?.trim()}
          title={invoice.clientEmail?.trim() ? `Email invoice to ${invoice.clientEmail}` : "No client email"}
          className="inline-flex items-center gap-2 rounded-xl bg-[#c9922f] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#a87a22] disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {sending ? "Sending…" : "Send to guest"}
        </button>
        {emailHref ? (
          <a
            href={emailHref}
            className="inline-flex items-center gap-2 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-sm font-medium text-[#11272b] transition hover:bg-[#f4ecdd]"
          >
            <Mail className="h-4 w-4" />
            Share by email
          </a>
        ) : null}
        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-sm font-medium text-[#11272b] transition hover:bg-[#f4ecdd]"
          >
            <MessageCircle className="h-4 w-4" />
            Share on WhatsApp
          </a>
        ) : null}
        <a
          href={`/api/admin/invoices/${invoice.id}/pdf`}
          className="inline-flex items-center gap-2 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-sm font-medium text-[#11272b] transition hover:bg-[#f4ecdd]"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </a>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-4 py-2.5 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
        >
          <Printer className="h-4 w-4" />
          Print / Save PDF
        </button>
      </div>
      {toast && (
        <p
          className={`text-sm ${
            toast.type === "ok" ? "text-emerald-700" : "text-rose-700"
          }`}
        >
          {toast.msg}
        </p>
      )}
    </div>
  );
}
