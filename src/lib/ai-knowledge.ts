import {
  ROUTE_COMFORT_HARD_CAP_HOURS,
  ROUTE_COMFORT_MAX_KM,
  ROUTE_COMFORT_TARGET_HOURS,
  getPlannerActivities,
  getPlannerDestinations,
  getPlannerHotelsForDestination,
  getPlannerPackagesForDestination,
  getPlannerLeg,
  type PlannerDestination,
} from "./route-planner";
import type { HotelSupplier, TourPackage } from "./types";

interface SriLankaKnowledgeInput {
  query?: string;
  focusTerms?: string[];
  packages?: TourPackage[];
  hotels?: HotelSupplier[];
  travelDate?: string;
  pax?: number;
  customNotes?: string;
  maxDestinations?: number;
}

const DEFAULT_FOCUS_DESTINATIONS = [
  "negombo",
  "sigiriya",
  "kandy",
  "ella",
  "yala",
  "galle",
] as const;

const CORE_RULES = [
  `Comfortable Sri Lanka routing should usually target about ${ROUTE_COMFORT_TARGET_HOURS} hours of driving per leg; anything beyond ${ROUTE_COMFORT_HARD_CAP_HOURS} hours or ${ROUTE_COMFORT_MAX_KM} km needs justification.`,
  "Bandaranaike Airport is the main international arrival point, so first-night and final-night planning should respect flight fatigue and airport access.",
  "Private car with chauffeur is the default touring pattern for multi-stop itineraries; vans fit larger families or luggage-heavy trips better.",
  "Breakfast is the normal baseline meal plan. Half board becomes more useful for wildlife lodges, remote stays, and short resort-led segments. Full board should be used when logistics clearly justify it.",
  "For island circuits, most guests respond better to route flow and comfort than to maximizing the number of stops.",
];

const PRODUCT_RULES = [
  "In this app, supplier-linked hotel, transport, and meal choices are the commercial source of truth for pricing-sensitive guidance.",
  "Journey-builder pricing is expected to combine hotel nights, transport, meals, and a guidance fee rather than invent package totals from thin air.",
  "When recommending stays, prefer hotels already in the supplier list or already used inside published packages before suggesting generic fallback ideas.",
  "Keep recommendations operationally realistic for a travel agency: avoid promising supplier availability, park access, or train inventory unless it has been checked.",
];

function normalizeText(value: string | null | undefined) {
  return value?.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ?? "";
}

function dedupeStrings(values: Array<string | undefined | null>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])
  );
}

function scoreDestination(destination: PlannerDestination, queryText: string) {
  if (!queryText) return 0;

  const haystacks = [
    destination.name,
    destination.shortName,
    destination.region,
    destination.summary,
    destination.arrivalNote,
    ...destination.tags,
    ...destination.keywords,
    ...destination.packageRegions,
  ].map(normalizeText);

  let score = 0;
  for (const haystack of haystacks) {
    if (!haystack) continue;
    if (queryText.includes(haystack)) {
      score += 8;
      continue;
    }

    for (const token of haystack.split(" ")) {
      if (token.length > 2 && queryText.includes(token)) {
        score += 1;
      }
    }
  }

  return score;
}

function getRelevantDestinations(input: SriLankaKnowledgeInput) {
  const allDestinations = getPlannerDestinations().filter(
    (destination) => destination.id !== "airport"
  );
  const queryText = normalizeText(
    [input.query ?? "", ...(input.focusTerms ?? [])].join(" ")
  );
  const limit = input.maxDestinations ?? 5;

  const scored = allDestinations
    .map((destination) => ({
      destination,
      score: scoreDestination(destination, queryText),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((entry) => entry.destination);

  if (scored.length > 0) {
    return scored;
  }

  return DEFAULT_FOCUS_DESTINATIONS.map((id) =>
    allDestinations.find((destination) => destination.id === id)
  ).filter((destination): destination is PlannerDestination => Boolean(destination));
}

function getMonthLabel(dateText?: string) {
  if (!dateText) return "";
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
}

function getSeasonalityNote(dateText?: string) {
  if (!dateText) {
    return "Beach suitability shifts by coast across the year, so south-west and east-coast recommendations should be matched to season rather than treated the same.";
  }

  const month = new Date(dateText).getUTCMonth() + 1;
  const monthLabel = getMonthLabel(dateText);

  if ([12, 1, 2, 3, 4].includes(month)) {
    return `${monthLabel} usually fits south and west coast beach routing better, while east-coast beach plans should be reviewed more carefully.`;
  }

  if ([5, 6, 7, 8, 9].includes(month)) {
    return `${monthLabel} is often stronger for east-coast beach ideas like Trincomalee, Pasikuda, and Arugam Bay than for monsoon-exposed south-west coast stays.`;
  }

  return `${monthLabel} is closer to an inter-monsoon shoulder, so beach expectations should stay flexible and route plans should favor balance over rigid coast assumptions.`;
}

function formatActivities(destination: PlannerDestination) {
  const activities = getPlannerActivities(destination.id).slice(0, 3);
  if (activities.length === 0) return "No activity pack mapped yet.";

  return activities
    .map(
      (activity) =>
        `${activity.title} (${activity.durationLabel}, ${activity.bestFor}, est ${activity.estimatedPrice} USD)`
    )
    .join("; ");
}

function formatHotels(
  destination: PlannerDestination,
  hotels: HotelSupplier[],
  packages: TourPackage[]
) {
  const matches = getPlannerHotelsForDestination(destination.id, hotels, packages)
    .slice(0, 3)
    .map((hotel) => {
      const stars = hotel.starRating ? `, ${hotel.starRating} star` : "";
      const price =
        hotel.pricePerNight > 0
          ? `, from ${hotel.pricePerNight} ${hotel.currency}/night`
          : "";
      return `${hotel.name} (${hotel.location}${stars}${price}; ${hotel.sourceLabel})`;
    });

  return matches.length > 0 ? matches.join("; ") : "No mapped hotel suggestions yet.";
}

function formatPackages(destination: PlannerDestination, packages: TourPackage[]) {
  const matches = getPlannerPackagesForDestination(destination.id, packages)
    .slice(0, 2)
    .map(
      (pkg) =>
        `${pkg.name} (${pkg.duration}, ${pkg.price} ${pkg.currency}, ${pkg.region})`
    );

  return matches.length > 0
    ? matches.join("; ")
    : "No published package references matched.";
}

function formatNextStops(destination: PlannerDestination) {
  const nextStops = destination.next
    .slice(0, 3)
    .map((nextId) => {
      const nextDestination = getPlannerDestinations().find(
        (entry) => entry.id === nextId
      );
      if (!nextDestination) return null;
      const leg = getPlannerLeg(destination.id, nextId);
      const timing = leg
        ? `${leg.driveHours}h / ${leg.distanceKm}km`
        : "timing not mapped";
      return `${nextDestination.name} (${timing})`;
    })
    .filter((entry): entry is string => Boolean(entry));

  return nextStops.length > 0 ? nextStops.join("; ") : "No next-stop guidance mapped.";
}

function buildDestinationSection(
  destination: PlannerDestination,
  hotels: HotelSupplier[],
  packages: TourPackage[]
) {
  return [
    `${destination.name} (${destination.region})`,
    `Summary: ${destination.summary}`,
    `Stay guidance: minimum ${destination.recommendedNights.min} night, ideal ${destination.recommendedNights.ideal}, max ${destination.recommendedNights.max}.`,
    `Arrival note: ${destination.arrivalNote}`,
    `Good next stops: ${formatNextStops(destination)}`,
    `Activities: ${formatActivities(destination)}`,
    `Hotels: ${formatHotels(destination, hotels, packages)}`,
    `Published package patterns: ${formatPackages(destination, packages)}`,
  ].join(" ");
}

export function buildSriLankaKnowledgeContext(input: SriLankaKnowledgeInput) {
  const hotels = input.hotels ?? [];
  const packages = input.packages ?? [];
  const destinations = getRelevantDestinations(input);
  const paxLine =
    input.pax && input.pax > 0
      ? `Guest sizing: current request is for ${input.pax} traveler${input.pax > 1 ? "s" : ""}, so rooming and vehicle comfort should be scaled realistically.`
      : "";

  return [
    "Sri Lanka domain knowledge for this app:",
    ...CORE_RULES.map((rule) => `- ${rule}`),
    ...PRODUCT_RULES.map((rule) => `- ${rule}`),
    `- Seasonality: ${getSeasonalityNote(input.travelDate)}`,
    paxLine ? `- ${paxLine}` : "",
    input.customNotes
      ? `- Company-specific notes: ${input.customNotes.trim()}`
      : "",
    "",
    "Relevant destination, activity, and hotel guidance:",
    ...destinations.map((destination) =>
      `- ${buildDestinationSection(destination, hotels, packages)}`
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildFocusTerms(input: {
  query?: string;
  destination?: string;
  packageName?: string;
  itineraryTitles?: string[];
  notes?: string;
}) {
  return dedupeStrings([
    input.query,
    input.destination,
    input.packageName,
    input.notes,
    ...(input.itineraryTitles ?? []),
  ]);
}
