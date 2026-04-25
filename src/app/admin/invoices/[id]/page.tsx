import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getInvoice } from "@/lib/db";
import { getAppSettings, getDisplayCompanyName } from "@/lib/app-config";
import { getAuditLogsForEntities } from "@/lib/audit";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { InvoiceDocument } from "../InvoiceDocument";
import { InvoiceActions } from "./InvoiceActions";
import { EntityFocusBeacon } from "@/components/agent/EntityFocusBeacon";

function getBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) return configuredUrl;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export default async function InvoiceViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  const settings = await getAppSettings();
  const auditLogs = invoice
    ? await getAuditLogsForEntities(
        [{ entityType: "invoice", entityId: invoice.id }],
        10
      )
    : [];

  if (!invoice) {
    notFound();
  }

  const clientInvoiceUrl = invoice.reference
    ? `${getBaseUrl()}/booking/${encodeURIComponent(invoice.reference)}/invoice?email=${encodeURIComponent(invoice.clientEmail)}`
    : undefined;
  const shareSubject = clientInvoiceUrl
    ? encodeURIComponent(`Invoice ${invoice.invoiceNumber} from ${getDisplayCompanyName(settings)}`)
    : undefined;
  const shareBody = clientInvoiceUrl
    ? encodeURIComponent(
        `Here is your invoice for booking ${invoice.reference ?? invoice.leadId}.\n\nInvoice: ${invoice.invoiceNumber}\nLink: ${clientInvoiceUrl}`
      )
    : undefined;

  return (
    <div className="space-y-6">
      <EntityFocusBeacon
        view="invoice_detail"
        entity={{
          kind: "invoice",
          id: invoice.id,
          label: invoice.invoiceNumber || invoice.reference || invoice.id,
        }}
      />
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link
          href={`/admin/bookings/${invoice.leadId}`}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to booking
        </Link>
        <InvoiceActions
          invoice={invoice}
          emailHref={
            shareSubject && shareBody
              ? `mailto:${invoice.clientEmail}?subject=${shareSubject}&body=${shareBody}`
              : undefined
          }
          whatsappHref={shareBody ? `https://wa.me/?text=${shareBody}` : undefined}
        />
      </div>

      <div className="paraiso-card rounded-2xl p-8 print:border-0 print:bg-white print:p-0 print:shadow-none">
        <InvoiceDocument
          invoice={invoice}
          letterhead={{
            companyName: getDisplayCompanyName(settings),
            tagline: settings.company.tagline,
            address: settings.company.address,
            phone: settings.company.phone,
            email: settings.company.email,
            logoUrl: settings.company.logoUrl,
          }}
        />
      </div>

      <div className="print:hidden">
        <AuditTimeline title="Invoice Activity" logs={auditLogs} />
      </div>
    </div>
  );
}
