import type { HotelSupplier, PackageOption, TourPackage } from "./types";

/**
 * Strip server-only / admin-only fields from a hotel before serializing
 * to a Client Component.
 *
 * Anything passed as a prop to a Client Component ends up in the RSC
 * payload, which any guest can read with a `RSC: 1` request header. So
 * banking details, supplier contact emails, internal admin notes, and
 * capacity caps must never reach the browser.
 *
 * The return shape is still `HotelSupplier` (every redacted field is
 * optional in the source type), so existing helpers that accept
 * `HotelSupplier[]` — `getCustomJourneyTransportOptions`,
 * `getPlannerHotelsForDestination`, `resolvePackageTransportFromCatalog`
 * — keep type-checking unchanged.
 */
export function sanitizeHotelForClient(h: HotelSupplier): HotelSupplier {
  return {
    id: h.id,
    name: h.name,
    type: h.type,
    location: h.location,
    destinationId: h.destinationId,
    defaultPricePerNight: h.defaultPricePerNight,
    currency: h.currency,
    starRating: h.starRating,
    capacity: h.capacity,
    archivedAt: h.archivedAt,
    createdAt: h.createdAt,
    // OMITTED — sensitive, must not reach the browser:
    //   email, contact, notes, maxConcurrentBookings,
    //   bankName, bankBranch, accountName, accountNumber,
    //   swiftCode, bankCurrency, paymentReference
  };
}

export function sanitizeHotelsForClient(
  hotels: HotelSupplier[],
): HotelSupplier[] {
  return hotels.map(sanitizeHotelForClient);
}

/**
 * Strip the wholesale cost price from a package option. `costPrice` is
 * what we pay the supplier; `price` is what the guest pays. The two
 * coexist on every saved option so margin reporting works in admin —
 * but only `price` should be visible to guests.
 */
function sanitizeOption(opt: PackageOption): PackageOption {
  // Avoid object spread so a future field added on PackageOption
  // doesn't silently leak through this helper. Pick fields explicitly.
  return {
    id: opt.id,
    label: opt.label,
    price: opt.price,
    priceType: opt.priceType,
    supplierId: opt.supplierId,
    capacity: opt.capacity,
    isDefault: opt.isDefault,
    // OMITTED: costPrice
  };
}

function sanitizeOptions(
  opts: PackageOption[] | undefined,
): PackageOption[] | undefined {
  if (!opts) return opts;
  return opts.map(sanitizeOption);
}

/**
 * Strip admin-only fields from a tour package before serializing to a
 * Client Component. Currently this means redacting `costPrice` from
 * every per-option array (top-level `*Options` plus per-day
 * `accommodationOptions` / `mealPlanOptions` on the itinerary).
 */
export function sanitizePackageForClient(pkg: TourPackage): TourPackage {
  return {
    ...pkg,
    mealOptions: sanitizeOptions(pkg.mealOptions),
    transportOptions: sanitizeOptions(pkg.transportOptions),
    accommodationOptions: sanitizeOptions(pkg.accommodationOptions),
    customOptions: sanitizeOptions(pkg.customOptions),
    itinerary: pkg.itinerary.map((day) => ({
      ...day,
      accommodationOptions: sanitizeOptions(day.accommodationOptions),
      mealPlanOptions: sanitizeOptions(day.mealPlanOptions),
    })),
  };
}

export function sanitizePackagesForClient(
  packages: TourPackage[],
): TourPackage[] {
  return packages.map(sanitizePackageForClient);
}
