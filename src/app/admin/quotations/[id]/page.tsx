import { notFound } from "next/navigation";
import { getQuotation } from "@/lib/db";
import Link from "next/link";
import {
  ChevronLeft,
  Download,
  Pencil,
  Building2,
  Mail,
  Phone,
  Calendar,
  Users,
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { QuotationStatusActions } from "./QuotationStatusActions";
import { DeleteQuotationButton } from "./DeleteQuotationButton";
import { SaveSuccessBanner } from "../../SaveSuccessBanner";

export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-[#f4ecdd] text-[#5e7279]" },
  sent: { label: "Sent to Client", color: "bg-sky-100 text-sky-800" },
  accepted: { label: "Accepted", color: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700" },
};

export default async function QuotationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ saved?: string }> | { saved?: string };
}) {
  const { id } = await Promise.resolve(params);
  const quotation = await getQuotation(id);
  if (!quotation) notFound();

  const rawSearch = searchParams ? await Promise.resolve(searchParams) : {};
  const saved = (rawSearch as { saved?: string })?.saved === "1";

  const cfg = STATUS_CONFIG[quotation.status] ?? STATUS_CONFIG.draft;
  const canEdit = quotation.status !== "accepted";

  return (
    <div className="space-y-6">
      {saved && <SaveSuccessBanner message="Quotation saved successfully" />}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/quotations"
            className="inline-flex items-center gap-1 text-sm text-[#5e7279] hover:text-[#11272b]"
          >
            <ChevronLeft className="h-4 w-4" />
            Quotations
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/admin/quotations/${id}/pdf`}
            className="inline-flex items-center gap-2 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2 text-sm font-medium text-[#11272b] hover:bg-[#f4ecdd]"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </a>
          {canEdit && (
            <Link
              href={`/admin/quotations/${id}/edit`}
              className="inline-flex items-center gap-2 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2 text-sm font-medium text-[#11272b] hover:bg-[#f4ecdd]"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          )}
          {quotation.status !== "accepted" && (
            <DeleteQuotationButton id={id} />
          )}
        </div>
      </div>

      {/* Title card */}
      <div className="paraiso-card rounded-2xl px-6 py-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-[#11272b]">
                {quotation.title || quotation.contactName}
              </h1>
              <span className="font-mono text-sm text-[#8a9ba1]">{quotation.reference}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
                {cfg.label}
              </span>
            </div>

            {/* Client info */}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#5e7279]">
              {quotation.companyName && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-[#8a9ba1]" />
                  {quotation.companyName}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-[#8a9ba1]" />
                <a href={`mailto:${quotation.contactEmail}`} className="hover:underline">
                  {quotation.contactEmail}
                </a>
              </span>
              {quotation.contactPhone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-[#8a9ba1]" />
                  {quotation.contactPhone}
                </span>
              )}
            </div>

            {/* Trip meta */}
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#5e7279]">
              {quotation.travelDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {quotation.travelDate}
                </span>
              )}
              {quotation.duration && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {quotation.duration}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {quotation.pax} pax
              </span>
              {quotation.destination && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {quotation.destination}
                </span>
              )}
              {quotation.validUntil && (
                <span className="flex items-center gap-1.5 text-amber-600">
                  <Clock className="h-4 w-4" />
                  Valid until {quotation.validUntil}
                </span>
              )}
            </div>
          </div>

          {/* Total */}
          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold text-[#11272b]">
              {quotation.totalAmount.toLocaleString()}{" "}
              <span className="text-base font-medium text-[#5e7279]">{quotation.currency}</span>
            </p>
            {quotation.discountAmount ? (
              <p className="text-xs text-[#8a9ba1]">
                Incl. {quotation.discountAmount.toLocaleString()} discount
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Status actions */}
      <div className="paraiso-card rounded-2xl px-6 py-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#5e7279]">
          Actions
        </h2>
        <QuotationStatusActions
          quotationId={id}
          status={quotation.status}
          travelDate={quotation.travelDate}
          tourId={quotation.tourId}
        />
      </div>

      {/* Itinerary */}
      {quotation.itinerary.length > 0 && (
        <div className="paraiso-card rounded-2xl px-6 py-5">
          <h2 className="mb-4 font-semibold text-[#11272b]">Itinerary</h2>
          <div className="space-y-4">
            {quotation.itinerary.map((day) => (
              <div key={day.day} className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef4f4] text-sm font-bold text-[#12343b]">
                  {day.day}
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="font-medium text-[#11272b]">{day.title}</p>
                  {day.description && (
                    <p className="mt-0.5 text-sm text-[#5e7279] whitespace-pre-line">{day.description}</p>
                  )}
                  {day.accommodation && (
                    <p className="mt-1 text-xs text-[#8a9ba1]">🏨 {day.accommodation}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pricing breakdown */}
      <div className="paraiso-card rounded-2xl px-6 py-5">
        <h2 className="mb-4 font-semibold text-[#11272b]">Pricing</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e0e4dd] text-xs font-medium uppercase tracking-wide text-[#8a9ba1]">
              <th className="pb-2 text-left">Description</th>
              <th className="pb-2 text-right">Qty</th>
              <th className="pb-2 text-right">Unit Price</th>
              <th className="pb-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {quotation.lineItems.map((li) => (
              <tr key={li.id} className="border-b border-[#e0e4dd]">
                <td className="py-2.5 text-[#11272b]">{li.label}</td>
                <td className="py-2.5 text-right text-[#5e7279]">{li.quantity}</td>
                <td className="py-2.5 text-right text-[#5e7279]">
                  {li.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2.5 text-right font-medium text-[#11272b]">
                  {li.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#e0e4dd]">
              <td colSpan={3} className="pt-3 text-right text-[#5e7279]">Subtotal</td>
              <td className="pt-3 text-right font-medium text-[#11272b]">
                {quotation.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {quotation.currency}
              </td>
            </tr>
            {quotation.discountAmount ? (
              <tr>
                <td colSpan={3} className="text-right text-[#5e7279]">Discount</td>
                <td className="text-right text-red-600">
                  −{quotation.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {quotation.currency}
                </td>
              </tr>
            ) : null}
            <tr className="border-t-2 border-[#e0e4dd]">
              <td colSpan={3} className="pt-2 text-right font-semibold text-[#11272b]">Total</td>
              <td className="pt-2 text-right text-lg font-bold text-[#11272b]">
                {quotation.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {quotation.currency}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Inclusions / Exclusions */}
      {((quotation.inclusions?.length ?? 0) > 0 ||
        (quotation.exclusions?.length ?? 0) > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {(quotation.inclusions?.length ?? 0) > 0 && (
            <div className="paraiso-card rounded-2xl px-5 py-4">
              <h3 className="mb-3 font-semibold text-[#11272b]">Inclusions</h3>
              <ul className="space-y-1.5">
                {quotation.inclusions!.map((inc, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#5e7279]">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {inc}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(quotation.exclusions?.length ?? 0) > 0 && (
            <div className="paraiso-card rounded-2xl px-5 py-4">
              <h3 className="mb-3 font-semibold text-[#11272b]">Exclusions</h3>
              <ul className="space-y-1.5">
                {quotation.exclusions!.map((exc, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#5e7279]">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    {exc}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Terms */}
      {quotation.termsAndConditions && (
        <div className="paraiso-card rounded-2xl px-5 py-4">
          <h3 className="mb-2 font-semibold text-[#11272b]">Terms & Conditions</h3>
          <p className="whitespace-pre-line text-sm text-[#5e7279]">{quotation.termsAndConditions}</p>
        </div>
      )}

      {/* Internal Notes */}
      {quotation.notes && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-4">
          <h3 className="mb-1 text-sm font-semibold text-amber-800">Internal Notes</h3>
          <p className="whitespace-pre-line text-sm text-amber-700">{quotation.notes}</p>
        </div>
      )}
    </div>
  );
}
