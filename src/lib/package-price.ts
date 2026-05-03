import type { TourPackage, PackageOption } from "./types";

function parseNights(duration: string): number {
  const m = duration.match(/(\d+)\s*[Nn]ight/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Coerce any value to a non-negative finite number. Used as a guard
 * around every price/quantity input to the cost calculations so a
 * corrupt option (NaN, undefined, negative typo, "10 USD" string) can
 * never propagate as a NaN total — at worst it shows as 0, which is
 * loud + visible rather than silently wrong.
 *
 * Negative values clamp to 0 because a negative line-item charge is
 * always a data bug — discounts are tracked separately on quotations
 * via `discountAmount`, never via negative line items.
 */
function safeNum(v: unknown, fallback = 0): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return fallback;
  return v;
}

/**
 * Coerce a count (pax, nights, capacity) to a positive integer ≥ 1.
 * Math.max(1, NaN) returns NaN, so the explicit Number.isFinite check
 * is required — any NaN/negative/zero/non-numeric falls back to 1.
 */
function safeCount(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 1) return 1;
  return Math.floor(v);
}

export function calcOptionPrice(
  opt: PackageOption,
  pax: number,
  nights: number
): number {
  const normalizedPax = safeCount(pax);
  const normalizedNights = safeCount(nights);
  const capacity = safeCount(opt.capacity);
  const price = safeNum(opt.price);

  switch (opt.priceType) {
    case "per_person":
    case "per_person_total":
      return price * normalizedPax;
    case "per_night":
      return price * normalizedNights;
    case "per_person_per_night":
      return price * normalizedPax * normalizedNights;
    case "per_day":
      return price * Math.max(1, normalizedNights + 1);
    case "per_person_per_day":
      return price * normalizedPax * Math.max(1, normalizedNights + 1);
    case "per_room_per_night":
      return (
        price * Math.ceil(normalizedPax / capacity) * normalizedNights
      );
    case "per_vehicle_per_day":
      return (
        price *
        Math.ceil(normalizedPax / capacity) *
        Math.max(1, normalizedNights + 1)
      );
    case "total":
      return price;
    default:
      return price;
  }
}

export function calcOptionCost(
  opt: PackageOption,
  pax: number,
  nights: number
): number {
  // costPrice may be undefined (option not yet linked to a supplier
  // cost) — fall back to opt.price, then through safeNum so NaN /
  // negative values never propagate as totals.
  const cost = safeNum(opt.costPrice, safeNum(opt.price));
  return calcOptionPrice(
    {
      ...opt,
      price: cost,
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
  const safePax = safeCount(pax);
  const nights = parseNights(pkg.duration);
  // Sanitise pkg.price too — a package with a corrupt price field
  // would otherwise show "From NaN USD" on the catalog page.
  let total = safeNum(pkg.price) * safePax;

  const min = (opts?: PackageOption[]) => {
    if (!opts?.length) return 0;
    const prices = opts.map((o) => calcOptionPrice(o, safePax, nights));
    // Filter the safety floor (calcOptionPrice already guards) so
    // Math.min never sees Infinity from an empty array — caller
    // already returns 0 for empty, but defensive in case future
    // change widens the input.
    return prices.length ? Math.min(...prices) : 0;
  };

  // Accommodation: per-night or legacy package-level
  const hasPerNight = pkg.itinerary?.some((d) => d.accommodationOptions?.length);
  if (hasPerNight) {
    for (let i = 0; i < nights; i++) {
      const opts = getAccommodationOptionsForNight(pkg, i);
      if (opts.length) {
        total += Math.min(
          ...opts.map((o) => calcOptionPrice(o, safePax, 1))
        );
      }
    }
  } else {
    total += min(pkg.accommodationOptions);
  }

  total += min(pkg.transportOptions);
  // Meal plans: per-night or legacy package-level
  total += min(getFlatMealPlanOptions(pkg));

  return safeNum(total);
}
