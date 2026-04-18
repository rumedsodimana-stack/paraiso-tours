import { notFound } from "next/navigation";
import { getQuotation } from "@/lib/db";
import { getAppSettings, getDisplayCompanyName } from "@/lib/app-config";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle,
  XCircle,
  Building2,
  Mail,
  Phone,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicQuotationPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const { id } = await Promise.resolve(params);
  const [quotation, settings] = await Promise.all([
    getQuotation(id),
    getAppSettings(),
  ]);

  if (!quotation) notFound();

  const brandName = getDisplayCompanyName(settings);
  const logoUrl = settings.company.logoUrl;

  const travelDateFmt = quotation.travelDate
    ? new Date(quotation.travelDate + "T12:00:00").toLocaleDateString("en-GB", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const validUntilFmt = quotation.validUntil
    ? new Date(quotation.validUntil + "T12:00:00").toLocaleDateString("en-GB", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const isExpired =
    quotation.validUntil &&
    new Date(quotation.validUntil + "T23:59:59") < new Date();

  return (
    <div className="min-h-screen bg-[#f6efe4]">
      {/* Background gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(circle at 12% 12%, rgba(210,164,87,0.18), transparent 28%), radial-gradient(circle at 82% 8%, rgba(18,52,59,0.13), transparent 25%), linear-gradient(180deg, rgba(252,246,238,0.96), rgba(246,239,228,1))",
        }}
      />

      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {/* Logo / brand header */}
        <header className="mb-8 flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={brandName} className="h-10 w-auto object-contain" />
          ) : (
            <span className="text-lg font-bold tracking-tight text-[#12343b]">{brandName}</span>
          )}
        </header>

        {/* Status / expiry banner */}
        {quotation.status === "accepted" && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-800">
            <CheckCircle className="h-4 w-4" />
            This quotation has been accepted — your tour is confirmed.
          </div>
        )}
        {quotation.status === "rejected" && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-medium text-red-700">
            <XCircle className="h-4 w-4" />
            This quotation was not taken up. Contact us for a new proposal.
          </div>
        )}
        {isExpired && quotation.status === "sent" && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-800">
            This quotation expired on {validUntilFmt}. Please contact us to request an updated quote.
          </div>
        )}

        {/* Title card */}
        <div className="mb-6 rounded-3xl border border-[#e5d7c4] bg-white/70 px-7 py-6 shadow-sm backdrop-blur-md">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#8c6a38]">
            Tour Quotation
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[#11272b]">
            {quotation.title || (quotation.destination ? `${quotation.destination} Tour` : "Custom Tour")}
          </h1>
          <p className="mt-1 font-mono text-sm text-stone-400">{quotation.reference}</p>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-stone-600">
            {quotation.companyName && (
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-stone-400" />
                {quotation.companyName}
              </span>
            )}
            {travelDateFmt && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-stone-400" />
                {travelDateFmt}
              </span>
            )}
            {quotation.duration && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-stone-400" />
                {quotation.duration}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-stone-400" />
              {quotation.pax} {quotation.pax === 1 ? "traveller" : "travellers"}
            </span>
            {quotation.destination && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-stone-400" />
                {quotation.destination}
              </span>
            )}
          </div>

          {validUntilFmt && !isExpired && quotation.status === "sent" && (
            <p className="mt-3 text-xs text-amber-700">
              Valid until {validUntilFmt}
            </p>
          )}
        </div>

        {/* Itinerary */}
        {quotation.itinerary.length > 0 && (
          <div className="mb-6 rounded-3xl border border-[#e5d7c4] bg-white/70 px-7 py-6 shadow-sm backdrop-blur-md">
            <h2 className="mb-5 text-lg font-semibold text-[#11272b]">Day-by-Day Itinerary</h2>
            <div className="space-y-5">
              {quotation.itinerary.map((day) => (
                <div key={day.day} className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#12343b]/10 text-sm font-bold text-[#12343b]">
                    {day.day}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="font-semibold text-stone-900">{day.title}</p>
                    {day.description && (
                      <p className="mt-1 text-sm leading-relaxed text-stone-500 whitespace-pre-line">
                        {day.description}
                      </p>
                    )}
                    {day.accommodation && (
                      <p className="mt-1.5 text-xs text-stone-400">
                        🏨 {day.accommodation}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pricing */}
        <div className="mb-6 rounded-3xl border border-[#e5d7c4] bg-white/70 px-7 py-6 shadow-sm backdrop-blur-md">
          <h2 className="mb-5 text-lg font-semibold text-[#11272b]">Pricing</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-xs font-medium uppercase tracking-wide text-stone-400">
                <th className="pb-2 text-left">Description</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {quotation.lineItems.map((li) => (
                <tr key={li.id} className="border-b border-stone-50">
                  <td className="py-2.5 text-stone-700">
                    {li.quantity !== 1 ? `${li.label} × ${li.quantity}` : li.label}
                  </td>
                  <td className="py-2.5 text-right text-stone-700">
                    {li.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-stone-200">
                <td className="pt-3 text-stone-500">Subtotal</td>
                <td className="pt-3 text-right text-stone-700">
                  {quotation.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {quotation.currency}
                </td>
              </tr>
              {quotation.discountAmount ? (
                <tr>
                  <td className="text-stone-500">Discount</td>
                  <td className="text-right text-red-600">
                    −{quotation.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {quotation.currency}
                  </td>
                </tr>
              ) : null}
              <tr className="border-t-2 border-[#12343b]">
                <td className="pt-3 text-base font-bold text-[#11272b]">Total</td>
                <td className="pt-3 text-right text-xl font-bold text-[#11272b]">
                  {quotation.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
                  <span className="text-sm font-medium text-stone-500">{quotation.currency}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Inclusions / Exclusions */}
        {((quotation.inclusions?.length ?? 0) > 0 || (quotation.exclusions?.length ?? 0) > 0) && (
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            {(quotation.inclusions?.length ?? 0) > 0 && (
              <div className="rounded-3xl border border-[#e5d7c4] bg-white/70 px-6 py-5 shadow-sm backdrop-blur-md">
                <h3 className="mb-3 font-semibold text-[#11272b]">What's included</h3>
                <ul className="space-y-2">
                  {quotation.inclusions!.map((inc, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      {inc}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(quotation.exclusions?.length ?? 0) > 0 && (
              <div className="rounded-3xl border border-[#e5d7c4] bg-white/70 px-6 py-5 shadow-sm backdrop-blur-md">
                <h3 className="mb-3 font-semibold text-[#11272b]">Not included</h3>
                <ul className="space-y-2">
                  {quotation.exclusions!.map((exc, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-stone-500">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-stone-300" />
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
          <div className="mb-6 rounded-3xl border border-[#e5d7c4] bg-white/70 px-6 py-5 shadow-sm backdrop-blur-md">
            <h3 className="mb-2 font-semibold text-[#11272b]">Terms & Conditions</h3>
            <p className="whitespace-pre-line text-sm text-stone-500">
              {quotation.termsAndConditions}
            </p>
          </div>
        )}

        {/* CTA */}
        {quotation.status !== "accepted" && quotation.status !== "rejected" && !isExpired && (
          <div className="mb-6 rounded-3xl border border-[#c9922f]/40 bg-[#fdf4e4] px-7 py-6 text-center shadow-sm">
            <p className="mb-4 text-base font-medium text-[#11272b]">
              Ready to confirm this tour?
            </p>
            <p className="mb-5 text-sm text-stone-500">
              Simply reply to the quotation email or contact us directly — we'll take care of the rest.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {settings.company.email && (
                <a
                  href={`mailto:${settings.company.email}?subject=Accepting quotation ${quotation.reference}&body=Hi, I'd like to accept the quotation ${quotation.reference} for ${quotation.contactName}.`}
                  className="inline-flex items-center gap-2 rounded-full bg-[#12343b] px-6 py-3 text-sm font-semibold text-[#f6ead6] shadow-sm transition hover:bg-[#1a474f]"
                >
                  <Mail className="h-4 w-4" />
                  Accept by email
                </a>
              )}
              {settings.company.phone && (
                <a
                  href={`tel:${settings.company.phone}`}
                  className="inline-flex items-center gap-2 rounded-full border border-[#12343b]/20 bg-white px-6 py-3 text-sm font-semibold text-[#12343b] transition hover:bg-stone-50"
                >
                  <Phone className="h-4 w-4" />
                  {settings.company.phone}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-stone-400">
          {brandName} · Quotation {quotation.reference}
        </p>
      </div>
    </div>
  );
}
