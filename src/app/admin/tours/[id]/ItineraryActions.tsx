"use client";

import { useState, useTransition } from "react";
import { Download, Send, FileDown } from "lucide-react";
import { sendItineraryToGuestAction } from "@/app/actions/tours";

export function ItineraryActions({
  tourId,
  clientEmail,
}: {
  tourId: string;
  clientEmail?: string;
}) {
  const [sending, startSendTransition] = useTransition();
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const handleSend = () => {
    const email = clientEmail?.trim();
    if (!email) {
      setToast({ type: "err", msg: "No guest email on this booking." });
      return;
    }
    if (!confirm(`Email the itinerary PDF to ${email}?`)) return;
    setToast(null);
    startSendTransition(async () => {
      const result = await sendItineraryToGuestAction(tourId);
      if (result?.success) {
        setToast({ type: "ok", msg: `Itinerary sent to ${email}` });
      } else {
        setToast({ type: "err", msg: result?.error ?? "Failed to send itinerary" });
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/api/admin/tours/${tourId}/itinerary`}
          className="inline-flex items-center gap-2 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-sm font-medium text-[#11272b] transition hover:bg-[#f4ecdd]"
        >
          <FileDown className="h-4 w-4" />
          Itinerary PDF
        </a>
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !clientEmail?.trim()}
          title={clientEmail?.trim() ? `Email itinerary to ${clientEmail}` : "No guest email"}
          className="inline-flex items-center gap-2 rounded-xl bg-[#c9922f] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#a87a22] disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {sending ? "Sending…" : "Send itinerary to guest"}
        </button>
      </div>
      {toast && (
        <p className={`text-sm ${toast.type === "ok" ? "text-emerald-700" : "text-rose-700"}`}>
          {toast.msg}
        </p>
      )}
    </div>
  );
}
