import Link from "next/link";
import { MapPin, Car, Building2, UtensilsCrossed, ChevronRight } from "lucide-react";
import { getHotels } from "@/lib/db";
import { SaveSuccessBanner } from "../SaveSuccessBanner";

const typeIcons = { hotel: Building2, transport: Car, meal: UtensilsCrossed, supplier: MapPin };
const typeLabels = { hotel: "Hotel", transport: "Transport", meal: "Meal Provider", supplier: "Supplier" };

const SEC_BTN = "inline-flex items-center gap-2 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3.5 py-2.5 text-sm font-medium text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]";

export default async function HotelsPage({
  searchParams,
}: {
  searchParams?: Promise<{ archived?: string; deleted?: string }>;
}) {
  const { archived, deleted } = searchParams ? await searchParams : {};
  const hotels = await getHotels();

  return (
    <div className="space-y-6">
      {(archived === "1" || deleted === "1") && <SaveSuccessBanner message="Archived successfully" />}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#11272b]">Hotels &amp; Suppliers</h1>
          <p className="mt-1 text-sm text-[#5e7279]">Manage hotel contracts and supplier agreements</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/hotels/new?type=hotel"      className={SEC_BTN}><Building2    className="h-4 w-4" />Add Hotel</Link>
          <Link href="/admin/hotels/new?type=transport"  className={SEC_BTN}><Car          className="h-4 w-4" />Add Vehicle</Link>
          <Link href="/admin/hotels/new?type=meal"       className={SEC_BTN}><UtensilsCrossed className="h-4 w-4" />Add Meal Provider</Link>
          <Link href="/admin/hotels/new?type=supplier"   className={SEC_BTN}><MapPin       className="h-4 w-4" />Add Supplier</Link>
        </div>
      </div>

      {hotels.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#ddd3c4] bg-[#faf6ef] py-16">
          <MapPin className="h-10 w-10 text-[#8a9ba1]" />
          <p className="mt-4 text-[#5e7279]">No hotels or suppliers yet. Add your first one to use in packages.</p>
          <Link href="/admin/hotels/new" className="mt-4 font-medium text-[#12343b] hover:underline">
            Add Hotel / Supplier
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {(["hotel", "transport", "meal", "supplier"] as const).map((type) => {
            const items = hotels.filter((h) => h.type === type);
            if (items.length === 0) return null;
            const SectionIcon = typeIcons[type];
            const sectionTitle =
              type === "hotel" ? "Hotels"
              : type === "transport" ? "Transportation"
              : type === "meal" ? "Meal Providers"
              : "Suppliers";
            return (
              <section key={type}>
                <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-[#11272b]">
                  <SectionIcon className="h-4 w-4 text-[#8a9ba1]" />
                  {sectionTitle}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((h) => {
                    const ItemIcon = typeIcons[h.type];
                    return (
                      <Link
                        key={h.id}
                        href={`/admin/hotels/${h.id}`}
                        className="paraiso-card group flex items-start justify-between rounded-2xl p-4 transition hover:bg-[#f4ecdd]"
                      >
                        <div className="flex gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef4f4] text-[#12343b]">
                            <ItemIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium text-[#11272b]">{h.name}</p>
                            <p className="text-xs text-[#8a9ba1]">{typeLabels[h.type]}</p>
                            {h.location && (
                              <p className="mt-0.5 text-sm text-[#5e7279]">{h.location}</p>
                            )}
                            {h.defaultPricePerNight != null && (
                              <p className="mt-1 text-sm font-semibold text-[#12343b]">
                                {h.defaultPricePerNight.toLocaleString()} {h.currency}
                                {type === "hotel" ? "/night" : type === "meal" ? "/person" : " (default)"}
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-[#8a9ba1] transition group-hover:text-[#12343b]" />
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
