/**
 * Extract geo points [lat, lng] + labels for the route of a scheduled tour.
 * Priority order:
 *   1. Custom-route audit-log meta (routeStops with destinationId)
 *   2. packageSnapshot / package itinerary days — match day titles &
 *      accommodation text against known planner destinations.
 *   3. package destination field as a single-point fallback.
 */

import {
  getPlannerDestinations,
  getPlannerDestinationCoordinates,
  type PlannerDestinationId,
} from "./route-planner";
import { getCustomRouteMetaFromAuditLogs } from "./custom-route-booking";
import type { AuditLog, ItineraryDay, Tour, TourPackage } from "./types";

export interface TourRoutePoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  dayLabel?: string;
  nights?: number;
  accommodation?: string;
}

function matchPlannerDestinationFromText(text: string): {
  id: PlannerDestinationId;
  name: string;
} | null {
  if (!text) return null;
  const needle = text.toLowerCase();
  const destinations = getPlannerDestinations();
  let best: { id: PlannerDestinationId; name: string; score: number } | null = null;
  for (const d of destinations) {
    if (d.id === "airport") continue;
    const nameLower = d.name.toLowerCase();
    if (needle.includes(nameLower)) {
      const score = nameLower.length;
      if (!best || score > best.score) {
        best = { id: d.id, name: d.name, score };
      }
    }
  }
  return best ? { id: best.id, name: best.name } : null;
}

function fromRouteStops(
  auditLogs: AuditLog[] | undefined
): TourRoutePoint[] | null {
  if (!auditLogs || auditLogs.length === 0) return null;
  const meta = getCustomRouteMetaFromAuditLogs(auditLogs);
  if (!meta || meta.routeStops.length === 0) return null;

  const points: TourRoutePoint[] = [];
  for (const stop of meta.routeStops) {
    const id = stop.destinationId as PlannerDestinationId | undefined;
    if (!id) continue;
    try {
      const [lat, lng] = getPlannerDestinationCoordinates(id);
      points.push({
        id,
        name: stop.destinationName || id,
        lat,
        lng,
        nights: stop.nights,
        accommodation: stop.hotelName,
      });
    } catch {
      // unknown destinationId — skip
    }
  }
  return points.length > 0 ? points : null;
}

function fromItinerary(days: ItineraryDay[] | undefined): TourRoutePoint[] | null {
  if (!days || days.length === 0) return null;
  const points: TourRoutePoint[] = [];
  const seen = new Set<string>();
  for (const day of days) {
    const haystack = [day.title, day.accommodation, day.description]
      .filter(Boolean)
      .join(" ");
    const match = matchPlannerDestinationFromText(haystack);
    if (!match) continue;
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    try {
      const [lat, lng] = getPlannerDestinationCoordinates(
        match.id as PlannerDestinationId
      );
      points.push({
        id: match.id,
        name: match.name,
        lat,
        lng,
        dayLabel: `Day ${day.day}`,
        accommodation: day.accommodation,
      });
    } catch {
      // skip
    }
  }
  return points.length > 0 ? points : null;
}

function fromDestinationString(
  destination: string | undefined
): TourRoutePoint[] | null {
  if (!destination) return null;
  const parts = destination
    .split(/[,→\/|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const points: TourRoutePoint[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const match = matchPlannerDestinationFromText(part);
    if (!match || seen.has(match.id)) continue;
    seen.add(match.id);
    try {
      const [lat, lng] = getPlannerDestinationCoordinates(
        match.id as PlannerDestinationId
      );
      points.push({ id: match.id, name: match.name, lat, lng });
    } catch {
      // skip
    }
  }
  return points.length > 0 ? points : null;
}

export function buildTourRoutePoints({
  tour,
  pkg,
  auditLogs,
}: {
  tour: Tour;
  pkg: TourPackage | null;
  auditLogs?: AuditLog[];
}): TourRoutePoint[] {
  const snapshot = tour.packageSnapshot;
  const itinerary = snapshot?.itinerary ?? pkg?.itinerary;
  const destination = snapshot?.destination ?? pkg?.destination;

  return (
    fromRouteStops(auditLogs) ??
    fromItinerary(itinerary) ??
    fromDestinationString(destination) ??
    []
  );
}
