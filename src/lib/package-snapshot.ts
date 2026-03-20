import type { Lead, PackageSnapshot, Tour, TourPackage } from "./types";

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createPackageSnapshot(input: {
  pkg: TourPackage;
  selectedAccommodationOptionId?: string;
  selectedAccommodationByNight?: Record<string, string>;
  selectedTransportOptionId?: string;
  selectedMealOptionId?: string;
  totalPrice?: number;
}): PackageSnapshot {
  const { pkg } = input;

  return {
    packageId: pkg.id,
    name: pkg.name,
    duration: pkg.duration,
    destination: pkg.destination,
    price: pkg.price,
    currency: pkg.currency,
    description: pkg.description,
    itinerary: cloneValue(pkg.itinerary ?? []),
    inclusions: cloneValue(pkg.inclusions ?? []),
    exclusions: cloneValue(pkg.exclusions ?? []),
    region: pkg.region,
    imageUrl: pkg.imageUrl,
    cancellationPolicy: pkg.cancellationPolicy,
    mealOptions: cloneValue(pkg.mealOptions ?? []),
    transportOptions: cloneValue(pkg.transportOptions ?? []),
    accommodationOptions: cloneValue(pkg.accommodationOptions ?? []),
    customOptions: cloneValue(pkg.customOptions ?? []),
    selectedAccommodationOptionId: input.selectedAccommodationOptionId,
    selectedAccommodationByNight: input.selectedAccommodationByNight
      ? cloneValue(input.selectedAccommodationByNight)
      : undefined,
    selectedTransportOptionId: input.selectedTransportOptionId,
    selectedMealOptionId: input.selectedMealOptionId,
    totalPrice: input.totalPrice,
    capturedAt: new Date().toISOString(),
  };
}

export function createPackageSnapshotFromLead(
  lead: Pick<
    Lead,
    | "selectedAccommodationOptionId"
    | "selectedAccommodationByNight"
    | "selectedTransportOptionId"
    | "selectedMealOptionId"
    | "totalPrice"
  >,
  pkg: TourPackage
): PackageSnapshot {
  return createPackageSnapshot({
    pkg,
    selectedAccommodationOptionId: lead.selectedAccommodationOptionId,
    selectedAccommodationByNight: lead.selectedAccommodationByNight,
    selectedTransportOptionId: lead.selectedTransportOptionId,
    selectedMealOptionId: lead.selectedMealOptionId,
    totalPrice: lead.totalPrice,
  });
}

export function packageFromSnapshot(
  snapshot?: PackageSnapshot | null
): TourPackage | null {
  if (!snapshot) return null;

  return {
    id: snapshot.packageId ?? `snapshot_${snapshot.capturedAt}`,
    name: snapshot.name,
    duration: snapshot.duration,
    destination: snapshot.destination,
    price: snapshot.price,
    currency: snapshot.currency,
    description: snapshot.description,
    itinerary: cloneValue(snapshot.itinerary ?? []),
    inclusions: cloneValue(snapshot.inclusions ?? []),
    exclusions: cloneValue(snapshot.exclusions ?? []),
    createdAt: snapshot.capturedAt,
    region: snapshot.region,
    imageUrl: snapshot.imageUrl,
    cancellationPolicy: snapshot.cancellationPolicy,
    mealOptions: cloneValue(snapshot.mealOptions ?? []),
    transportOptions: cloneValue(snapshot.transportOptions ?? []),
    accommodationOptions: cloneValue(snapshot.accommodationOptions ?? []),
    customOptions: cloneValue(snapshot.customOptions ?? []),
  };
}

export function resolveLeadPackage(
  lead: Pick<Lead, "packageSnapshot">,
  livePackage?: TourPackage | null
): TourPackage | null {
  return packageFromSnapshot(lead.packageSnapshot) ?? livePackage ?? null;
}

export function resolveTourPackage(
  tour: Pick<Tour, "packageSnapshot">,
  livePackage?: TourPackage | null,
  lead?: Pick<Lead, "packageSnapshot"> | null
): TourPackage | null {
  return (
    packageFromSnapshot(tour.packageSnapshot) ??
    packageFromSnapshot(lead?.packageSnapshot) ??
    livePackage ??
    null
  );
}
