"use client";

import { InvoiceLetterhead } from "@/components/InvoiceLetterhead";

interface PaymentVoucherDocumentProps {
  payment: {
    id: string;
    description: string;
    amount: number;
    currency: string;
    date: string;
    supplierName?: string;
    status: string;
  };
  letterhead?: {
    companyName?: string;
    tagline?: string;
    address?: string;
    phone?: string;
    email?: string;
    logoUrl?: string;
  };
}

export function PaymentVoucherDocument({ payment, letterhead }: PaymentVoucherDocumentProps) {
  return (
    <div className="max-w-[210mm] mx-auto bg-white text-stone-900 print:max-w-none print:shadow-none">
      <InvoiceLetterhead {...letterhead} />
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-stone-900">PAYMENT VOUCHER</h2>
        <p className="mt-1 text-sm text-stone-600">Ref: {payment.id}</p>
        <p className="text-sm text-stone-500">
          Date: {new Date(payment.date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 mb-8">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Paid to</h3>
          <p className="font-medium text-stone-900">
            {payment.supplierName ?? payment.description}
          </p>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Amount</h3>
          <p className="text-xl font-bold text-rose-600">
            {payment.amount.toLocaleString()} {payment.currency}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Description</h3>
        <p className="text-stone-700">{payment.description}</p>
      </div>

      <div className="pt-6 border-t border-stone-200 text-xs text-stone-500">
        <p>Status: {payment.status}</p>
        <p className="mt-1">This is a payment voucher for record-keeping. Payment has been made.</p>
      </div>
    </div>
  );
}
