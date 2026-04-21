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
        <p className="text-xs uppercase tracking-[0.22em] text-[#5e7279]">
          Custom journey request
        </p>
        <h2 className="mt-2 text-xl font-semibold text-[#11272b]">
          Full itinerary breakdown
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#5e7279]">
          This booking came from the route builder. The route is ready for review, but
          package-linked options are still open so the team can finalize them.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[#eadfce] bg-white px-4 py-4">
          <p className="text-sm font-semibold text-[#11272b]">Stay handling</p>
          <p className="mt-2 text-sm text-[#5e7279]">
            {formatAccommodationMode(route.accommodationMode)}
          </p>
        </div>
        <div className="rounded-xl border border-[#eadfce] bg-white px-4 py-4">
          <p className="text-sm font-semibold text-[#11272b]">Requested transport</p>
          <p className="mt-2 text-sm text-[#5e7279]">
            {route.transportLabel ?? "Not selected"}
          </p>
        </div>
        <div className="rounded-xl border border-[#eadfce] bg-white px-4 py-4">
          <p className="text-sm font-semibold text-[#11272b]">Requested meals</p>
          <p className="mt-2 text-sm text-[#5e7279]">
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
                    <h3 className="font-semibold text-[#11272b]">
                      {stop.destinationName ?? "Destination"}
                    </h3>
                    <p className="text-sm text-[#5e7279]">
                      {stop.nights ?? 1} night{stop.nights === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              </div>
              {(stop.legDistanceKm != null || stop.legDriveHours != null) && (
                <div className="rounded-full bg-[#f8f3eb] px-3 py-1.5 text-xs font-medium text-[#5e7279]">
                  Transfer in: {stop.legDistanceKm ?? 0} km /{" "}
                  {stop.legDriveHours != null ? `${stop.legDriveHours.toFixed(1)} h` : "TBD"}
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-[#fbf7f1] px-3 py-3">
                <p className="flex items-center gap-2 text-sm font-medium text-[#11272b]">
                  <BedDouble className="h-4 w-4 text-[#12343b]" />
                  Stay request
                </p>
                <p className="mt-2 text-sm text-[#5e7279]">
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
                <p className="flex items-center gap-2 text-sm font-medium text-[#11272b]">
                  <MapPin className="h-4 w-4 text-[#12343b]" />
                  Activities
                </p>
                <p className="mt-2 text-sm text-[#5e7279]">
                  {stop.activities && stop.activities.length > 0
                    ? stop.activities.join(", ")
                    : "No activities selected"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(() => {
        const accommodationFinalized =
          !!lead.selectedAccommodationOptionId ||
          (lead.selectedAccommodationByNight &&
            Object.keys(lead.selectedAccommodationByNight).length > 0) ||
          route.routeStops.some((stop) => !!stop.hotelName?.trim());
        const transportFinalized =
          !!lead.selectedTransportOptionId || !!route.transportLabel?.trim();
        const mealFinalized =
          !!lead.selectedMealOptionId ||
          !!route.mealLabel?.trim() ||
          !!route.mealRequest?.trim();

        const accommodationLabel = accommodationFinalized
          ? route.routeStops.every((stop) => stop.hotelName?.trim())
            ? "Hotels selected per stop"
            : "Selected on booking"
          : "Admin to finalize hotel selection";
        const transportLabel = transportFinalized
          ? route.transportLabel || "Selected on booking"
          : "Not finalized yet";
        const mealLabel = mealFinalized
          ? route.mealLabel || (route.mealRequest ? "Custom meal request" : "Selected on booking")
          : "Not finalized yet";

        return (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[#eadfce] bg-white px-4 py-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#11272b]">
                <BedDouble className="h-4 w-4 text-[#12343b]" />
                Accommodation option
              </p>
              <p className="mt-2 text-sm text-[#5e7279]">{accommodationLabel}</p>
            </div>
            <div className="rounded-xl border border-[#eadfce] bg-white px-4 py-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#11272b]">
                <Car className="h-4 w-4 text-[#12343b]" />
                Transport option
              </p>
              <p className="mt-2 text-sm text-[#5e7279]">{transportLabel}</p>
            </div>
            <div className="rounded-xl border border-[#eadfce] bg-white px-4 py-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#11272b]">
                <UtensilsCrossed className="h-4 w-4 text-[#12343b]" />
                Meal option
              </p>
              <p className="mt-2 text-sm text-[#5e7279]">{mealLabel}</p>
            </div>
          </div>
        );
      })()}

      {route.mealRequest ? (
        <div className="rounded-xl border border-[#eadfce] bg-white px-4 py-4">
          <p className="text-sm font-semibold text-[#11272b]">Guest meal request</p>
          <p className="mt-2 text-sm leading-6 text-[#5e7279]">{route.mealRequest}</p>
        </div>
      ) : null}
    </section>
  );
}
