import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Compass,
  MapPin,
  Pencil,
  Plus,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import { getHotels, getPlannerActivityRecords, getHotelMealPlans } from "@/lib/db";
import { getPlannerDestination } from "@/lib/route-planner";
import type { PlannerDestinationId } from "@/lib/route-planner";
import type { HotelMealPlan } from "@/lib/types";
import { DeleteActivityButton } from "../../activities/DeleteActivityButton";

export default async function DestinationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const destination = getPlannerDestination(id as PlannerDestinationId);

  const [allHotels, allActivities] = await Promise.all([
    getHotels(),
    getPlannerActivityRecords(),
  ]);

  const hotels = allHotels.filter((h) => h.destinationId === id && !h.archivedAt);
  const activities = allActivities.filter((a) => a.destinationId === id);

  // Fetch meal plans for each hotel in parallel
  const mealPlansMap = new Map<string, HotelMealPlan[]>();
  const mealPlanResults = await Promise.all(
    hotels.map(async (h) => {
      const plans = await getHotelMealPlans(h.id);
      return { hotelId: h.id, plans };
    })
  );
  for (const { hotelId, plans } of mealPlanResults) {
    mealPlansMap.set(hotelId, plans);
  }

  const energyBadge = (energy: string) => {
    switch (energy) {
      case "active":   return "bg-[#eed9cf] text-[#7c3a24]";
      case "moderate": return "bg-[#f3e8ce] text-[#7a5a17]";
      default:         return "bg-[#dce8dc] text-[#375a3f]";
    }
  };

  return (
    <div className="space-y-8">
      {/* Back link & header */}
      <div>
        <Link
          href="/admin/destinations"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5e7279] transition hover:text-[#11272b]"
        >
          <ArrowLeft className="h-4 w-4" />
          All Destinations
        </Link>
        <div className="mt-3 flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#12343b] text-[#f6ead6]">
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#11272b]">{destination.name}</h1>
            <p className="mt-0.5 text-sm text-[#5e7279]">
              {destination.region} &middot; {destination.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Hotels section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#11272b]">
            <Building2 className="h-4 w-4 text-[#8a9ba1]" />
            Hotels ({hotels.length})
          </h2>
          <Link
            href={`/admin/hotels/new?type=hotel&destination=${id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-3.5 py-2 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
          >
            <Plus className="h-4 w-4" />
            Add Hotel
          </Link>
        </div>

        {hotels.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#ddd3c4] bg-[#faf6ef] px-5 py-10 text-center">
            <Building2 className="mx-auto h-8 w-8 text-[#8a9ba1]" />
            <p className="mt-2 text-sm text-[#5e7279]">No hotels at this destination yet.</p>
            <Link
              href={`/admin/hotels/new?type=hotel&destination=${id}`}
              className="mt-3 inline-block text-sm font-medium text-[#12343b] hover:underline"
            >
              Add the first hotel
            </Link>
          </div>
        ) : (
          <div className="paraiso-card overflow-hidden rounded-2xl">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[#e0e4dd] bg-[#f4ecdd]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Hotel</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Rating</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Rate / Night</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Meal Plans</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e0e4dd]">
                {hotels.map((hotel) => {
                  const plans = mealPlansMap.get(hotel.id) ?? [];
                  return (
                    <tr key={hotel.id} className="transition hover:bg-[#faf6ef]">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-[#11272b]">{hotel.name}</p>
                        {hotel.location && (
                          <p className="mt-0.5 text-xs text-[#8a9ba1]">{hotel.location}</p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {hotel.starRating ? (
                          <span className="inline-flex items-center gap-0.5 text-sm text-[#c9922f]">
                            {Array.from({ length: hotel.starRating }).map((_, i) => (
                              <Star key={i} className="h-3.5 w-3.5 fill-[#c9922f] text-[#c9922f]" />
                            ))}
                          </span>
                        ) : (
                          <span className="text-xs text-[#8a9ba1]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-semibold text-[#11272b]">
                        {hotel.defaultPricePerNight != null ? (
                          <>
                            {hotel.defaultPricePerNight.toLocaleString()}{" "}
                            {hotel.currency}
                          </>
                        ) : (
                          <span className="text-[#8a9ba1]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {plans.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {plans.map((mp) => (
                              <span
                                key={mp.id}
                                className="inline-flex items-center gap-1 rounded-full bg-[#f3e8ce] px-2 py-0.5 text-xs font-medium text-[#7a5a17]"
                              >
                                <UtensilsCrossed className="h-3 w-3" />
                                {mp.label}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-[#8a9ba1]">No meal plans</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/hotels/${hotel.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-2.5 py-1.5 text-xs font-medium text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
                          >
                            <UtensilsCrossed className="h-3.5 w-3.5" />
                            Meal Plans
                          </Link>
                          <Link
                            href={`/admin/hotels/${hotel.id}/edit`}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-2.5 py-1.5 text-xs font-medium text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Activities section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#11272b]">
            <Compass className="h-4 w-4 text-[#8a9ba1]" />
            Activities ({activities.length})
          </h2>
          <Link
            href={`/admin/activities/new?destination=${id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-3.5 py-2 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
          >
            <Plus className="h-4 w-4" />
            Add Activity
          </Link>
        </div>

        {activities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#ddd3c4] bg-[#faf6ef] px-5 py-10 text-center">
            <Compass className="mx-auto h-8 w-8 text-[#8a9ba1]" />
            <p className="mt-2 text-sm text-[#5e7279]">No activities at this destination yet.</p>
            <Link
              href={`/admin/activities/new?destination=${id}`}
              className="mt-3 inline-block text-sm font-medium text-[#12343b] hover:underline"
            >
              Add the first activity
            </Link>
          </div>
        ) : (
          <div className="paraiso-card overflow-hidden rounded-2xl">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[#e0e4dd] bg-[#f4ecdd]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Title</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Duration</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Energy</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Price</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e0e4dd]">
                {activities.map((act) => (
                  <tr key={act.id} className="transition hover:bg-[#faf6ef]">
                    <td className="px-5 py-3">
                      <p className="font-medium text-[#11272b]">{act.title}</p>
                      <p className="mt-0.5 text-xs text-[#8a9ba1] line-clamp-1">{act.summary}</p>
                    </td>
                    <td className="px-5 py-3 text-sm text-[#5e7279]">{act.durationLabel}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${energyBadge(act.energy)}`}>
                        {act.energy}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-semibold text-[#11272b]">
                      {act.estimatedPrice > 0 ? `$${act.estimatedPrice.toLocaleString()}` : "Free"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/activities/${act.id}/edit`}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-2.5 py-1.5 text-xs font-medium text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Link>
                        <DeleteActivityButton activityId={act.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
