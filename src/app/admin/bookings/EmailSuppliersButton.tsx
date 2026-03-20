"use client";

import { Mail, AlertCircle } from "lucide-react";
import type { Lead, TourPackage } from "@/lib/types";
import type { SupplierEmailResult } from "@/lib/booking-breakdown";

export function EmailSuppliersButton({
  lead,
  pkg,
  result,
  companyName,
  companyTagline,
  companyEmail,
}: {
  lead: Lead;
  pkg: TourPackage;
  result: SupplierEmailResult | null;
  companyName: string;
  companyTagline?: string;
  companyEmail?: string;
}) {
  if (!result) return null;

  const { emails, missing } = result;
  const hasEmails = emails.length > 0;

  function buildMailto() {
    const ref = lead.reference ?? "—";
    const guestNames = lead.accompaniedGuestName?.trim()
      ? `${lead.name} and ${lead.accompaniedGuestName.trim()}`
      : lead.name;
    const startDate = lead.travelDate ?? "TBD";
    const days = pkg.duration?.match(/(\d+)/)?.[1] ? parseInt(pkg.duration.match(/(\d+)/)![1], 10) : 7;
    const endDate = startDate !== "TBD"
      ? new Date(new Date(startDate).getTime() + (days - 1) * 86400000).toISOString().slice(0, 10)
      : "TBD";
    const checkInFmt = startDate !== "TBD" ? new Date(startDate + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "TBD";
    const checkOutFmt = endDate !== "TBD" ? new Date(endDate + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "TBD";

    const subject = encodeURIComponent(
      `Reservation Request – ${ref} – ${lead.name}`
    );
    const bodyLines = [
      `Dear Sir/Madam,`,
      ``,
      `We would like to request a reservation for our guest. Please find the details below:`,
      ``,
      `GUEST & BOOKING`,
      `Guest name(s): ${guestNames}`,
      `Number of guests: ${lead.pax ?? 1}`,
      `Booking reference: ${ref}`,
      `Package: ${pkg.name}`,
      ``,
      `DATES`,
      `Check-in: ${checkInFmt}`,
      `Check-out: ${checkOutFmt}`,
      ``,
      `BILLING`,
      `Bill to: ${companyName}`,
      ``,
      `Please confirm availability and send us your best rate. We look forward to your reply.`,
      ``,
      `Kind regards,`,
      ``,
      companyName,
      ...(companyTagline ? [companyTagline] : []),
      ...(companyEmail ? [companyEmail] : []),
    ];
    const body = encodeURIComponent(bodyLines.join("\n"));
    const to = emails.join(",");
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }

  return (
    <div className="space-y-2">
      {hasEmails ? (
        <a
          href={buildMailto()}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          <Mail className="h-4 w-4" />
          Email {emails.length} supplier{emails.length !== 1 ? "s" : ""}
        </a>
      ) : (
        <div className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4" />
          No supplier emails found
        </div>
      )}
      {missing.length > 0 && (
        <p className="text-xs text-stone-500">
          {missing.length} supplier(s) without email:{" "}
          {missing.map((m) => `${m.supplierName} (${m.supplierType})`).join(", ")}.{" "}
          Add emails in Hotels & Suppliers.
        </p>
      )}
    </div>
  );
}
