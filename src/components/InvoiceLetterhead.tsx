"use client";

import Image from "next/image";

interface InvoiceLetterheadProps {
  companyName?: string;
  tagline?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
}

export function InvoiceLetterhead({
  companyName = "Travel Agency",
  tagline = "",
  address = "",
  phone = "",
  email = "",
  logoUrl,
}: InvoiceLetterheadProps) {
  return (
    <div className="border-b border-stone-200 pb-6 mb-6 print:border-stone-300">
      <div className="flex items-start gap-4">
        {logoUrl ? (
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl">
            <Image
              src={logoUrl}
              alt={companyName}
              fill
              unoptimized
              className="object-cover"
              sizes="56px"
            />
          </div>
        ) : null}
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            {companyName}
          </h1>
          <p className="mt-1 text-sm text-teal-600 font-medium">{tagline}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-stone-500">
        {address && <span>{address}</span>}
        {phone && <span>{phone}</span>}
        {email && <span>{email}</span>}
      </div>
    </div>
  );
}
