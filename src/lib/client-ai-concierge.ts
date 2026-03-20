import { getPlannerLeg, type PlannerDestinationId } from "./route-planner";

type JourneyAccommodationMode = "auto" | "choose";
type JourneyDestinationId = Exclude<PlannerDestinationId, "airport">;

export interface ClientJourneyPlanStop {
  destinationId: JourneyDestinationId;
  nights: number;
  hotelId: string;
}

export interface ClientJourneyPlan {
  summary: string;
  travelDate: string;
  pax: number;
  accommodationMode: JourneyAccommodationMode;
  transportSelectionId: string;
  mealSelectionId: string;
  mealRequest: string;
  routeStops: ClientJourneyPlanStop[];
  followUpQuestions: string[];
}

interface ClientJourneyPlanContext {
  defaultTravelDate?: string;
  defaultPax?: number;
  transportOptionIds: string[];
  mealOptionIds: string[];
  hotelIdsByDestination: Record<string, string[]>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDate(value: unknown, fallback = "") {
  const text = asText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function normalizePositiveInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number
) {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function isJourneyDestinationId(value: string): value is JourneyDestinationId {
  return value !== "airport" && value.length > 0;
}

function dedupeQuestions(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return Array.from(
    new Set(
      value
        .map((entry) => asText(entry))
        .filter((entry) => entry.length > 0)
        .slice(0, 4)
    )
  );
}

function normalizeRouteStops(
  rawStops: unknown,
  context: ClientJourneyPlanContext
) {
  if (!Array.isArray(rawStops)) return [] as ClientJourneyPlanStop[];

  const stops: ClientJourneyPlanStop[] = [];
  const visited = new Set<string>();
  let previousId: PlannerDestinationId = "airport";

  for (const entry of rawStops) {
    if (!isRecord(entry)) continue;

    const destinationId = asText(entry.destinationId);
    if (!isJourneyDestinationId(destinationId)) continue;
    if (visited.has(destinationId)) continue;
    if (!getPlannerLeg(previousId, destinationId)) continue;

    const availableHotelIds =
      context.hotelIdsByDestination[destinationId] ?? [];
    const requestedHotelId = asText(entry.hotelId);
    const hotelId = availableHotelIds.includes(requestedHotelId)
      ? requestedHotelId
      : (availableHotelIds[0] ?? "");

    stops.push({
      destinationId,
      nights: normalizePositiveInteger(entry.nights, 1, 1, 6),
      hotelId,
    });

    visited.add(destinationId);
    previousId = destinationId;
  }

  return stops.slice(0, 6);
}

export function coerceClientJourneyPlan(
  value: unknown,
  context: ClientJourneyPlanContext
): ClientJourneyPlan {
  const record = isRecord(value) ? value : {};
  const routeStops = normalizeRouteStops(record.routeStops, context);
  const accommodationMode =
    record.accommodationMode === "choose" ? "choose" : "auto";
  const defaultPax = Math.max(1, context.defaultPax ?? 2);
  const followUpQuestions = dedupeQuestions(record.followUpQuestions);
  const travelDate = normalizeDate(record.travelDate, context.defaultTravelDate ?? "");

  const mealSelectionId = context.mealOptionIds.includes(asText(record.mealSelectionId))
    ? asText(record.mealSelectionId)
    : "none";
  const transportSelectionId = context.transportOptionIds.includes(
    asText(record.transportSelectionId)
  )
    ? asText(record.transportSelectionId)
    : "none";

  const autoQuestions = [...followUpQuestions];
  if (!travelDate) {
    autoQuestions.push("What travel date should we lock in for this trip?");
  }
  if (routeStops.length === 0) {
    autoQuestions.push("Which destinations should the trip definitely include?");
  }

  return {
    summary:
      asText(record.summary) ||
      "AI drafted a Sri Lanka journey based on the current guest brief.",
    travelDate,
    pax: normalizePositiveInteger(record.pax, defaultPax, 1, 14),
    accommodationMode,
    transportSelectionId,
    mealSelectionId,
    mealRequest: asText(record.mealRequest),
    routeStops,
    followUpQuestions: Array.from(new Set(autoQuestions)).slice(0, 4),
  };
}
