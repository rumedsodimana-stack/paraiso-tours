"use client";

import { Mail, AlertCircle } from "lucide-react";
import type { Lead, TourPackage, HotelSupplier } from "@/lib/types";
import type { SupplierEmailResult } from "@/lib/booking-breakdown";

export function EmailSuppliersButton({
  lead,
  pkg,
  suppliers,
  result,
}: {
  lead: Lead;
  pkg: TourPackage;
  suppliers: HotelSupplier[];
  result: SupplierEmailResult | null;
}) {
  if (!result) return null;

  const { emails, missing } = result;
  const hasEmails = emails.length > 0;

  function buildMailto() {
    const subject = encodeURIComponent(
      `Reservation Request - ${lead.reference ?? lead.name} - ${pkg.name}`
    );
    const nights = pkg.duration?.match(/(\d+)/)?.[1] ?? "—";
    const bodyLines = [
      `Dear Supplier,`,
      ``,
      `We would like to request a reservation for the following booking:`,
      ``,
      `Booking Reference: ${lead.reference ?? "—"}`,
      `Client: ${lead.name}`,
      `Package: ${pkg.name}`,
      `Travel Dates: ${lead.travelDate ?? "TBD"}`,
      `Pax: ${lead.pax ?? 1}`,
      `Duration: ${pkg.duration}`,
      `Nights: ${nights}`,
      ``,
      `Please confirm availability and send us your best rate.`,
      ``,
      `Thank you,`,
      `Paraíso Ceylon`,
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
