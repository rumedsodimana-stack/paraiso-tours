import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getInvoice } from "@/lib/db";
import { InvoiceDocument } from "../InvoiceDocument";
import { InvoiceActions } from "./InvoiceActions";

export default async function InvoiceViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoice(id);

  if (!invoice) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href={`/admin/bookings/${invoice.leadId}`}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to booking
        </Link>
        <InvoiceActions invoice={invoice} />
      </div>

      <div className="rounded-2xl border border-white/30 bg-white/80 p-8 shadow-lg backdrop-blur-xl print:border-0 print:shadow-none print:bg-white">
        <InvoiceDocument invoice={invoice} />
      </div>
    </div>
  );
}
