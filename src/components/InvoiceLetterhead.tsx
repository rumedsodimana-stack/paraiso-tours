"use client";

interface InvoiceLetterheadProps {
  companyName?: string;
  tagline?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export function InvoiceLetterhead({
  companyName = "Paraíso Ceylon Tours",
  tagline = "Crafted journeys across Sri Lanka",
  address = "Colombo, Sri Lanka",
  phone = "+94 11 234 5678",
  email = "hello@paraisoceylontours.com",
}: InvoiceLetterheadProps) {
  return (
    <div className="border-b border-stone-200 pb-6 mb-6 print:border-stone-300">
      <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
        {companyName}
      </h1>
      <p className="mt-1 text-sm text-teal-600 font-medium">{tagline}</p>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-stone-500">
        {address && <span>{address}</span>}
        {phone && <span>{phone}</span>}
        {email && <span>{email}</span>}
      </div>
    </div>
  );
}
