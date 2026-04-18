import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CreditCard, FileText } from "lucide-react";
import { InvoiceDocument } from "@/app/admin/invoices/InvoiceDocument";
import { getAppSettings, getDisplayCompanyName } from "@/lib/app-config";
import { getTourForClient } from "@/lib/db";
import { BookingShareActions } from "../BookingShareActions";

function getBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) return configuredUrl;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function toLabel(value: string) {
  return value.replace(/_/g, " ").replace(/-/g, " ");
}

export default async function ClientInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { ref } = await params;
  const { email } = await searchParams;
  const settings = await getAppSettings();
  const result = await getTourForClient(ref, email ?? undefined);

  if (!result || !("tour" in result) || !result.invoice) {
    redirect(`/booking/${encodeURIComponent(ref)}${email ? `?email=${encodeURIComponent(email)}` : ""}`);
  }

  const { tour, invoice, payment } = result;
  const brandName = getDisplayCompanyName(settings);
  const invoiceLink = `${getBaseUrl()}/booking/${encodeURIComponent(ref)}/invoice${
    email ? `?email=${encodeURIComponent(email)}` : ""
  }`;
  const shareSubject = encodeURIComponent(`Invoice ${invoice.invoiceNumber} from ${brandName}`);
  const shareBody = encodeURIComponent(
    `Here is the invoice for booking ${ref}.\n\nInvoice: ${invoice.invoiceNumber}\nLink: ${invoiceLink}`
  );

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/booking/${encodeURIComponent(ref)}${email ? `?email=${encodeURIComponent(email)}` : ""}`}
          className="inline-flex items-center gap-2 rounded-full border border-[#ddc8b0] bg-white/70 px-4 py-2 text-sm font-medium text-stone-700 backdrop-blur-sm transition hover:text-[#12343b]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to itinerary
        </Link>
        <BookingShareActions
          emailHref={`mailto:?subject=${shareSubject}&body=${shareBody}`}
          whatsappHref={`https://wa.me/?text=${shareBody}`}
        />
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] print:hidden">
        <div className="rounded-[1.8rem] border border-[#ddc8b0] bg-white/72 p-6 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
            Invoice view
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
            {invoice.invoiceNumber}
          </h1>
          <p className="mt-3 text-sm leading-7 text-stone-600">
            This is the printable invoice for your confirmed Sri Lanka journey.
            Use print to save it as PDF, or share this page link.
          </p>
        </div>

        <div className="rounded-[1.8rem] border border-[#ddc8b0] bg-white/72 p-6 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#12343b]" />
            <h2 className="text-lg font-semibold text-stone-900">Booking summary</h2>
          </div>
          <div className="mt-4 space-y-2 text-sm text-stone-600">
            <p>
              Booking reference: <span className="font-medium text-stone-900">{ref}</span>
            </p>
            <p>
              Tour: <span className="font-medium text-stone-900">{tour.packageName}</span>
            </p>
            <p>
              Invoice status:{" "}
              <span className="font-medium capitalize text-stone-900">
                {toLabel(invoice.status)}
              </span>
            </p>
            {payment ? (
              <p className="flex items-center gap-2 pt-1">
                <CreditCard className="h-4 w-4 text-[#12343b]" />
                Payment:{" "}
                <span className="font-medium capitalize text-stone-900">
                  {toLabel(payment.status)}
                </span>
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="rounded-[2rem] border border-[#ddc8b0] bg-white/82 p-6 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm print:border-0 print:bg-white print:p-0 print:shadow-none">
        <InvoiceDocument
          invoice={invoice}
          letterhead={{
            companyName: brandName,
            tagline: settings.company.tagline,
            address: settings.company.address,
            phone: settings.company.phone,
            email: settings.company.email,
            logoUrl: settings.company.logoUrl,
          }}
        />
      </div>
    </div>
  );
}
