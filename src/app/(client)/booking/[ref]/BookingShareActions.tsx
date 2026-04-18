"use client";

import { Printer } from "lucide-react";

export function BookingShareActions({
  emailHref,
  whatsappHref,
}: {
  emailHref: string;
  whatsappHref: string;
}) {
  return (
    <div className="flex flex-wrap gap-3 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-full border border-[#ddc8b0] bg-white/80 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-[#12343b] hover:text-[#12343b]"
      >
        <Printer className="h-4 w-4" />
        Print / Save PDF
      </button>
      <a
        href={emailHref}
        className="inline-flex items-center gap-2 rounded-full border border-[#ddc8b0] bg-white/80 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-[#12343b] hover:text-[#12343b]"
      >
        Share by email
      </a>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-full bg-[#12343b] px-4 py-2.5 text-sm font-medium text-[#f6ead6] transition hover:bg-[#0f2b31]"
      >
        Share on WhatsApp
      </a>
    </div>
  );
}
