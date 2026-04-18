import type { AuditLog } from "./types";

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

