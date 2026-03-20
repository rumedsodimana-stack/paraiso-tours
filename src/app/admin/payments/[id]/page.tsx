import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { getPayment, getInvoice, getInvoiceByLeadId, getInvoices } from "@/lib/db";
import { getAppSettings, getDisplayCompanyName } from "@/lib/app-config";
import { getAuditLogsForEntities } from "@/lib/audit";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { InvoiceDocument } from "../../invoices/InvoiceDocument";
import { PrintButton } from "../../payables/PrintButton";
import { PaymentVoucherDocument } from "../PaymentVoucherDocument";
import { CreateInvoiceForPaymentButton } from "../CreateInvoiceForPaymentButton";
import { CreateInvoiceFromPaymentButton } from "../CreateInvoiceFromPaymentButton";
import { MarkPaymentReceivedButton } from "../MarkPaymentReceivedButton";

async function getInvoiceForPayment(payment: { invoiceId?: string; leadId?: string; type: string; clientName?: string }) {
  if (payment.invoiceId) return getInvoice(payment.invoiceId);
  if (payment.type === "incoming" && payment.leadId) return getInvoiceByLeadId(payment.leadId);
  if (payment.type === "incoming" && payment.clientName) {
    const invoices = await getInvoices();
    return invoices.find((i) => i.clientName === payment.clientName) ?? null;
  }
  return null;
}

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const payment = await getPayment(id);
  if (!payment) notFound();
  const settings = await getAppSettings();
  const letterhead = {
    companyName: getDisplayCompanyName(settings),
    tagline: settings.company.tagline,
    address: settings.company.address,
    phone: settings.company.phone,
    email: settings.company.email,
    logoUrl: settings.company.logoUrl,
  };

  const invoice = await getInvoiceForPayment(payment);
  const auditLogs = await getAuditLogsForEntities(
    [
      { entityType: "payment", entityId: payment.id },
      ...(invoice ? [{ entityType: "invoice" as const, entityId: invoice.id }] : []),
    ],
    10
  );

  return (
    <div className="space-y-6">
      <Link
        href="/admin/payments"
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900 print:hidden"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Payments
      </Link>

      <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-50">
            Transaction
          </h1>
          {payment.type === "incoming" && payment.status === "pending" && (
            <MarkPaymentReceivedButton paymentId={payment.id} />
          )}
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-stone-500">Type</dt>
            <dd className="mt-0.5 font-medium capitalize">{payment.type}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-stone-500">Amount</dt>
            <dd
              className={`mt-0.5 font-semibold ${
                payment.type === "incoming"
                  ? "text-emerald-600"
                  : "text-rose-600"
              }`}
            >
              {payment.type === "incoming" ? "+" : "-"}
              {payment.amount.toLocaleString()} {payment.currency}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-stone-500">Description</dt>
            <dd className="mt-0.5">{payment.description}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-stone-500">Date</dt>
            <dd className="mt-0.5">{payment.date}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-stone-500">Status</dt>
            <dd className="mt-0.5">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  payment.status === "completed"
                    ? "bg-emerald-100 text-emerald-800"
                    : payment.status === "pending"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-stone-100 text-stone-600"
                }`}
              >
                {payment.type === "incoming"
                  ? payment.status === "completed"
                    ? "Incoming · Payment received"
                    : "Incoming · Awaiting payment"
                  : payment.status === "completed"
                    ? "Outgoing · Paid"
                    : "Outgoing · To pay"}
              </span>
            </dd>
          </div>
          {payment.clientName && (
            <div>
              <dt className="text-sm font-medium text-stone-500">Client</dt>
              <dd className="mt-0.5">{payment.clientName}</dd>
            </div>
          )}
          {payment.reference && (
            <div>
              <dt className="text-sm font-medium text-stone-500">Reference</dt>
              <dd className="mt-0.5 font-mono text-sm">{payment.reference}</dd>
            </div>
          )}
        </dl>
      </div>

      {invoice ? (
        <div className="rounded-2xl border border-white/30 bg-white/80 p-8 shadow-lg backdrop-blur-xl print:border-0 print:shadow-none print:bg-white">
          <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-teal-600" />
              <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">
                Invoice
              </h2>
            </div>
            <PrintButton />
          </div>
          <InvoiceDocument invoice={invoice} letterhead={letterhead} />
        </div>
      ) : payment.type === "outgoing" ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/50 p-6 text-center text-stone-600">
          <FileText className="mx-auto h-10 w-10 text-stone-400" />
          <p className="mt-2 font-medium">No invoice linked</p>
          <p className="mt-1 text-sm">Create an invoice (payment voucher) directly from this payment.</p>
          <div className="mt-4 flex justify-center">
            <CreateInvoiceFromPaymentButton paymentId={payment.id} />
          </div>
        </div>
      ) : payment.type === "incoming" ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/50 p-6 text-center text-stone-600">
          <FileText className="mx-auto h-10 w-10 text-stone-400" />
          <p className="mt-2 font-medium">No invoice linked</p>
          {payment.leadId ? (
            <>
              <p className="mt-1 text-sm">Generate an invoice from the related booking, or create one here from this payment.</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
                <CreateInvoiceForPaymentButton leadId={payment.leadId} />
                <CreateInvoiceFromPaymentButton paymentId={payment.id} />
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm">Create an invoice directly from this payment.</p>
              <CreateInvoiceFromPaymentButton paymentId={payment.id} />
            </>
          )}
        </div>
      ) : null}

      <AuditTimeline title="Payment Activity" logs={auditLogs} />
    </div>
  );
}
