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
import { getCustomRouteMetaFromAuditLogs } from "@/lib/custom-route-booking";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { getBookingSupplierEmails } from "@/lib/booking-breakdown";
import { getLeadBookingFinancials } from "@/lib/booking-pricing";
import { resolveLeadPackage } from "@/lib/package-snapshot";
import { BookingSupplierBreakdown } from "../BookingSupplierBreakdown";
import { EmailSuppliersButton } from "../EmailSuppliersButton";
import { InvoiceButton } from "../InvoiceButton";
import { ApproveScheduleButton } from "./ApproveScheduleButton";
import { BookingCopilotPanel } from "./BookingCopilotPanel";
import { CustomRouteBreakdown } from "../CustomRouteBreakdown";

export const dynamic = "force-dynamic";

const statusBadge: Record<string, string> = {
  new: "bg-[#f3e8ce] text-[#7a5a17]",
  hold: "bg-[#f3e8ce] text-[#7a5a17]",
  cancelled: "bg-[#eed9cf] text-[#7c3a24]",
  won: "bg-[#12343b] text-[#f6ead6]",
};
const statusLabel: Record<string, string> = {
  new: "New",
  hold: "On Hold",
  cancelled: "Cancelled",
  won: "Scheduled",
};

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
        30
      )
    : [];
  const customRoute = getCustomRouteMetaFromAuditLogs(auditLogs);

  if (!lead) {
    return (
      <div className="space-y-6">
        <p className="text-[#5e7279]">Booking not found</p>
        <Link href="/admin/bookings" className="text-[#12343b] font-medium hover:underline">
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

  const currentStatus = lead.status ?? "new";
  const isScheduled = currentStatus === "won";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/admin/bookings"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to bookings
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/ai?tool=booking_brief&leadId=${lead.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-sm font-medium text-[#5e7279] transition hover:bg-[#f4ecdd]"
          >
            <Bot className="h-4 w-4" />
            AI brief
          </Link>
          <InvoiceButton leadId={lead.id} invoice={existingInvoice} canCreate={!!pkg} />
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
          <div className="paraiso-card overflow-hidden rounded-2xl">
            <div className="border-b border-[#e0e4dd] bg-[#f4ecdd] px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-[#11272b]">{lead.name}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[#5e7279]">
                    {lead.reference && (
                      <span className="font-mono font-semibold text-[#12343b]">{lead.reference}</span>
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
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge[currentStatus] ?? "bg-[#e2e3dd] text-[#545a54]"}`}>
                  {statusLabel[currentStatus] ?? currentStatus}
                </span>
              </div>
            </div>

            <div className="space-y-6 p-6">
              {pkg ? (
                <>
                  <section>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8a9ba1]">
                      Itinerary
                    </h2>
                    <div className="space-y-3">
                      {pkg.itinerary?.map((day) => {
                        const selectedHotel = getSelectedHotelForDay(day.day - 1);
                        return (
                          <div
                            key={day.day}
                            className="flex gap-4 rounded-xl border border-[#e0e4dd] bg-[#faf6ef] px-4 py-3"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef4f4] text-sm font-bold text-[#12343b]">
                              {day.day}
                            </span>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-medium text-[#11272b]">{day.title}</h3>
                              <p className="text-sm text-[#5e7279]">{day.description}</p>
                              <p className="mt-1.5 flex items-center gap-2 text-xs font-medium text-[#12343b]">
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
                      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#8a9ba1]">
                        Selected options
                      </h2>
                      <div className="space-y-1 rounded-xl border border-[#d6e2e5] bg-[#eef4f4] px-4 py-3 text-sm">
                        {lead.selectedTransportOptionId && (
                          <p className="flex items-center gap-2">
                            <Car className="h-4 w-4 text-[#12343b]" />
                            Transport: {pkg.transportOptions?.find((o) => o.id === lead.selectedTransportOptionId)?.label ?? "—"}
                          </p>
                        )}
                        {lead.selectedMealOptionId && (
                          <p className="flex items-center gap-2">
                            <UtensilsCrossed className="h-4 w-4 text-[#12343b]" />
                            Meal: {pkg.mealOptions?.find((o) => o.id === lead.selectedMealOptionId)?.label ?? "—"}
                          </p>
                        )}
                      </div>
                    </section>
                  )}

                  {financials && (
                    <section>
                      <div className="rounded-xl border border-[#d6e2e5] bg-[#eef4f4] px-4 py-3">
                        <p className="flex items-center gap-2 text-lg font-semibold text-[#11272b]">
                          <DollarSign className="h-5 w-5 text-[#12343b]" />
                          Total: {financials.totalPrice.toLocaleString()} {pkg.currency}
                        </p>
                      </div>
                      <BookingSupplierBreakdown lead={lead} pkg={pkg} suppliers={suppliers} />
                    </section>
                  )}

                  {!isScheduled && (
                    <section className="flex flex-wrap items-center gap-3 border-t border-[#e0e4dd] pt-5">
                      <Link
                        href={`/admin/bookings/${lead.id}/edit`}
                        className="rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-sm font-medium text-[#5e7279] transition hover:bg-[#f4ecdd]"
                      >
                        Edit booking
                      </Link>
                      <ApproveScheduleButton
                        leadId={lead.id}
                        hasTravelDate={!!lead.travelDate}
                      />
                    </section>
                  )}

                  {isScheduled && (
                    <section className="rounded-xl border border-[#dce8dc] bg-[#dce8dc]/30 px-4 py-3 flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-[#375a3f] shrink-0" />
                      <div>
                        <p className="font-semibold text-[#375a3f]">Tour scheduled</p>
                        <p className="text-xs text-[#5e7279]">
                          View details in{" "}
                          <Link href="/admin/calendar" className="underline hover:no-underline">
                            Scheduled Tours
                          </Link>
                        </p>
                      </div>
                    </section>
                  )}
                </>
              ) : (
                customRoute ? (
                  <div className="space-y-5">
                    <CustomRouteBreakdown lead={lead} route={customRoute} />
                    <section className="flex flex-wrap items-center gap-3 border-t border-[#e0e4dd] pt-5">
                      <Link
                        href={`/admin/bookings/${lead.id}/edit`}
                        className="rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-sm font-medium text-[#5e7279] transition hover:bg-[#f4ecdd]"
                      >
                        Edit booking
                      </Link>
                      <p className="text-sm text-[#8a9ba1]">
                        Finalize package and booking selections before confirming this journey.
                      </p>
                    </section>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#f3e8ce] bg-[#f9f2e3] px-4 py-4 text-[#7a5a17]">
                    <p className="font-medium">No package selected</p>
                    <p className="mt-1 text-sm">
                      This booking doesn&apos;t have a package yet.{" "}
                      <Link href={`/admin/bookings/${lead.id}/edit`} className="underline hover:no-underline">
                        Edit the booking
                      </Link>{" "}
                      to select a package and see the itinerary.
                    </p>
                  </div>
                )
              )}
            </div>
          </div>

          <AuditTimeline title="Booking Activity" logs={auditLogs} />
        </div>
      </div>
    </div>
  );
}
