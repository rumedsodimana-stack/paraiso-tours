import type { HotelSupplier, PackageOption, TourPackage } from "./types";

/**
 * Resolve the transport options a guest sees in the package booking flow,
 * pulling LIVE data from the vehicle catalog (`hotels` rows where
 * `type === "transport"`) instead of the frozen snapshot stored on the
 * package row (`pkg.transportOptions`).
 *
 * Why a runtime resolve and not the frozen snapshot:
 *
 * Historically the admin curated transport options inside `PackageForm`
 * Step 2 by clicking vehicles from the catalog — those clicks COPIED
 * supplier name + `defaultPricePerNight` + capacity into a `PackageOption`
 * stored on the package row. Once saved, the package owned a frozen copy.
 * Subsequent edits to the catalog (price changes, capacity changes,
 * archives, new vehicles added) never propagated into existing packages,
 * so guests saw stale data. The journey builder always pulled fresh from
 * the catalog; the package booking flow did not. This helper closes that
 * gap.
 *
 * Resolution rules:
 * 1. If the package has curated entries with a `supplierId`, treat that as
 *    the admin's allow-list and refresh label/price/capacity from the live
 *    catalog. Curated entries whose supplier was archived or deleted are
 *    silently dropped.
 * 2. Curated entries without a `supplierId` (admin typed a custom vehicle
 *    by hand) are kept untouched.
 * 3. If after step 1 + 2 the resulting list is empty (no curation, or
 *    every curated supplier was archived) we fall back to the entire live
 *    catalog so the booking flow still has options to render.
 *
 * The original `id` of curated entries is preserved so already-saved leads
 * (`lead.selectedTransportOptionId`) keep resolving against
 * `pkg.transportOptions.find(o => o.id === ...)` in admin views.
 */
export function resolvePackageTransportFromCatalog(
  pkg: TourPackage,
  hotels: HotelSupplier[],
): PackageOption[] {
  const liveCatalog = hotels.filter(
    (h) => h.type === "transport" && !h.archivedAt,
  );
  const liveById = new Map(liveCatalog.map((s) => [s.id, s]));

  const curated = pkg.transportOptions ?? [];

  // Hand-typed (no supplierId) entries: leave untouched.
  const customEntries = curated.filter((o) => !o.supplierId);

  // Curated entries that reference a supplier id: refresh from catalog.
  const refreshedCurated: PackageOption[] = [];
  for (const opt of curated) {
    if (!opt.supplierId) continue;
    const live = liveById.get(opt.supplierId);
    if (!live) continue; // supplier archived/deleted — drop the option
    refreshedCurated.push({
      id: opt.id, // preserve id so saved-lead refs keep resolving
      label: live.name, // live name
      price: live.defaultPricePerNight ?? opt.price, // live price
      priceType: opt.priceType, // keep priceType (per_day / per_vehicle_per_day / etc.)
      costPrice: opt.costPrice, // preserve admin-set cost
      capacity: live.capacity ?? opt.capacity, // live capacity
      supplierId: live.id,
      isDefault: opt.isDefault,
    });
  }

  const merged = [...refreshedCurated, ...customEntries];
  if (merged.length > 0) {
    if (!merged.some((o) => o.isDefault)) merged[0].isDefault = true;
    return merged;
  }

  // No curation (or every curated supplier was archived/removed) —
  // surface the live catalog directly so guests aren't stuck.
  if (liveCatalog.length === 0) return [];
  const fallback = liveCatalog.map<PackageOption>((s) => ({
    id: `catalog_${s.id}`,
    label: s.name,
    price: s.defaultPricePerNight ?? 0,
    priceType: "per_vehicle_per_day",
    capacity: s.capacity,
    supplierId: s.id,
  }));
  fallback[0].isDefault = true;
  return fallback;
}
