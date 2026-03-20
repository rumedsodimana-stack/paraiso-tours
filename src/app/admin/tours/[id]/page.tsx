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

  const statusColors: Record<string, string> = {
    scheduled: "bg-sky-100 text-sky-800",
    confirmed: "bg-emerald-100 text-emerald-800",
    "in-progress": "bg-amber-100 text-amber-800",
    completed: "bg-stone-100 text-stone-600",
    cancelled: "bg-red-100 text-red-800",
  };

  const showAccompaniedGuest = tour.pax >= 2 && lead?.accompaniedGuestName?.trim();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link
          href="/admin/calendar"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Scheduled Tours
        </Link>
        <PrintButton />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/30 bg-white/50 shadow-lg backdrop-blur-xl print:border-stone-300 print:shadow-none">
        <div className="border-b border-white/20 bg-teal-500/10 px-6 py-6 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">
                {tour.clientName}
              </h1>
              <p className="mt-1 text-lg text-teal-700 font-medium">
                {tour.packageName}
              </p>
            </div>
            <span
              className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize ${statusColors[tour.status] ?? "bg-stone-100 text-stone-700"}`}
            >
              {tour.status}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-stone-600">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {tour.startDate} → {tour.endDate}
            </span>
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {tour.pax} pax
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {pkg?.destination ?? "—"}
            </span>
            {lead?.reference && (
              <span className="font-mono font-semibold text-teal-700">
                {lead.reference}
              </span>
            )}
            {showAccompaniedGuest && (
              <span className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Accompanied by: {lead?.accompaniedGuestName}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-6 p-6">
          {tour.availabilityStatus === "attention_needed" &&
          (tour.availabilityWarnings?.length ?? 0) > 0 ? (
            <section className="rounded-2xl border border-amber-300 bg-amber-50/90 px-4 py-4 text-amber-900">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
                <AlertTriangle className="h-4 w-4" />
                Supplier Attention Needed
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {tour.availabilityWarnings?.map((warning) => (
                  <li key={warning} className="rounded-xl bg-white/60 px-3 py-2">
                    {warning}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {pkg ? (
            <>
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-500">
                  Full Itinerary
                </h2>
                <div className="space-y-3">
                  {pkg.itinerary?.map((day) => {
                    const dayDate = addDays(tour.startDate, day.day - 1);
                    const selectedHotel = getSelectedHotelForDay(day.day - 1);
                    return (
                      <div
                        key={day.day}
                        className="flex gap-4 rounded-xl border border-white/20 bg-white/30 px-4 py-4 backdrop-blur-sm"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
                          {day.day}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-stone-500">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(dayDate).toLocaleDateString("en-GB", {
                              weekday: "long",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                          <h3 className="font-semibold text-stone-900">
                            {day.title}
                          </h3>
                          <p className="mt-1 text-sm text-stone-600">
                            {day.description}
                          </p>
                          <p className="mt-2 flex items-center gap-2 text-xs font-medium text-teal-700">
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
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-stone-500">
                    Transport & meal plan
                  </h2>
                  <div className="space-y-2 rounded-xl border border-teal-200 bg-teal-50/50 px-4 py-3 text-sm">
                    {lead.selectedTransportOptionId && (
                      <p className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-teal-600" />
                        <span className="font-medium text-stone-700">Transport:</span>{" "}
                        {pkg.transportOptions?.find((o) => o.id === lead.selectedTransportOptionId)?.label ?? "—"}
                      </p>
                    )}
                    {lead.selectedMealOptionId && (
                      <p className="flex items-center gap-2">
                        <UtensilsCrossed className="h-4 w-4 text-teal-600" />
                        <span className="font-medium text-stone-700">Meal plan:</span>{" "}
                        {pkg.mealOptions?.find((o) => o.id === lead.selectedMealOptionId)?.label ?? "—"}
                      </p>
                    )}
                  </div>
                </section>
              )}

              {lead && (
                <section>
                  <div className="rounded-xl border border-teal-200 bg-teal-50/50 px-4 py-3">
                    <p className="flex items-center gap-2 text-lg font-semibold text-teal-800">
                      <DollarSign className="h-5 w-5" />
                      Total: {tour.totalValue.toLocaleString()} {tour.currency}
                    </p>
                  </div>
                  <BookingSupplierBreakdown
                    lead={lead}
                    pkg={pkg}
                    suppliers={suppliers}
                  />
                </section>
              )}

              {tour.status !== "completed" && tour.status !== "cancelled" && (
                <section className="border-t border-stone-200 pt-6 print:hidden">
                  <CompletedPaidButton
                    tourId={tour.id}
                    tourStatus={tour.status}
                  />
                </section>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-800">
              <p className="font-medium">Package not found</p>
              <p className="mt-1 text-sm">
                The tour package may have been removed.
              </p>
            </div>
          )}
          {tour.status !== "completed" && tour.status !== "cancelled" && !pkg && (
            <section className="pt-4 border-t border-white/20 print:hidden">
              <CompletedPaidButton tourId={tour.id} tourStatus={tour.status} />
            </section>
          )}
        </div>
      </div>

      <AuditTimeline title="Tour Activity" logs={auditLogs} />
    </div>
  );
}
