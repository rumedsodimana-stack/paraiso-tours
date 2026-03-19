import Link from "next/link";
import { MapPin, Car, Building2, UtensilsCrossed, ChevronRight } from "lucide-react";
import { getHotels } from "@/lib/db";
import { SaveSuccessBanner } from "../SaveSuccessBanner";

const typeIcons = { hotel: Building2, transport: Car, meal: UtensilsCrossed, supplier: MapPin };
const typeLabels = { hotel: "Hotel", transport: "Transport", meal: "Meal Provider", supplier: "Supplier" };

export default async function HotelsPage({
  searchParams,
}: {
  searchParams?: Promise<{ archived?: string; deleted?: string }>;
}) {
  const { archived, deleted } = searchParams ? await searchParams : {};
  const hotels = await getHotels();

  return (
    <div className="space-y-6">
      {archived === "1" || deleted === "1" ? (
        <SaveSuccessBanner message="Archived successfully" />
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
            Hotels & Suppliers
          </h1>
          <p className="mt-1 text-stone-600 dark:text-stone-400">
            Manage hotel contracts and supplier agreements
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/hotels/new?type=hotel"
            className="inline-flex items-center gap-2 rounded-xl border border-teal-600 bg-white px-4 py-2.5 text-sm font-medium text-teal-600 transition hover:bg-teal-50 dark:bg-stone-900 dark:border-teal-500 dark:text-teal-400 dark:hover:bg-teal-950"
          >
            <Building2 className="h-4 w-4" />
            Add Hotel
          </Link>
          <Link
            href="/admin/hotels/new?type=transport"
            className="inline-flex items-center gap-2 rounded-xl border border-teal-600 bg-white px-4 py-2.5 text-sm font-medium text-teal-600 transition hover:bg-teal-50 dark:bg-stone-900 dark:border-teal-500 dark:text-teal-400 dark:hover:bg-teal-950"
          >
            <Car className="h-4 w-4" />
            Add Vehicle
          </Link>
          <Link
            href="/admin/hotels/new?type=meal"
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
          >
            <UtensilsCrossed className="h-4 w-4" />
            Add Meal Provider
          </Link>
          <Link
            href="/admin/hotels/new?type=supplier"
            className="inline-flex items-center gap-2 rounded-xl border border-teal-600 bg-white px-4 py-2.5 text-sm font-medium text-teal-600 transition hover:bg-teal-50 dark:bg-stone-900 dark:border-teal-500 dark:text-teal-400 dark:hover:bg-teal-950"
          >
            <MapPin className="h-4 w-4" />
            Add Supplier
          </Link>
        </div>
      </div>

      {hotels.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/40 bg-white/30 py-16 backdrop-blur-xl">
          <MapPin className="h-12 w-12 text-stone-400" />
          <p className="mt-4 text-stone-600 dark:text-stone-400">
            No hotels or suppliers yet. Add your first one to use in packages.
          </p>
          <Link
            href="/admin/hotels/new"
            className="mt-4 font-medium text-teal-600 hover:text-teal-700"
          >
            Add Hotel / Supplier
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {(["hotel", "transport", "meal", "supplier"] as const).map((type) => {
            const items = hotels.filter((h) => h.type === type);
            if (items.length === 0) return null;
            const Icon = typeIcons[type];
            const sectionTitle =
              type === "hotel"
                ? "Hotels"
                : type === "transport"
                  ? "Transportation"
                  : type === "meal"
                    ? "Meal Providers"
                    : "Suppliers";
            return (
              <section key={type}>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-stone-800 dark:text-stone-100">
                  <Icon className="h-5 w-5" />
                  {sectionTitle}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((h) => {
                    const Icon = typeIcons[h.type];
                    return (
                      <Link
                        key={h.id}
                        href={`/admin/hotels/${h.id}`}
                        className="group flex items-start justify-between rounded-xl border border-white/30 bg-white/50 p-4 shadow-sm backdrop-blur-sm transition hover:border-teal-200 hover:bg-white/70"
                      >
                        <div className="flex gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium text-stone-900 dark:text-stone-50 group-hover:text-teal-700">
                              {h.name}
                            </p>
                            <p className="text-xs text-stone-500">{typeLabels[h.type]}</p>
                            {h.location && (
                              <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-400">
                                {h.location}
                              </p>
                            )}
                            {h.defaultPricePerNight != null && (
                              <p className="mt-1 text-sm font-medium text-teal-600">
                                {h.defaultPricePerNight.toLocaleString()} {h.currency}
                                {type === "hotel"
                                  ? "/night"
                                  : type === "meal"
                                    ? "/person"
                                    : " (default)"}
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-stone-400 transition group-hover:text-teal-600" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
