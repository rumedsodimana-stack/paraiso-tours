import type { TourPackage, PackageOption } from "./types";

function parseNights(duration: string): number {
  const m = duration.match(/(\d+)\s*[Nn]ight/);
  return m ? parseInt(m[1], 10) : 0;
}

export function calcOptionPrice(
  opt: PackageOption,
  pax: number,
  nights: number
): number {
  const normalizedPax = Math.max(1, pax);
  const normalizedNights = Math.max(1, nights);
  const capacity = Math.max(1, opt.capacity ?? 1);

  switch (opt.priceType) {
    case "per_person":
    case "per_person_total":
      return opt.price * normalizedPax;
    case "per_night":
      return opt.price * normalizedNights;
    case "per_person_per_night":
      return opt.price * normalizedPax * normalizedNights;
    case "per_day":
      return opt.price * Math.max(1, normalizedNights + 1);
    case "per_person_per_day":
      return opt.price * normalizedPax * Math.max(1, normalizedNights + 1);
    case "per_room_per_night":
      return (
        opt.price * Math.ceil(normalizedPax / capacity) * normalizedNights
      );
    case "per_vehicle_per_day":
      return (
        opt.price *
        Math.ceil(normalizedPax / capacity) *
        Math.max(1, normalizedNights + 1)
      );
    case "total":
      return opt.price;
    default:
      return opt.price;
  }
}

export function calcOptionCost(
  opt: PackageOption,
  pax: number,
  nights: number
): number {
  return calcOptionPrice(
    {
      ...opt,
      price: opt.costPrice ?? opt.price,
    },
    pax,
    nights
  );
}

/** Get accommodation options for a given night (0-based). Prefer per-night from itinerary, fallback to package-level. */
function getAccommodationOptionsForNight(pkg: TourPackage, nightIndex: number): PackageOption[] {
  const day = pkg.itinerary?.[nightIndex];
  if (day?.accommodationOptions?.length) return day.accommodationOptions;
  return pkg.accommodationOptions ?? [];
}

/**
 * Returns a flat, deduplicated list of meal plan options for a package.
 * - Legacy packages: returns pkg.mealOptions directly.
 * - New per-night packages: collects unique plan types from itinerary days,
 *   stripping hotel prefix ("Cinnamon Lodge — BB" → "BB"), using first
 *   occurrence's option as the representative (for ID + price).
 */
export function getFlatMealPlanOptions(pkg: TourPackage): PackageOption[] {
  if (pkg.mealOptions?.length) return pkg.mealOptions;
  const seen = new Map<string, PackageOption>();
  for (const day of pkg.itinerary ?? []) {
    for (const mp of day.mealPlanOptions ?? []) {
      const label = mp.label.includes(" — ")
        ? mp.label.split(" — ").slice(-1)[0]!.trim()
        : mp.label;
      if (!seen.has(label)) seen.set(label, { ...mp, label });
    }
  }
  return Array.from(seen.values());
}

export function getFromPrice(pkg: TourPackage, pax = 1): number {
  const nights = parseNights(pkg.duration);
  let total = pkg.price * pax;

  const min = (opts?: PackageOption[]) => {
    if (!opts?.length) return 0;
    return Math.min(...opts.map((o) => calcOptionPrice(o, pax, nights)));
  };

  // Accommodation: per-night or legacy package-level
  const hasPerNight = pkg.itinerary?.some((d) => d.accommodationOptions?.length);
  if (hasPerNight) {
    for (let i = 0; i < nights; i++) {
      const opts = getAccommodationOptionsForNight(pkg, i);
      if (opts.length) total += Math.min(...opts.map((o) => calcOptionPrice(o, pax, 1)));
    }
  } else {
    total += min(pkg.accommodationOptions);
  }

  total += min(pkg.transportOptions);
  // Meal plans: per-night or legacy package-level
  total += min(getFlatMealPlanOptions(pkg));

  return total;
}
