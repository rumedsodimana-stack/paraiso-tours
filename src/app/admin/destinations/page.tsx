import Link from "next/link";
import { MapPin, Building2, Compass, ChevronRight } from "lucide-react";
import { getHotels, getPlannerActivityRecords } from "@/lib/db";
import { getPlannerDestinations } from "@/lib/route-planner";

// The hotel/activity catalog mutates from /admin (admin saves a new
// hotel against Colombo, archives an old activity, etc.) and the
// destination cards must reflect the latest counts. Without
// force-dynamic Next.js caches the prebuilt page at deploy time, so
// newly-saved hotels never bump the per-destination tally until the
// next deploy.
export const dynamic = "force-dynamic";

export default async function DestinationsPage() {
  const [destinations, hotels, activities] = await Promise.all([
    Promise.resolve(getPlannerDestinations()),
    getHotels(),
    getPlannerActivityRecords(),
  ]);

  const realDestinations = destinations.filter((d) => d.id !== "airport");

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
      <div>
        <h1 className="text-2xl font-bold text-[#11272b]">Destinations</h1>
        <p className="mt-1 text-sm text-[#5e7279]">Manage hotels and activities by destination</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {realDestinations.map((dest) => {
          const hotelCount = hotelsByDest.get(dest.id) ?? 0;
          const activityCount = activitiesByDest.get(dest.id) ?? 0;

          return (
            <Link
              key={dest.id}
              href={`/admin/destinations/${dest.id}`}
              className="paraiso-card group flex flex-col justify-between rounded-2xl p-5 transition hover:bg-[#f4ecdd]"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#12343b] text-[#f6ead6]">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-[#8a9ba1] transition group-hover:text-[#12343b]" />
                </div>
                <h2 className="mt-3 text-base font-semibold text-[#11272b]">{dest.name}</h2>
                <p className="mt-0.5 text-sm text-[#8a9ba1]">{dest.region}</p>
              </div>

              <div className="mt-4 flex items-center gap-4 border-t border-[#e0e4dd] pt-3">
                <span className="inline-flex items-center gap-1.5 text-sm text-[#5e7279]">
                  <Building2 className="h-4 w-4 text-[#8a9ba1]" />
                  {hotelCount} {hotelCount === 1 ? "hotel" : "hotels"}
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm text-[#5e7279]">
                  <Compass className="h-4 w-4 text-[#8a9ba1]" />
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
