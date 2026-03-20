import { calcOptionPrice } from "./package-price";
import { plannerTransportProfiles } from "./route-planner";
import type { HotelSupplier, PriceType, TourPackage } from "./types";

export const DEFAULT_CUSTOM_JOURNEY_GUIDANCE_FEE = 150;
export const DEFAULT_CUSTOM_JOURNEY_GUIDANCE_LABEL =
  "Route design & local guidance";

type OptionSource = "supplier" | "package_library" | "planner_fallback";

export interface CustomJourneyOption {
  id: string;
  label: string;
  description: string;
  price: number;
  priceType: PriceType;
  currency: string;
  capacity?: number;
  source: OptionSource;
  supplierId?: string;
}

export interface CustomJourneyHotelLike {
  id: string;
  name: string;
  pricePerNight: number;
  currency: string;
}

export interface CustomJourneyPricingInput {
  pax: number;
  routeStops: Array<{
    nights: number;
    hotel?: CustomJourneyHotelLike | null;
  }>;
  transportOption?: CustomJourneyOption | null;
  mealOption?: CustomJourneyOption | null;
  guidanceFee?: number;
  guidanceLabel?: string;
}

export interface CustomJourneyPricingSummary {
  currency: string;
  rooms: number;
  totalNights: number;
  totalDays: number;
  guidanceFee: number;
  hotelTotal: number;
  transportTotal: number;
  mealTotal: number;
  total: number;
  lineItems: Array<{
    id: string;
    label: string;
    amount: number;
  }>;
}

const optionSourcePriority: Record<OptionSource, number> = {
  supplier: 3,
  package_library: 2,
  planner_fallback: 1,
};

function normalizeLabel(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function guessTransportCapacity(label: string) {
  const normalized = normalizeLabel(label);
  if (
    normalized.includes("coach") ||
    normalized.includes("bus") ||
    normalized.includes("mini bus")
  ) {
    return 18;
  }
  if (normalized.includes("van")) {
    return 6;
  }
  if (normalized.includes("suv") || normalized.includes("jeep")) {
    return 4;
  }
  return 3;
}

function collectPackageOptions(
  packages: TourPackage[],
  optionType: "transport" | "meal"
) {
  return packages.flatMap((pkg) => {
    const options =
      optionType === "transport"
        ? pkg.transportOptions ?? []
        : pkg.mealOptions ?? [];

    return options.map((option) => ({
      option,
      currency: pkg.currency,
      packageName: pkg.name,
    }));
  });
}

function dedupeOptions(options: CustomJourneyOption[]) {
  const byLabel = new Map<string, CustomJourneyOption>();

  for (const option of options) {
    const key = normalizeLabel(option.label);
    const existing = byLabel.get(key);

    if (!existing) {
      byLabel.set(key, option);
      continue;
    }

    if (optionSourcePriority[option.source] > optionSourcePriority[existing.source]) {
      byLabel.set(key, option);
      continue;
    }

    if (
      optionSourcePriority[option.source] === optionSourcePriority[existing.source] &&
      option.price > 0 &&
      (existing.price === 0 || option.price < existing.price)
    ) {
      byLabel.set(key, option);
    }
  }

  return Array.from(byLabel.values()).sort((a, b) => a.price - b.price);
}

export function getCustomJourneyTransportOptions(
  hotels: HotelSupplier[],
  packages: TourPackage[],
  fallbackCurrency = "USD"
) {
  const supplierOptions: CustomJourneyOption[] = hotels
    .filter((supplier) => supplier.type === "transport")
    .map((supplier) => ({
      id: supplier.id,
      label: supplier.name,
      description: supplier.location
        ? `${supplier.location} transport supplier`
        : "From your transport supplier list",
      price: supplier.defaultPricePerNight ?? 0,
      priceType: "per_vehicle_per_day",
      currency: supplier.currency || fallbackCurrency,
      capacity: guessTransportCapacity(supplier.name),
      source: "supplier",
      supplierId: supplier.id,
    }));

  const packageOptions: CustomJourneyOption[] = collectPackageOptions(
    packages,
    "transport"
  ).map(({ option, currency, packageName }) => ({
    id: option.id,
    label: option.label,
    description: `Used in published package pricing (${packageName})`,
    price: option.price,
    priceType: option.priceType,
    currency,
    capacity: option.capacity,
    source: "package_library",
    supplierId: option.supplierId,
  }));

  const deduped = dedupeOptions([...supplierOptions, ...packageOptions]);
  if (deduped.length > 0) {
    return deduped;
  }

  return plannerTransportProfiles.map((profile) => ({
    id: profile.id,
    label: profile.label,
    description: profile.summary,
    price: profile.ratePerDay,
    priceType: "per_vehicle_per_day" as const,
    currency: fallbackCurrency,
    capacity: guessTransportCapacity(profile.label),
    source: "planner_fallback" as const,
  }));
}

export function getCustomJourneyMealOptions(
  hotels: HotelSupplier[],
  packages: TourPackage[],
  fallbackCurrency = "USD"
) {
  const supplierOptions: CustomJourneyOption[] = hotels
    .filter((supplier) => supplier.type === "meal")
    .map((supplier) => ({
      id: supplier.id,
      label: supplier.name,
      description: supplier.location
        ? `${supplier.location} meal provider`
        : "From your meal supplier list",
      price: supplier.defaultPricePerNight ?? 0,
      priceType: "per_person_per_day",
      currency: supplier.currency || fallbackCurrency,
      source: "supplier",
      supplierId: supplier.id,
    }));

  const packageOptions: CustomJourneyOption[] = collectPackageOptions(
    packages,
    "meal"
  ).map(({ option, currency, packageName }) => ({
    id: option.id,
    label: option.label,
    description: `Used in published package pricing (${packageName})`,
    price: option.price,
    priceType: option.priceType,
    currency,
    capacity: option.capacity,
    source: "package_library",
    supplierId: option.supplierId,
  }));

  const deduped = dedupeOptions([...supplierOptions, ...packageOptions]);
  if (deduped.length > 0) {
    return deduped;
  }

  return [
    {
      id: "meal_breakfast",
      label: "Breakfast",
      description: "Simple breakfast plan for each travel day",
      price: 10,
      priceType: "per_person_per_day" as const,
      currency: fallbackCurrency,
      source: "planner_fallback" as const,
    },
    {
      id: "meal_half_board",
      label: "Half board",
      description: "Breakfast and dinner for each travel day",
      price: 24,
      priceType: "per_person_per_day" as const,
      currency: fallbackCurrency,
      source: "planner_fallback" as const,
    },
    {
      id: "meal_full_board",
      label: "Full board",
      description: "Breakfast, lunch, and dinner for each travel day",
      price: 36,
      priceType: "per_person_per_day" as const,
      currency: fallbackCurrency,
      source: "planner_fallback" as const,
    },
  ];
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getRoomsForPax(pax: number) {
  return Math.max(1, Math.ceil(Math.max(1, pax) / 2));
}

export function calculateCustomJourneyPricing(
  input: CustomJourneyPricingInput
): CustomJourneyPricingSummary {
  const pax = Math.max(1, input.pax || 1);
  const rooms = getRoomsForPax(pax);
  const totalNights = input.routeStops.reduce(
    (sum, stop) => sum + Math.max(1, stop.nights || 1),
    0
  );
  const totalDays = Math.max(1, totalNights + (input.routeStops.length > 0 ? 1 : 0));
  const currency =
    input.routeStops.find((stop) => stop.hotel?.currency)?.hotel?.currency ||
    input.transportOption?.currency ||
    input.mealOption?.currency ||
    "USD";

  const hotelTotal = roundCurrency(
    input.routeStops.reduce((sum, stop) => {
      if (!stop.hotel) return sum;
      return sum + stop.hotel.pricePerNight * Math.max(1, stop.nights) * rooms;
    }, 0)
  );

  const transportTotal = input.transportOption
    ? roundCurrency(calcOptionPrice(input.transportOption, pax, totalNights))
    : 0;

  const mealTotal = input.mealOption
    ? roundCurrency(calcOptionPrice(input.mealOption, pax, totalNights))
    : 0;

  const guidanceFee = roundCurrency(
    input.guidanceFee ?? DEFAULT_CUSTOM_JOURNEY_GUIDANCE_FEE
  );
  const guidanceLabel =
    input.guidanceLabel ?? DEFAULT_CUSTOM_JOURNEY_GUIDANCE_LABEL;

  const total = roundCurrency(
    guidanceFee + hotelTotal + transportTotal + mealTotal
  );

  return {
    currency,
    rooms,
    totalNights,
    totalDays,
    guidanceFee,
    hotelTotal,
    transportTotal,
    mealTotal,
    total,
    lineItems: [
      {
        id: "journey_guidance",
        label: guidanceLabel,
        amount: guidanceFee,
      },
      {
        id: "journey_hotels",
        label: `Accommodation (${rooms} room${rooms === 1 ? "" : "s"})`,
        amount: hotelTotal,
      },
      {
        id: "journey_transport",
        label: input.transportOption
          ? `Transport: ${input.transportOption.label}`
          : "Transport: none",
        amount: transportTotal,
      },
      {
        id: "journey_meals",
        label: input.mealOption
          ? `Meals: ${input.mealOption.label}`
          : "Meals: none",
        amount: mealTotal,
      },
    ],
  };
}
