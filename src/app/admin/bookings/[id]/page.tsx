import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  MapPin,
  DollarSign,
  Building2,
  Car,
  UtensilsCrossed,
  Calendar,
  Users,
} from "lucide-react";
import { getAiRuntimeStatus } from "@/lib/ai";
import { getLead, getPackage, getHotels, getInvoiceByLeadId } from "@/lib/db";
import { getAppSettings, getDisplayCompanyName } from "@/lib/app-config";
import { getAuditLogsForEntities } from "@/lib/audit";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { getBookingSupplierEmails } from "@/lib/booking-breakdown";
import { getLeadBookingFinancials } from "@/lib/booking-pricing";
import { resolveLeadPackage } from "@/lib/package-snapshot";
import { BookingSupplierBreakdown } from "../BookingSupplierBreakdown";
import { EmailSuppliersButton } from "../EmailSuppliersButton";
import { InvoiceButton } from "../InvoiceButton";
import { ApproveScheduleButton } from "./ApproveScheduleButton";
import { BookingCopilotPanel } from "./BookingCopilotPanel";

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [lead, suppliers, existingInvoice, settings, aiRuntime] = await Promise.all([
    getLead(id),
    getHotels(),
    getInvoiceByLeadId(id),
    getAppSettings(),
    getAiRuntimeStatus(),
  ]);
  const livePackage = lead?.packageId ? await getPackage(lead.packageId) : null;
  const pkg = lead ? resolveLeadPackage(lead, livePackage) : null;
  const financials = lead && pkg ? getLeadBookingFinancials(lead, pkg, suppliers) : null;
  const auditLogs = lead
    ? await getAuditLogsForEntities(
        [
          { entityType: "lead", entityId: lead.id },
          ...(existingInvoice
            ? [{ entityType: "invoice" as const, entityId: existingInvoice.id }]
            : []),
        ],
        10
      )
    : [];

  if (!lead) {
    return (
      <div className="space-y-6">
        <p className="text-stone-600">Booking not found</p>
        <Link href="/admin/bookings" className="text-teal-600 hover:text-teal-700 font-medium">
          Back to bookings
        </Link>
      </div>
    );
  }

  const getSelectedHotelForDay = (dayIndex: number): string => {
    if (!pkg) return "—";
    if (lead.selectedAccommodationByNight && lead.selectedAccommodationByNight[String(dayIndex)] !== undefined) {
      const opts = pkg.itinerary?.[dayIndex]?.accommodationOptions ?? pkg.accommodationOptions ?? [];
      const opt = opts.find((o) => o.id === lead.selectedAccommodationByNight![String(dayIndex)]);
      return opt?.label ?? "—";
    }
    if (lead.selectedAccommodationOptionId) {
      const opt = pkg.accommodationOptions?.find((o) => o.id === lead.selectedAccommodationOptionId);
      return opt?.label ?? "—";
    }
    return "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/admin/bookings"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to bookings
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/ai?tool=booking_brief&leadId=${lead.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white/70 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-white"
          >
            <Bot className="h-4 w-4" />
            AI brief
          </Link>
          <InvoiceButton
            leadId={lead.id}
            invoice={existingInvoice}
            canCreate={!!pkg}
          />
          {pkg && (
            <EmailSuppliersButton
              lead={lead}
              pkg={pkg}
              result={getBookingSupplierEmails(lead, pkg, suppliers)}
              companyName={getDisplayCompanyName(settings)}
              companyTagline={settings.company.tagline}
              companyEmail={settings.company.email}
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-white/30 bg-white/50 shadow-lg backdrop-blur-xl">
            <div className="border-b border-white/20 bg-amber-500/10 px-6 py-6 backdrop-blur-sm">
              <h1 className="text-2xl font-bold text-stone-900">
                {lead.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-stone-600">
                {lead.reference && (
                  <span className="font-mono font-semibold text-teal-700">
                    {lead.reference}
                  </span>
                )}
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {lead.travelDate || "TBD"}
                </span>
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {lead.pax ?? "-"} pax
                </span>
                {pkg && (
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {pkg.name}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-6 p-6">
              {pkg ? (
                <>
                  <section>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-500">
                      Itinerary summary
                    </h2>
                    <div className="space-y-3">
                      {pkg.itinerary?.map((day) => {
                        const selectedHotel = getSelectedHotelForDay(day.day - 1);
                        return (
                          <div
                            key={day.day}
                            className="flex gap-4 rounded-xl border border-white/20 bg-white/30 px-4 py-3 backdrop-blur-sm"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
                              {day.day}
                            </span>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-medium text-stone-900">
                                {day.title}
                              </h3>
                              <p className="text-sm text-stone-600">
                                {day.description}
                              </p>
                              <p className="mt-1.5 flex items-center gap-2 text-xs font-medium text-teal-700">
                                <Building2 className="h-3.5 w-3.5" />
                                {selectedHotel !== "—"
                                  ? `Hotel: ${selectedHotel}`
                                  : (day.accommodationOptions?.length ?? 0) > 0
                                    ? `Hotel choices: ${day.accommodationOptions!.map((o) => o.label).join(", ")}`
                                    : day.accommodation
                                      ? `Hotel: ${day.accommodation}`
                                      : "—"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {(lead.selectedTransportOptionId || lead.selectedMealOptionId) && (
                    <section>
                      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-stone-500">
                        Selected options
                      </h2>
                      <div className="space-y-1 rounded-xl border border-teal-200 bg-teal-50/50 px-4 py-3 text-sm">
                        {lead.selectedTransportOptionId && (
                          <p className="flex items-center gap-2">
                            <Car className="h-4 w-4 text-teal-600" />
                            Transport: {pkg.transportOptions?.find((o) => o.id === lead.selectedTransportOptionId)?.label ?? "—"}
                          </p>
                        )}
                        {lead.selectedMealOptionId && (
                          <p className="flex items-center gap-2">
                            <UtensilsCrossed className="h-4 w-4 text-teal-600" />
                            Meal: {pkg.mealOptions?.find((o) => o.id === lead.selectedMealOptionId)?.label ?? "—"}
                          </p>
                        )}
                      </div>
                    </section>
                  )}

                  {financials && (lead.selectedAccommodationOptionId || (lead.selectedAccommodationByNight && Object.keys(lead.selectedAccommodationByNight).length > 0) || lead.selectedTransportOptionId || lead.selectedMealOptionId) && (
                    <section>
                      <div className="rounded-xl border border-teal-200 bg-teal-50/50 px-4 py-3">
                        <p className="flex items-center gap-2 text-lg font-semibold text-teal-800">
                          <DollarSign className="h-5 w-5" />
                          Total: {financials.totalPrice.toLocaleString()} {pkg.currency}
                        </p>
                      </div>
                      <BookingSupplierBreakdown lead={lead} pkg={pkg} suppliers={suppliers} />
                    </section>
                  )}

                  <section className="flex flex-wrap items-center gap-3 pt-2">
                    <Link
                      href={`/admin/bookings/${lead.id}/edit`}
                      className="rounded-xl border border-teal-600 bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-700 transition hover:bg-teal-100"
                    >
                      Edit booking
                    </Link>
                    <ApproveScheduleButton
                      leadId={lead.id}
                      hasTravelDate={!!lead.travelDate}
                    />
                  </section>
                </>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-800">
                  <p className="font-medium">No package selected</p>
                  <p className="mt-1 text-sm">
                    This booking doesn&apos;t have a package yet.{" "}
                    <Link href={`/admin/bookings/${lead.id}/edit`} className="underline hover:no-underline">
                      Edit the booking
                    </Link>{" "}
                    to select a package and see the itinerary.
                  </p>
                </div>
              )}
            </div>
          </div>

          <AuditTimeline title="Booking Activity" logs={auditLogs} />
        </div>

        <BookingCopilotPanel
          leadId={lead.id}
          leadName={lead.name}
          leadReference={lead.reference}
          runtimeReady={aiRuntime.enabled && aiRuntime.configured}
          missingReason={aiRuntime.missingReason}
        />
      </div>
    </div>
  );
}
