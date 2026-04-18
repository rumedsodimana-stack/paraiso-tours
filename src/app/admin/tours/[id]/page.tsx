import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  DollarSign,
  Building2,
  Car,
  UtensilsCrossed,
  Calendar,
  Users,
  Clock,
  UserPlus,
  AlertTriangle,
} from "lucide-react";
import { getTour, getLead, getPackage, getHotels } from "@/lib/db";
import { getAuditLogsForEntities } from "@/lib/audit";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { BookingSupplierBreakdown } from "../../bookings/BookingSupplierBreakdown";
import { PrintButton } from "../../payables/PrintButton";
import { CompletedPaidButton } from "./CompletedPaidButton";
import { resolveTourPackage } from "@/lib/package-snapshot";

export const dynamic = "force-dynamic";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const tourStatusBadge: Record<string, string> = {
  scheduled:     "bg-[#f3e8ce] text-[#7a5a17]",
  confirmed:     "bg-[#dce8dc] text-[#375a3f]",
  "in-progress": "bg-[#d6e2e5] text-[#294b55]",
  completed:     "bg-[#e2e3dd] text-[#545a54]",
  cancelled:     "bg-[#eed9cf] text-[#7c3a24]",
};
const tourStatusLabel: Record<string, string> = {
  scheduled: "Tour Scheduled",
  confirmed: "Confirmed",
  "in-progress": "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function TourDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tour = await getTour(id);
  if (!tour) notFound();

  const [lead, livePackage, suppliers] = await Promise.all([
    getLead(tour.leadId),
    getPackage(tour.packageId),
    getHotels(),
  ]);
  const pkg = resolveTourPackage(tour, livePackage, lead);
  const auditLogs = await getAuditLogsForEntities(
    [{ entityType: "tour", entityId: tour.id }],
    10
  );

  const getSelectedHotelForDay = (dayIndex: number): string => {
    if (!pkg || !lead) return "—";
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

  const showAccompaniedGuest = tour.pax >= 2 && lead?.accompaniedGuestName?.trim();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link
          href="/admin/calendar"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Scheduled Tours
        </Link>
        <PrintButton />
      </div>

      <div className="paraiso-card overflow-hidden rounded-2xl print:border-[#e0e4dd] print:shadow-none">
        <div className="border-b border-[#e0e4dd] bg-[#f4ecdd] px-6 py-5 print:bg-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#11272b]">{tour.clientName}</h1>
              <p className="mt-1 text-lg font-semibold text-[#12343b]">{tour.packageName}</p>
            </div>
            <span className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${tourStatusBadge[tour.status] ?? "bg-[#e2e3dd] text-[#545a54]"}`}>
              {tourStatusLabel[tour.status] ?? tour.status}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-[#5e7279]">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#8a9ba1]" />
              {tour.startDate} → {tour.endDate}
            </span>
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#8a9ba1]" />
              {tour.pax} pax
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#8a9ba1]" />
              {pkg?.destination ?? "—"}
            </span>
            {tour.confirmationId && (
              <span className="rounded-lg bg-[#eef4f4] px-2.5 py-1 font-mono text-xs font-bold tracking-wider text-[#12343b] ring-1 ring-[#d6e2e5]">
                {tour.confirmationId}
              </span>
            )}
            {lead?.reference && (
              <span className="rounded-lg bg-[#f4ecdd] px-2.5 py-1 font-mono text-xs font-semibold tracking-wider text-[#7a5a17] ring-1 ring-[#e0d4bc]">
                {lead.reference}
              </span>
            )}
            {showAccompaniedGuest && (
              <span className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-[#8a9ba1]" />
                Accompanied by: {lead?.accompaniedGuestName}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-6 p-6">
          {tour.availabilityStatus === "attention_needed" &&
          (tour.availabilityWarnings?.length ?? 0) > 0 ? (
            <section className="rounded-2xl border border-[#f3e8ce] bg-[#f9f2e3] px-4 py-4 text-[#7a5a17]">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
                <AlertTriangle className="h-4 w-4" />
                Supplier Attention Needed
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {tour.availabilityWarnings?.map((warning) => (
                  <li key={warning} className="rounded-xl bg-[#fffbf4] px-3 py-2 border border-[#e0d4bc]">
                    {warning}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {pkg ? (
            <>
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8a9ba1]">
                  Full Itinerary
                </h2>
                <div className="space-y-3">
                  {pkg.itinerary?.map((day) => {
                    const dayDate = addDays(tour.startDate, day.day - 1);
                    const selectedHotel = getSelectedHotelForDay(day.day - 1);
                    return (
                      <div
                        key={day.day}
                        className="flex gap-4 rounded-xl border border-[#e0e4dd] bg-[#faf6ef] px-4 py-4"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef4f4] text-sm font-bold text-[#12343b]">
                          {day.day}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-[#8a9ba1]">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(dayDate).toLocaleDateString("en-GB", {
                              weekday: "long",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                          <h3 className="font-semibold text-[#11272b]">{day.title}</h3>
                          <p className="mt-1 text-sm text-[#5e7279]">{day.description}</p>
                          <p className="mt-2 flex items-center gap-2 text-xs font-medium text-[#12343b]">
                            <Building2 className="h-3.5 w-3.5" />
                            {selectedHotel !== "—"
                              ? `Accommodation: ${selectedHotel}`
                              : (day.accommodationOptions?.length ?? 0) > 0
                                ? `Hotel choices: ${day.accommodationOptions!.map((o) => o.label).join(", ")}`
                                : day.accommodation
                                  ? `Accommodation: ${day.accommodation}`
                                  : "—"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {(lead?.selectedTransportOptionId || lead?.selectedMealOptionId) && (
                <section>
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#8a9ba1]">
                    Transport &amp; meal plan
                  </h2>
                  <div className="space-y-2 rounded-xl border border-[#d6e2e5] bg-[#eef4f4] px-4 py-3 text-sm">
                    {lead.selectedTransportOptionId && (
                      <p className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-[#12343b]" />
                        <span className="font-medium text-[#11272b]">Transport:</span>{" "}
                        {pkg.transportOptions?.find((o) => o.id === lead.selectedTransportOptionId)?.label ?? "—"}
                      </p>
                    )}
                    {lead.selectedMealOptionId && (
                      <p className="flex items-center gap-2">
                        <UtensilsCrossed className="h-4 w-4 text-[#12343b]" />
                        <span className="font-medium text-[#11272b]">Meal plan:</span>{" "}
                        {pkg.mealOptions?.find((o) => o.id === lead.selectedMealOptionId)?.label ?? "—"}
                      </p>
                    )}
                  </div>
                </section>
              )}

              {lead && (
                <section>
                  <div className="rounded-xl border border-[#d6e2e5] bg-[#eef4f4] px-4 py-3">
                    <p className="flex items-center gap-2 text-lg font-bold text-[#11272b]">
                      <DollarSign className="h-5 w-5 text-[#12343b]" />
                      Total: {tour.totalValue.toLocaleString()} {tour.currency}
                    </p>
                  </div>
                  <BookingSupplierBreakdown lead={lead} pkg={pkg} suppliers={suppliers} />
                </section>
              )}

              {tour.status !== "completed" && tour.status !== "cancelled" && (
                <section className="border-t border-[#e0e4dd] pt-6 print:hidden">
                  <CompletedPaidButton tourId={tour.id} tourStatus={tour.status} />
                </section>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-[#f3e8ce] bg-[#f9f2e3] px-4 py-4 text-[#7a5a17]">
              <p className="font-medium">Package not found</p>
              <p className="mt-1 text-sm">The tour package may have been removed.</p>
            </div>
          )}
          {tour.status !== "completed" && tour.status !== "cancelled" && !pkg && (
            <section className="pt-4 border-t border-[#e0e4dd] print:hidden">
              <CompletedPaidButton tourId={tour.id} tourStatus={tour.status} />
            </section>
          )}
        </div>
      </div>

      <AuditTimeline title="Tour Activity" logs={auditLogs} />
    </div>
  );
}
