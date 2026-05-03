"use client";

/**
 * Branded letterhead used at the top of on-screen invoice + payment
 * voucher pages. Mirrors the teal header band used across the PDF
 * artifacts (lib/pdf-letterhead.ts) so window.print() looks the same
 * as the downloaded PDF.
 *
 * Layout:
 *  - Solid teal band (`#12343b`) with optional logo on the left,
 *    company name + tagline next to it, and a gold-letter kicker
 *    label ("INVOICE", "PAYMENT VOUCHER", etc.) on the right.
 *  - Light contact line below the band: address · phone · email.
 *
 * Print-friendly: the band keeps its color via `print:bg-[#12343b]`
 * and `print-color-adjust: exact` so the brand survives a
 * "Print to PDF" or hardcopy print without losing the band.
 */

import Image from "next/image";

interface InvoiceLetterheadProps {
  companyName?: string;
  tagline?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  /** Right-aligned label inside the header band. Defaults to "Invoice"
   *  for backwards compat; voucher / quotation pages can override. */
  kicker?: string;
}

export function InvoiceLetterhead({
  companyName = "Travel Agency",
  tagline = "",
  address = "",
  phone = "",
  email = "",
  logoUrl,
  kicker = "Invoice",
}: InvoiceLetterheadProps) {
  return (
    <div
      className="mb-6"
      style={{
        // Force browsers to print the band's background color rather
        // than dropping it as a paper-saving optimisation. Also covers
        // window.print() → "Save as PDF" in modern Chromium / Safari.
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      {/* Header band */}
      <div className="flex items-center gap-4 rounded-t-2xl bg-[#12343b] px-6 py-5 print:rounded-none">
        {logoUrl ? (
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/5">
            <Image
              src={logoUrl}
              alt={companyName}
              fill
              className="object-contain"
              sizes="48px"
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold tracking-tight text-[#fffbf4]">
            {companyName}
          </h1>
          {tagline && (
            <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#c9922f]">
              {tagline}
            </p>
          )}
        </div>
        <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.22em] text-[#c9922f]">
          {kicker}
        </p>
      </div>

      {/* Contact line */}
      {(address || phone || email) && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-x border-b border-[#e0e4dd] bg-[#fffbf4] px-6 py-2.5 text-xs text-[#5e7279] print:rounded-none">
          {address && <span>{address}</span>}
          {phone && <span>{phone}</span>}
          {email && <span>{email}</span>}
        </div>
      )}
    </div>
  );
}
