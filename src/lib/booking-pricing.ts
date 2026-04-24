import { getBookingBreakdownBySupplier } from "./booking-breakdown";
import { calcOptionPrice, getFlatMealPlanOptions } from "./package-price";
import type {
  HotelMealPlan,
  HotelSupplier,
  Lead,
  PackageOption,
  TourPackage,
} from "./types";

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parsePackageNights(duration: string): number {
  const match = duration.match(/(\d+)\s*[Nn]ight/);
  return match ? parseInt(match[1], 10) : 0;
}

function getAccommodationOptionsForNight(
  pkg: TourPackage,
  nightIndex: number
): PackageOption[] {
  const day = pkg.itinerary?.[nightIndex];
  if (day?.accommodationOptions?.length) return day.accommodationOptions;
  return pkg.accommodationOptions ?? [];
}

function getAccommodationNightSlots(pkg: TourPackage): {
  nightIndex: number;
  options: PackageOption[];
}[] {
  const nights = parsePackageNights(pkg.duration) || 1;
  const packageLevel = pkg.accommodationOptions ?? [];
  const slots: { nightIndex: number; options: PackageOption[] }[] = [];

  let fallbackOptions =
    getAccommodationOptionsForNight(pkg, 0).length > 0
      ? getAccommodationOptionsForNight(pkg, 0)
      : packageLevel;

  if (fallbackOptions.length === 0) {
    const firstWithOptions = pkg.itinerary?.find(
      (day) => day.accommodationOptions?.length
    );
    if (firstWithOptions?.accommodationOptions?.length) {
      fallbackOptions = firstWithOptions.accommodationOptions;
    }
  }

  for (let nightIndex = 0; nightIndex < nights; nightIndex++) {
    let options = getAccommodationOptionsForNight(pkg, nightIndex);
    if (options.length === 0) options = fallbackOptions;
    if (options.length > 0) slots.push({ nightIndex, options });
  }

  return slots;
}

export function normalizeSelectedAccommodationByNight(
  raw?: Record<string, string>
): Record<string, string> | undefined {
  if (!raw) return undefined;

  const normalizedEntries = Object.entries(raw)
    .map(([key, value]) => [String(Number.parseInt(key, 10)), value?.trim()] as const)
    .filter(([key, value]) => key !== "NaN" && value);

  if (normalizedEntries.length === 0) return undefined;
  return Object.fromEntries(normalizedEntries);
}

export function calculateBookingSelectionsTotal(input: {
  pkg: TourPackage;
  pax: number;
  selectedAccommodationOptionId?: string;
  selectedAccommodationByNight?: Record<string, string>;
  selectedTransportOptionId?: string;
  selectedMealOptionId?: string;
  /** Hotel-attached meal plan ids keyed by night index (as string).
   *  When supplied, these are the meal plans picked inline with each
   *  room choice and are charged per person per night against that
   *  hotel's rate — NOT against the package-level `mealOptions`. */
  selectedMealPlanByNight?: Record<string, string>;
  /** Full hotel meal plan catalog. Callers that need accurate pricing
   *  for hotel-attached plans pass this in (e.g. server actions);
   *  legacy call sites that don't set meal plans per-night can omit it. */
  hotelMealPlans?: HotelMealPlan[];
}): { totalPrice: number; nights: number; errors: string[] } {
  const {
    pkg,
    selectedAccommodationOptionId,
    selectedTransportOptionId,
    selectedMealOptionId,
    selectedMealPlanByNight,
    hotelMealPlans = [],
  } = input;
  const pax = Math.max(1, input.pax || 1);
  const nights = parsePackageNights(pkg.duration) || 1;
  const normalizedByNight = normalizeSelectedAccommodationByNight(
    input.selectedAccommodationByNight
  );
  const errors: string[] = [];

  let total = pkg.price * pax;

  const transportOptions = pkg.transportOptions ?? [];
  // Use per-night mealPlanOptions when pkg.mealOptions is empty (new per-night packages)
  const mealOptions = getFlatMealPlanOptions(pkg);
  const accommodationOptions = pkg.accommodationOptions ?? [];
  const nightSlots = getAccommodationNightSlots(pkg);

  // Did the guest pick any hotel-attached meal plan? If so, the legacy
  // package-level meal-plan step is bypassed on the client and shouldn't
  // be required here either.
  const hasHotelMealPlanSelections =
    !!selectedMealPlanByNight &&
    Object.values(selectedMealPlanByNight).some((v) => !!v);

  // Quick lookup for hotel meal plans by id.
  const hotelPlanById = new Map<string, HotelMealPlan>(
    hotelMealPlans.map((mp) => [mp.id, mp])
  );

  if (nightSlots.length > 0) {
    for (const slot of nightSlots) {
      const selectedId = normalizedByNight?.[String(slot.nightIndex)];
      const selected = slot.options.find((option) => option.id === selectedId);
      if (!selected) {
        errors.push(`Select accommodation for night ${slot.nightIndex + 1}`);
        continue;
      }
      total += calcOptionPrice(selected, pax, 1);

      // Add the night's hotel meal plan (if any). It's priced per person
      // per night, so one night's charge = pricePerPerson * pax.
      const mpId = selectedMealPlanByNight?.[String(slot.nightIndex)];
      if (mpId) {
        const mp = hotelPlanById.get(mpId);
        if (mp && mp.hotelId === selected.supplierId) {
          total += mp.pricePerPerson * pax;
        }
      }
    }
  } else if (accommodationOptions.length > 0) {
    const selected = accommodationOptions.find(
      (option) => option.id === selectedAccommodationOptionId
    );
    if (!selected) {
      errors.push("Select accommodation");
    } else {
      total += calcOptionPrice(selected, pax, nights);
      // Legacy single-accommodation packages reuse night index 0 for the
      // meal-plan selection (one plan for the whole stay).
      const mpId = selectedMealPlanByNight?.["0"];
      if (mpId) {
        const mp = hotelPlanById.get(mpId);
        if (mp && mp.hotelId === selected.supplierId) {
          total += mp.pricePerPerson * pax * nights;
        }
      }
    }
  }

  if (transportOptions.length > 0) {
    const selected = transportOptions.find(
      (option) => option.id === selectedTransportOptionId
    );
    if (!selected) {
      errors.push("Select transportation");
    } else {
      total += calcOptionPrice(selected, pax, nights);
    }
  }

  // Package-level meal options are ONLY enforced when no hotel plan was
  // picked — otherwise the guest has already chosen their meals with
  // their room and we don't double-charge.
  if (mealOptions.length > 0 && !hasHotelMealPlanSelections) {
    const selected = mealOptions.find(
      (option) => option.id === selectedMealOptionId
    );
    if (!selected) {
      errors.push("Select a meal plan");
    } else {
      total += calcOptionPrice(selected, pax, nights);
    }
  }

  return {
    totalPrice: roundCurrency(total),
    nights,
    errors,
  };
}

export function getLeadBookingFinancials(
  lead: Lead,
  pkg: TourPackage,
  suppliers: HotelSupplier[]
): {
  breakdown: ReturnType<typeof getBookingBreakdownBySupplier>;
  totalPrice: number;
  adjustmentAmount: number;
} {
  const selectionsMatchPackage = lead.packageId === pkg.id;
  const breakdown = selectionsMatchPackage
    ? getBookingBreakdownBySupplier(lead, pkg, suppliers)
    : null;
  const fallbackTotal = pkg.price * Math.max(1, lead.pax ?? 1);
  const canUseStoredTotal =
    selectionsMatchPackage ||
    (!!lead.packageSnapshot && lead.packageSnapshot.packageId === pkg.id) ||
    (!lead.packageId && !!lead.packageSnapshot);
  const storedTotal =
    canUseStoredTotal &&
    typeof lead.totalPrice === "number" &&
    Number.isFinite(lead.totalPrice)
      ? roundCurrency(lead.totalPrice)
      : undefined;
  const recomputedTotal =
    breakdown && Number.isFinite(breakdown.totalAmount)
      ? roundCurrency(breakdown.totalAmount)
      : undefined;
  const totalPrice = storedTotal ?? recomputedTotal ?? roundCurrency(fallbackTotal);
  const adjustmentAmount =
    recomputedTotal == null ? 0 : roundCurrency(totalPrice - recomputedTotal);

  return {
    breakdown,
    totalPrice,
    adjustmentAmount,
  };
}
