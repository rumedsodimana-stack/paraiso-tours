import { getBookingBreakdownBySupplier } from "./booking-breakdown";
import { calcOptionPrice } from "./package-price";
import type { HotelSupplier, Lead, PackageOption, TourPackage } from "./types";

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
}): { totalPrice: number; nights: number; errors: string[] } {
  const {
    pkg,
    selectedAccommodationOptionId,
    selectedTransportOptionId,
    selectedMealOptionId,
  } = input;
  const pax = Math.max(1, input.pax || 1);
  const nights = parsePackageNights(pkg.duration) || 1;
  const normalizedByNight = normalizeSelectedAccommodationByNight(
    input.selectedAccommodationByNight
  );
  const errors: string[] = [];

  let total = pkg.price * pax;

  const transportOptions = pkg.transportOptions ?? [];
  const mealOptions = pkg.mealOptions ?? [];
  const accommodationOptions = pkg.accommodationOptions ?? [];
  const nightSlots = getAccommodationNightSlots(pkg);

  if (nightSlots.length > 0) {
    for (const slot of nightSlots) {
      const selectedId = normalizedByNight?.[String(slot.nightIndex)];
      const selected = slot.options.find((option) => option.id === selectedId);
      if (!selected) {
        errors.push(`Select accommodation for night ${slot.nightIndex + 1}`);
        continue;
      }
      total += calcOptionPrice(selected, pax, 1);
    }
  } else if (accommodationOptions.length > 0) {
    const selected = accommodationOptions.find(
      (option) => option.id === selectedAccommodationOptionId
    );
    if (!selected) {
      errors.push("Select accommodation");
    } else {
      total += calcOptionPrice(selected, pax, nights);
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

  if (mealOptions.length > 0) {
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
  const storedTotal =
    selectionsMatchPackage &&
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
