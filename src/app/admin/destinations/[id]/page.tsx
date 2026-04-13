import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Compass,
  Plus,
  Pencil,
  Trash2,
  Star,
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

  const hotels = allHotels.filter((h) => h.destinationId === id);
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
      case "active":
        return "bg-orange-100 text-orange-700";
      case "moderate":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-emerald-100 text-emerald-700";
    }
  };

  return (
    <div className="space-y-8">
      {/* Back link & header */}
      <div>
        <Link
          href="/admin/destinations"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition hover:text-teal-600"
        >
          <ArrowLeft className="h-4 w-4" />
          All Destinations
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-stone-900 dark:text-stone-50">
          {destination.name}
        </h1>
        <p className="mt-1 text-stone-600 dark:text-stone-400">
          {destination.region} &middot; {destination.summary}
        </p>
      </div>

      {/* Hotels section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-800 dark:text-stone-100">
            <Building2 className="h-5 w-5" />
            Hotels ({hotels.length})
          </h2>
          <Link
            href={`/admin/hotels/new?type=hotel&destination=${id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />
            Add Hotel
          </Link>
        </div>

        {hotels.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[1.8rem] border-2 border-dashed border-white/40 bg-white/30 py-12 backdrop-blur-xl">
            <Building2 className="h-10 w-10 text-stone-400" />
            <p className="mt-3 text-stone-600 dark:text-stone-400">
              No hotels at this destination yet.
            </p>
            <Link
              href={`/admin/hotels/new?type=hotel&destination=${id}`}
              className="mt-3 font-medium text-teal-600 hover:text-teal-700"
            >
              Add the first hotel
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[1.8rem] border border-[#ddc8b0] bg-white/74 shadow-sm backdrop-blur-sm">
            <table className="min-w-full divide-y divide-stone-200">
              <thead>
                <tr className="bg-stone-50/80">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">
                    Hotel
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">
                    Rating
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-stone-500">
                    Price/Night
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">
                    Meal Plans
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-stone-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {hotels.map((hotel) => {
                  const mealPlans = mealPlansMap.get(hotel.id) ?? [];
                  return (
                    <tr key={hotel.id} className="transition hover:bg-white/70">
                      <td className="px-5 py-3">
                        <p className="font-medium text-stone-900">
                          {hotel.name}
                        </p>
                        {hotel.location && (
                          <p className="mt-0.5 text-xs text-stone-500">
                            {hotel.location}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {hotel.starRating ? (
                          <span className="inline-flex items-center gap-1 text-sm text-amber-600">
                            {Array.from({ length: hotel.starRating }).map(
                              (_, i) => (
                                <Star
                                  key={i}
                                  className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                                />
                              )
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-stone-400">--</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-medium text-stone-700">
                        {hotel.defaultPricePerNight != null ? (
                          <>
                            {hotel.defaultPricePerNight.toLocaleString()}{" "}
                            {hotel.currency}
                          </>
                        ) : (
                          <span className="text-stone-400">--</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {mealPlans.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {mealPlans.map((mp) => (
                              <span
                                key={mp.id}
                                className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700"
                              >
                                {mp.label}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-stone-400">
                            No meal plans
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/admin/hotels/${hotel.id}/edit`}
                          className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 transition hover:border-teal-300 hover:text-teal-700"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Link>
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
          <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-800 dark:text-stone-100">
            <Compass className="h-5 w-5" />
            Activities ({activities.length})
          </h2>
          <Link
            href={`/admin/activities/new?destination=${id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />
            Add Activity
          </Link>
        </div>

        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[1.8rem] border-2 border-dashed border-white/40 bg-white/30 py-12 backdrop-blur-xl">
            <Compass className="h-10 w-10 text-stone-400" />
            <p className="mt-3 text-stone-600 dark:text-stone-400">
              No activities at this destination yet.
            </p>
            <Link
              href={`/admin/activities/new?destination=${id}`}
              className="mt-3 font-medium text-teal-600 hover:text-teal-700"
            >
              Add the first activity
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[1.8rem] border border-[#ddc8b0] bg-white/74 shadow-sm backdrop-blur-sm">
            <table className="min-w-full divide-y divide-stone-200">
              <thead>
                <tr className="bg-stone-50/80">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">
                    Title
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">
                    Duration
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">
                    Energy
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-stone-500">
                    Price
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-stone-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {activities.map((act) => (
                  <tr key={act.id} className="transition hover:bg-white/70">
                    <td className="px-5 py-3">
                      <p className="font-medium text-stone-900">{act.title}</p>
                      <p className="mt-0.5 text-xs text-stone-500 line-clamp-1">
                        {act.summary}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-sm text-stone-600">
                      {act.durationLabel}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${energyBadge(act.energy)}`}
                      >
                        {act.energy}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-medium text-stone-700">
                      {act.estimatedPrice > 0
                        ? `$${act.estimatedPrice.toLocaleString()}`
                        : "Free"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/activities/${act.id}/edit`}
                          className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 transition hover:border-teal-300 hover:text-teal-700"
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
