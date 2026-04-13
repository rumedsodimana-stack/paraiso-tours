import Link from "next/link";
import { MapPin, Building2, Compass, ChevronRight } from "lucide-react";
import { getHotels, getPlannerActivityRecords } from "@/lib/db";
import { getPlannerDestinations } from "@/lib/route-planner";

export default async function DestinationsPage() {
  const [destinations, hotels, activities] = await Promise.all([
    Promise.resolve(getPlannerDestinations()),
    getHotels(),
    getPlannerActivityRecords(),
  ]);

  // Exclude airport — it's not a real destination
  const realDestinations = destinations.filter((d) => d.id !== "airport");

  // Count hotels and activities per destination
  const hotelsByDest = new Map<string, number>();
  for (const h of hotels) {
    if (h.destinationId) {
      hotelsByDest.set(h.destinationId, (hotelsByDest.get(h.destinationId) ?? 0) + 1);
    }
  }

  const activitiesByDest = new Map<string, number>();
  for (const a of activities) {
    activitiesByDest.set(a.destinationId, (activitiesByDest.get(a.destinationId) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
            Destinations
          </h1>
          <p className="mt-1 text-stone-600 dark:text-stone-400">
            Manage hotels and activities by destination
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {realDestinations.map((dest) => {
          const hotelCount = hotelsByDest.get(dest.id) ?? 0;
          const activityCount = activitiesByDest.get(dest.id) ?? 0;

          return (
            <Link
              key={dest.id}
              href={`/admin/destinations/${dest.id}`}
              className="group flex flex-col justify-between rounded-[1.8rem] border border-[#ddc8b0] bg-white/74 p-5 shadow-sm backdrop-blur-sm transition hover:border-teal-300 hover:bg-white/90 hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-stone-400 transition group-hover:text-teal-600" />
                </div>
                <h2 className="mt-3 text-lg font-semibold text-stone-900 group-hover:text-teal-700 dark:text-stone-50">
                  {dest.name}
                </h2>
                <p className="mt-0.5 text-sm text-stone-500">{dest.region}</p>
              </div>

              <div className="mt-4 flex items-center gap-4 border-t border-stone-100 pt-3">
                <span className="inline-flex items-center gap-1.5 text-sm text-stone-600">
                  <Building2 className="h-4 w-4 text-stone-400" />
                  {hotelCount} {hotelCount === 1 ? "hotel" : "hotels"}
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm text-stone-600">
                  <Compass className="h-4 w-4 text-stone-400" />
                  {activityCount} {activityCount === 1 ? "activity" : "activities"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
