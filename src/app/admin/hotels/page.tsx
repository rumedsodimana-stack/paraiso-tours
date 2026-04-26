import Link from "next/link";
import { Building2, ChevronRight, MapPin, Plus, Star } from "lucide-react";
import { getHotels } from "@/lib/db";
import { SaveSuccessBanner } from "../SaveSuccessBanner";

export const dynamic = "force-dynamic";

export default async function HotelsPage({
  searchParams,
}: {
  searchParams?: Promise<{ archived?: string; deleted?: string; cleaned?: string }>;
}) {
  const { archived, deleted, cleaned } = searchParams ? await searchParams : {};
  const allHotels = await getHotels();
  // Hotel-only view. Vehicles live on /admin/transportation, meal
  // suppliers on /admin/hotels/[id] meal-plan editor, generic suppliers
  // are catalog rows used by package custom options. This page intentionally
  // limits itself to type === "hotel" so the list matches the page name.
  const hotels = allHotels.filter((h) => h.type === "hotel" && !h.archivedAt);

  const cleanedCount = cleaned ? Number(cleaned) : 0;
  const archivedMessage =
    cleanedCount > 0
      ? `Archived. Cleaned references in ${cleanedCount} package${cleanedCount === 1 ? "" : "s"}.`
      : "Archived successfully";

  return (
    <div className="space-y-6">
      {(archived === "1" || deleted === "1") && <SaveSuccessBanner message={archivedMessage} />}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#11272b]">Hotels</h1>
          <p className="mt-1 text-sm text-[#5e7279]">
            Hotel contracts, room rates, and meal plans
          </p>
        </div>
        <Link
          href="/admin/hotels/new?type=hotel"
          className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-4 py-2.5 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
        >
          <Plus className="h-4 w-4" />
          Add Hotel
        </Link>
      </div>

      {hotels.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#ddd3c4] bg-[#faf6ef] py-16">
          <Building2 className="h-10 w-10 text-[#8a9ba1]" />
          <p className="mt-4 text-[#5e7279]">
            No hotels yet. Add your first hotel to use in packages and journeys.
          </p>
          <Link
            href="/admin/hotels/new?type=hotel"
            className="mt-4 font-medium text-[#12343b] hover:underline"
          >
            Add Hotel
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hotels.map((h) => (
            <Link
              key={h.id}
              href={`/admin/hotels/${h.id}`}
              className="paraiso-card group flex items-start justify-between gap-3 rounded-2xl p-4 transition hover:bg-[#f4ecdd]"
            >
              <div className="flex gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef4f4] text-[#12343b]">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[#11272b] truncate">{h.name}</p>
                  {h.location && (
                    <p className="mt-0.5 text-sm text-[#5e7279] truncate">
                      <MapPin className="mr-1 inline h-3 w-3 text-[#8a9ba1]" />
                      {h.location}
                    </p>
                  )}
                  {h.starRating != null && h.starRating > 0 && (
                    <p className="mt-0.5 inline-flex items-center gap-0.5 text-xs text-[#7a5a17]">
                      {Array.from({ length: Math.round(h.starRating) }).map(
                        (_, i) => (
                          <Star
                            key={i}
                            className="h-3 w-3 fill-current"
                          />
                        ),
                      )}
                    </p>
                  )}
                  {h.defaultPricePerNight != null && (
                    <p className="mt-1 text-sm font-semibold text-[#12343b]">
                      {h.defaultPricePerNight.toLocaleString()} {h.currency}
                      <span className="font-normal text-[#8a9ba1]">/night</span>
                    </p>
                  )}
                </div>
              </div>
              <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-[#8a9ba1] transition group-hover:text-[#12343b]" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
