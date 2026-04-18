import { BedDouble, Car, MapPin, UtensilsCrossed } from "lucide-react";
import type { Lead } from "@/lib/types";
import type { CustomRouteMeta } from "@/lib/custom-route-booking";

function formatAccommodationMode(value?: string) {
  if (!value) return "Not finalized";
  if (value === "auto") return "Best available stay requested";
  if (value === "choose") return "Guest selected each stay";
  return value;
}

export function CustomRouteBreakdown({
  lead,
  route,
}: {
  lead: Lead;
  route: CustomRouteMeta;
}) {
  return (
    <section className="space-y-5 rounded-2xl border border-[#ddc8b0] bg-[#fffaf4] p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
          Custom journey request
        </p>
        <h2 className="mt-2 text-xl font-semibold text-stone-900">
          Full itinerary breakdown
        </h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          This booking came from the route builder. The route is ready for review, but
          package-linked options are still open so the team can finalize them.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[#eadfce] bg-white px-4 py-4">
          <p className="text-sm font-semibold text-stone-900">Stay handling</p>
          <p className="mt-2 text-sm text-stone-600">
            {formatAccommodationMode(route.accommodationMode)}
          </p>
        </div>
        <div className="rounded-xl border border-[#eadfce] bg-white px-4 py-4">
          <p className="text-sm font-semibold text-stone-900">Requested transport</p>
          <p className="mt-2 text-sm text-stone-600">
            {route.transportLabel ?? "Not selected"}
          </p>
        </div>
        <div className="rounded-xl border border-[#eadfce] bg-white px-4 py-4">
          <p className="text-sm font-semibold text-stone-900">Requested meals</p>
          <p className="mt-2 text-sm text-stone-600">
            {route.mealLabel ?? "No meal plan"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {route.routeStops.map((stop, index) => (
          <div
            key={`${stop.destinationName ?? "destination"}_${index}`}
            className="rounded-xl border border-[#eadfce] bg-white px-4 py-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#12343b] text-sm font-semibold text-[#f7ead7]">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-stone-900">
                      {stop.destinationName ?? "Destination"}
                    </h3>
                    <p className="text-sm text-stone-500">
                      {stop.nights ?? 1} night{stop.nights === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              </div>
              {(stop.legDistanceKm != null || stop.legDriveHours != null) && (
                <div className="rounded-full bg-[#f8f3eb] px-3 py-1.5 text-xs font-medium text-stone-600">
                  Transfer in: {stop.legDistanceKm ?? 0} km /{" "}
                  {stop.legDriveHours != null ? `${stop.legDriveHours.toFixed(1)} h` : "TBD"}
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-[#fbf7f1] px-3 py-3">
                <p className="flex items-center gap-2 text-sm font-medium text-stone-900">
                  <BedDouble className="h-4 w-4 text-teal-700" />
                  Stay request
                </p>
                <p className="mt-2 text-sm text-stone-600">
                  {stop.hotelName
                    ? `${stop.hotelName}${
                        stop.hotelRate != null
                          ? ` (${stop.hotelRate.toLocaleString()} ${stop.hotelCurrency ?? "USD"} per night)`
                          : ""
                      }`
                    : "Admin to finalize hotel selection"}
                </p>
              </div>
              <div className="rounded-xl bg-[#fbf7f1] px-3 py-3">
                <p className="flex items-center gap-2 text-sm font-medium text-stone-900">
                  <MapPin className="h-4 w-4 text-teal-700" />
                  Activities
                </p>
                <p className="mt-2 text-sm text-stone-600">
                  {stop.activities && stop.activities.length > 0
                    ? stop.activities.join(", ")
                    : "No activities selected"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[#eadfce] bg-white px-4 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <BedDouble className="h-4 w-4 text-teal-700" />
            Accommodation option
          </p>
          <p className="mt-2 text-sm text-stone-600">
            {lead.selectedAccommodationOptionId ||
            (lead.selectedAccommodationByNight &&
              Object.keys(lead.selectedAccommodationByNight).length > 0)
              ? "Selected on booking"
              : "Not finalized yet"}
          </p>
        </div>
        <div className="rounded-xl border border-[#eadfce] bg-white px-4 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <Car className="h-4 w-4 text-teal-700" />
            Transport option
          </p>
          <p className="mt-2 text-sm text-stone-600">
            {lead.selectedTransportOptionId ? "Selected on booking" : "Not finalized yet"}
          </p>
        </div>
        <div className="rounded-xl border border-[#eadfce] bg-white px-4 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <UtensilsCrossed className="h-4 w-4 text-teal-700" />
            Meal option
          </p>
          <p className="mt-2 text-sm text-stone-600">
            {lead.selectedMealOptionId ? "Selected on booking" : "Not finalized yet"}
          </p>
        </div>
      </div>

      {route.mealRequest ? (
        <div className="rounded-xl border border-[#eadfce] bg-white px-4 py-4">
          <p className="text-sm font-semibold text-stone-900">Guest meal request</p>
          <p className="mt-2 text-sm leading-6 text-stone-600">{route.mealRequest}</p>
        </div>
      ) : null}
    </section>
  );
}
