/**
 * Destination-based coordinate lookup for booking / journey review maps.
 *
 * All paraiso tours are destination-based — every package's itinerary
 * days reference a destination name / location string, not a literal
 * pair of coordinates. Rather than migrate `packages.itinerary[].coordinates`
 * into the DB, we resolve destination strings against the existing
 * `route-planner` destination catalog at read time. That catalog
 * already owns authoritative coords for every Sri Lanka location we
 * ship, and the planner UI uses the same lookup.
 *
 * Resolution order:
 *   1. Exact match on PlannerDestinationId (e.g. `"kandy"`)
 *   2. Normalised match on the destination's `name` (e.g. `"Kandy"`)
 *   3. Normalised match on `shortName`, `region`, or any of
 *      `packageRegions`
 *   4. Keyword match against `keywords` (case-insensitive substring)
 *
 * Returns `null` when nothing matches — callers render the step
 * without a map rather than misplacing a pin.
 */
import {
  getPlannerDestinations,
  getPlannerDestinationCoordinates,
  type PlannerDestinationId,
} from "./route-planner";
import type { TourPackage } from "./types";

/** The shape ReviewMap's `points[]` expects — `[lng, lat]`. */
export type RouteMapPoint = {
  name: string;
  shortName: string;
  coordinates: [number, number];
  dayNumbers: number[];
  isAirport?: boolean;
};

/** Lightweight descriptor for resolved destination lookups. */
export type ResolvedDestination = {
  id: PlannerDestinationId;
  name: string;
  shortName: string;
  coordinates: [number, number];
};

function normalize(value: string | undefined | null): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Resolve any free-text destination string (package `destination` /
 * `region`, or an itinerary-day `title` / `accommodation`) to a known
 * planner destination. Returns `null` when unresolved.
 */
export function resolveDestinationFromText(
  text: string | undefined | null
): ResolvedDestination | null {
  const normalizedText = normalize(text);
  if (!normalizedText) return null;

  const destinations = getPlannerDestinations().filter((d) => d.id !== "airport");

  // 1. Exact id (e.g. caller already passed "kandy")
  const byId = destinations.find((d) => d.id === normalizedText);
  if (byId) {
    return {
      id: byId.id,
      name: byId.name,
      shortName: byId.shortName,
      coordinates: getPlannerDestinationCoordinates(byId.id),
    };
  }

  // 2. Name / shortName / region / packageRegions exact (normalised)
  for (const dest of destinations) {
    const candidates = [
      dest.name,
      dest.shortName,
      dest.region,
      ...dest.packageRegions,
    ];
    if (candidates.some((c) => normalize(c) === normalizedText)) {
      return {
        id: dest.id,
        name: dest.name,
        shortName: dest.shortName,
        coordinates: getPlannerDestinationCoordinates(dest.id),
      };
    }
  }

  // 3. Keyword substring match — first hit wins, ordered by how the
  // planner catalog ranks them. Keywords are short distinctive terms
  // (e.g. "sigiriya rock", "temple of the tooth") so false positives
  // are rare.
  for (const dest of destinations) {
    if (
      dest.keywords.some((kw) => {
        const needle = normalize(kw);
        return needle.length > 2 && normalizedText.includes(needle);
      })
    ) {
      return {
        id: dest.id,
        name: dest.name,
        shortName: dest.shortName,
        coordinates: getPlannerDestinationCoordinates(dest.id),
      };
    }
  }

  return null;
}

/**
 * Build the `points[]` a ReviewMap needs from a package's itinerary.
 *
 * Each itinerary day is resolved to its planner destination. Days that
 * resolve to the same destination collapse into a single point whose
 * `dayNumbers[]` lists the nights spent there (so the pin label can
 * read "Day 2-3 · Kandy"). Unresolved days are dropped — the map
 * still renders as long as any day resolves.
 *
 * If fewer than two distinct destinations resolve, returns an empty
 * array — a one-pin "route" isn't meaningfully a map, so the caller
 * can skip rendering and fall back to a list.
 */
export function buildPackageRouteMapPoints(pkg: TourPackage): RouteMapPoint[] {
  const points: RouteMapPoint[] = [];
  const byId = new Map<string, RouteMapPoint>();

  pkg.itinerary.forEach((day, index) => {
    // Try the explicit location string first, then day title, then
    // accommodation text as a weaker fallback. Package-level
    // destination/region are only used as a final fallback if no day
    // resolves individually (that's handled below).
    const sources = [
      day.title,
      day.description,
      day.accommodation,
      day.accommodationOptions?.[0]?.label,
    ];
    const resolved = sources
      .map((s) => resolveDestinationFromText(s))
      .find((r): r is ResolvedDestination => r !== null);
    if (!resolved) return;

    const dayNumber = index + 1;
    const existing = byId.get(resolved.id);
    if (existing) {
      existing.dayNumbers.push(dayNumber);
      return;
    }
    const point: RouteMapPoint = {
      name: resolved.name,
      shortName: resolved.shortName,
      coordinates: resolved.coordinates,
      dayNumbers: [dayNumber],
    };
    byId.set(resolved.id, point);
    points.push(point);
  });

  // If no day resolved, try the package-level destination/region
  // as a last-ditch match so the map still anchors somewhere.
  if (points.length === 0) {
    const fallback =
      resolveDestinationFromText(pkg.destination) ??
      resolveDestinationFromText(pkg.region);
    if (fallback) {
      points.push({
        name: fallback.name,
        shortName: fallback.shortName,
        coordinates: fallback.coordinates,
        dayNumbers: [1],
      });
    }
  }

  // A single point isn't a meaningful route map. Caller renders a
  // list instead.
  if (points.length < 2) return [];

  return points;
}
