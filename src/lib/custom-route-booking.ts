import type { AuditLog, ItineraryDay, Lead, PackageSnapshot } from "./types";

export type CustomRouteStopMeta = {
  destinationId?: string;
  destinationName?: string;
  nights?: number;
  hotelName?: string;
  hotelRate?: number;
  hotelCurrency?: string;
  activities?: string[];
  legDistanceKm?: number;
  legDriveHours?: number;
};

export type CustomRouteMeta = {
  routeStops: CustomRouteStopMeta[];
  transportLabel?: string;
  mealLabel?: string;
  mealRequest?: string;
  stayStyle?: string;
  accommodationMode?: string;
  guidanceFee?: number;
  guidanceLabel?: string;
  desiredNights?: number;
};

function trimToUndefined(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getStopNights(stop: CustomRouteStopMeta): number {
  if (!Number.isFinite(stop.nights)) return 0;
  return Math.max(0, Math.floor(stop.nights ?? 0));
}

function getCustomRouteTotalNights(route: CustomRouteMeta): number {
  if (Number.isFinite(route.desiredNights)) {
    return Math.max(0, Math.floor(route.desiredNights ?? 0));
  }
  return route.routeStops.reduce((sum, stop) => sum + getStopNights(stop), 0);
}

function getCustomRouteTotalDays(route: CustomRouteMeta): number {
  const totalNights = getCustomRouteTotalNights(route);
  return Math.max(1, totalNights + (route.routeStops.length > 0 ? 1 : 0));
}

function describeStop(stop: CustomRouteStopMeta, includeTransfer: boolean): string {
  const details: string[] = [];
  const hotelName = trimToUndefined(stop.hotelName);
  const activities = stop.activities?.map((item) => item.trim()).filter(Boolean) ?? [];

  if (includeTransfer) {
    const transferBits: string[] = [];
    if (Number.isFinite(stop.legDistanceKm) && (stop.legDistanceKm ?? 0) > 0) {
      transferBits.push(`${Math.round(stop.legDistanceKm ?? 0)} km`);
    }
    if (Number.isFinite(stop.legDriveHours) && (stop.legDriveHours ?? 0) > 0) {
      transferBits.push(`${roundCurrency(stop.legDriveHours ?? 0)} hrs drive`);
    }
    if (transferBits.length > 0) {
      details.push(`Transfer: ${transferBits.join(" | ")}.`);
    }
  }

  if (hotelName) {
    details.push(`Stay at ${hotelName}.`);
  }
  if (activities.length > 0) {
    details.push(`Highlights: ${activities.join(", ")}.`);
  }

  return details.join(" ") || "Custom journey day.";
}

function buildCustomRouteItinerary(route: CustomRouteMeta): ItineraryDay[] {
  const itinerary: ItineraryDay[] = [];
  const totalDays = getCustomRouteTotalDays(route);
  let dayNumber = 1;

  for (const stop of route.routeStops) {
    const stopName = trimToUndefined(stop.destinationName) ?? `Stop ${itinerary.length + 1}`;
    const stayDays = Math.max(1, getStopNights(stop));

    for (let index = 0; index < stayDays && dayNumber <= totalDays; index += 1) {
      itinerary.push({
        day: dayNumber,
        title: index === 0 ? `Arrive in ${stopName}` : `${stopName} stay`,
        description: describeStop(stop, index === 0),
        accommodation: trimToUndefined(stop.hotelName),
      });
      dayNumber += 1;
    }
  }

  if (itinerary.length === 0) {
    itinerary.push({
      day: 1,
      title: "Custom Sri Lanka journey",
      description: "Tailored route created from the client journey builder.",
    });
    dayNumber = 2;
  }

  while (dayNumber < totalDays) {
    itinerary.push({
      day: dayNumber,
      title: "Flexible custom day",
      description: "Private touring and free time based on the confirmed custom route.",
    });
    dayNumber += 1;
  }

  if (dayNumber === totalDays) {
    const finalStopName = trimToUndefined(
      route.routeStops[route.routeStops.length - 1]?.destinationName
    );
    itinerary.push({
      day: dayNumber,
      title: finalStopName ? `Departure from ${finalStopName}` : "Departure",
      description: "Departure day and onward transfer.",
    });
  }

  return itinerary;
}

export function readCustomRouteMeta(
  metadata?: Record<string, unknown>
): CustomRouteMeta | null {
  if (!metadata || typeof metadata !== "object") return null;
  const routeStops = Array.isArray(metadata.routeStops)
    ? (metadata.routeStops as CustomRouteStopMeta[])
    : [];
  if (routeStops.length === 0) return null;

  return {
    routeStops,
    transportLabel:
      typeof metadata.transportLabel === "string" ? metadata.transportLabel : undefined,
    mealLabel: typeof metadata.mealLabel === "string" ? metadata.mealLabel : undefined,
    mealRequest:
      typeof metadata.mealRequest === "string" ? metadata.mealRequest : undefined,
    stayStyle: typeof metadata.stayStyle === "string" ? metadata.stayStyle : undefined,
    accommodationMode:
      typeof metadata.accommodationMode === "string"
        ? metadata.accommodationMode
        : undefined,
    guidanceFee:
      typeof metadata.guidanceFee === "number" ? metadata.guidanceFee : undefined,
    guidanceLabel:
      typeof metadata.guidanceLabel === "string" ? metadata.guidanceLabel : undefined,
    desiredNights:
      typeof metadata.desiredNights === "number" ? metadata.desiredNights : undefined,
  };
}

export function getCustomRouteMetaFromAuditLogs(logs: AuditLog[]): CustomRouteMeta | null {
  const sourceLog = logs.find((log) => log.action === "created_from_route_builder");
  return readCustomRouteMeta(sourceLog?.metadata);
}

export function createCustomRoutePackageSnapshot(
  lead: Pick<Lead, "id" | "destination" | "pax" | "totalPrice">,
  route: CustomRouteMeta
): PackageSnapshot {
  const totalPrice =
    typeof lead.totalPrice === "number" && Number.isFinite(lead.totalPrice)
      ? roundCurrency(lead.totalPrice)
      : undefined;
  const pax = Math.max(1, lead.pax ?? 1);
  const totalNights = getCustomRouteTotalNights(route);
  const totalDays = getCustomRouteTotalDays(route);
  const routeLabel =
    trimToUndefined(lead.destination) ??
    (route.routeStops
      .map((stop) => trimToUndefined(stop.destinationName))
      .filter((value): value is string => Boolean(value))
      .join(" -> ") ||
      "Custom Sri Lanka route");
  const currency =
    route.routeStops
      .map((stop) => trimToUndefined(stop.hotelCurrency))
      .find((value): value is string => Boolean(value)) ?? "USD";
  const inclusions = [
    "Private custom itinerary planning",
    trimToUndefined(route.transportLabel)
      ? `Transport: ${route.transportLabel?.trim()}`
      : undefined,
    trimToUndefined(route.mealLabel)
      ? `Meals: ${route.mealLabel?.trim()}`
      : undefined,
    trimToUndefined(route.guidanceLabel)
      ? `Guidance: ${route.guidanceLabel?.trim()}`
      : undefined,
  ].filter((value): value is string => Boolean(value));

  return {
    packageId: `custom_route_${lead.id}`,
    name: "Custom Sri Lanka journey",
    duration: `${totalDays} Days / ${totalNights} Nights`,
    destination: routeLabel,
    price: totalPrice != null ? roundCurrency(totalPrice / pax) : 0,
    currency,
    description:
      "Tailored journey request created from the client custom route builder.",
    itinerary: buildCustomRouteItinerary(route),
    inclusions,
    exclusions: [],
    totalPrice,
    capturedAt: new Date().toISOString(),
  };
}
