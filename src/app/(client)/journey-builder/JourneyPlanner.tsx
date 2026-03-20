"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  CarFront,
  Check,
  ConciergeBell,
  Loader2,
  MapPinned,
  Minus,
  PlaneLanding,
  Plus,
  Soup,
  Sparkles,
  Trash2,
  Trees,
  Users,
  Waves,
} from "lucide-react";
import { generateClientJourneyPlanAction } from "@/app/actions/client-ai";
import type { HotelSupplier, TourPackage } from "@/lib/types";
import type { ClientJourneyPlan } from "@/lib/client-ai-concierge";
import {
  calculateCustomJourneyPricing,
  DEFAULT_CUSTOM_JOURNEY_GUIDANCE_FEE,
  DEFAULT_CUSTOM_JOURNEY_GUIDANCE_LABEL,
  getCustomJourneyMealOptions,
  getCustomJourneyTransportOptions,
} from "@/lib/custom-journey";
import { createCustomRouteRequestAction } from "@/app/actions/custom-route-request";
import { JourneyMap } from "./JourneyMap";
import {
  getPlannerActivities,
  getPlannerDestination,
  getPlannerDestinationCoordinates,
  getPlannerDestinations,
  getPlannerHotelsForDestination,
  getPlannerLeg,
  getSuggestedNextDestinations,
  pickDefaultPlannerHotel,
  ROUTE_COMFORT_HARD_CAP_HOURS,
  ROUTE_COMFORT_MAX_KM,
  type PlannerDestinationId,
} from "@/lib/route-planner";

type BuilderStepId = "trip" | "route" | "choices" | "summary";
type AccommodationMode = "auto" | "choose";

type RouteStop = {
  id: string;
  destinationId: Exclude<PlannerDestinationId, "airport">;
  nights: number;
  hotelId: string;
};

const airport = getPlannerDestination("airport");
const plannerDestinations = getPlannerDestinations();
const conciergePromptExamples = [
  "Plan a 7-night Sri Lanka honeymoon in August with Sigiriya, Kandy, Ella, and a south-coast beach. We want a chauffeur car, boutique stays, and breakfast only.",
  "Create a family trip for 4 in December with culture, safari, and beach time. Keep driving comfortable, use a premium van, and include half board.",
  "Build a short 5-night route for 2 adults landing late, with Negombo, Sigiriya, Kandy, and Bentota. No meal plan, and let the team choose the hotels.",
];

function currencyFormat(value: number, currency: string) {
  return `${Math.round(value).toLocaleString()} ${currency}`;
}

function getDestinationAccent(destinationId: PlannerDestinationId) {
  if (
    destinationId === "negombo" ||
    destinationId === "galle" ||
    destinationId === "bentota" ||
    destinationId === "mirissa" ||
    destinationId === "pasikuda" ||
    destinationId === "trincomalee"
  ) {
    return "text-[#0f5965]";
  }

  if (destinationId === "yala") {
    return "text-[#4d6a28]";
  }

  return "text-[#7a4a1f]";
}

function renderDestinationIcon(destinationId: PlannerDestinationId, className: string) {
  if (destinationId === "airport") {
    return <PlaneLanding className={className} />;
  }
  if (
    destinationId === "negombo" ||
    destinationId === "galle" ||
    destinationId === "bentota" ||
    destinationId === "mirissa" ||
    destinationId === "pasikuda" ||
    destinationId === "trincomalee"
  ) {
    return <Waves className={className} />;
  }
  if (destinationId === "yala") {
    return <Trees className={className} />;
  }
  return <MapPinned className={className} />;
}

function StepButton({
  current,
  done,
  label,
  summary,
  onClick,
}: {
  current: boolean;
  done: boolean;
  label: string;
  summary: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-[10rem] flex-1 items-center gap-3 rounded-[1.4rem] border px-4 py-3 text-left transition ${
        current
          ? "border-[#12343b] bg-[#12343b] text-[#f7ead7] shadow-[0_20px_48px_-28px_rgba(18,52,59,0.9)]"
          : done
            ? "border-[#cfd9cf] bg-[#eff6f2] text-stone-800"
            : "border-[#ddc8b0] bg-white/70 text-stone-600"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          current
            ? "bg-white/12 text-[#f7ead7]"
            : done
              ? "bg-[#12343b] text-[#f7ead7]"
              : "bg-[#f6eee2] text-stone-700"
        }`}
      >
        {done && !current ? <Check className="h-4 w-4" /> : label.slice(0, 1)}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span
          className={`mt-0.5 block text-xs ${
            current ? "text-[#d8ccb8]" : "text-stone-500"
          }`}
        >
          {summary}
        </span>
      </span>
    </button>
  );
}

function ChoiceCard({
  title,
  summary,
  priceLabel,
  selected,
  icon,
  onClick,
}: {
  title: string;
  summary: string;
  priceLabel?: string;
  selected: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[1.35rem] border p-4 text-left transition ${
        selected
          ? "border-[#12343b] bg-[#12343b] text-[#f7ead7] shadow-[0_20px_48px_-28px_rgba(18,52,59,0.9)]"
          : "border-[#ddc8b0] bg-white/72 text-stone-800 hover:border-[#cbb08b] hover:bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${
            selected ? "bg-white/12 text-[#f7ead7]" : "bg-[#f7eee2] text-[#12343b]"
          }`}
        >
          {icon}
        </span>
        {selected ? (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f2dfbf] text-[#12343b]">
            <Check className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-4 font-semibold">{title}</p>
      <p className={`mt-2 text-sm leading-6 ${selected ? "text-[#e3d8c8]" : "text-stone-600"}`}>
        {summary}
      </p>
      {priceLabel ? (
        <p className={`mt-3 text-sm font-medium ${selected ? "text-[#f2dfbf]" : "text-[#7a4a1f]"}`}>
          {priceLabel}
        </p>
      ) : null}
    </button>
  );
}

export function JourneyPlanner({
  hotels,
  packages,
  guidanceFee = DEFAULT_CUSTOM_JOURNEY_GUIDANCE_FEE,
  guidanceLabel = DEFAULT_CUSTOM_JOURNEY_GUIDANCE_LABEL,
  aiConciergeEnabled = false,
}: {
  hotels: HotelSupplier[];
  packages: TourPackage[];
  guidanceFee?: number;
  guidanceLabel?: string;
  aiConciergeEnabled?: boolean;
}) {
  const router = useRouter();
  const stopCounterRef = useRef(0);
  const summaryFormRef = useRef<HTMLFormElement | null>(null);
  const estimateCurrency =
    packages[0]?.currency ?? hotels.find((hotel) => hotel.currency)?.currency ?? "USD";

  const [builderStep, setBuilderStep] = useState<BuilderStepId>("trip");
  const [travelDate, setTravelDate] = useState("");
  const [pax, setPax] = useState(2);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [previewDestinationId, setPreviewDestinationId] =
    useState<PlannerDestinationId>("airport");
  const [accommodationMode, setAccommodationMode] =
    useState<AccommodationMode>("auto");
  const [transportSelectionId, setTransportSelectionId] = useState("none");
  const [mealSelectionId, setMealSelectionId] = useState("none");
  const [mealRequest, setMealRequest] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [aiGenerating, setAiGenerating] = useState(false);

  const transportOptions = useMemo(
    () => getCustomJourneyTransportOptions(hotels, packages, estimateCurrency),
    [estimateCurrency, hotels, packages]
  );
  const mealOptions = useMemo(
    () => getCustomJourneyMealOptions(hotels, packages, estimateCurrency),
    [estimateCurrency, hotels, packages]
  );

  const selectedTransport =
    transportOptions.find((option) => option.id === transportSelectionId) ?? null;
  const selectedMeal =
    mealOptions.find((option) => option.id === mealSelectionId) ?? null;

  const routeDestinationIds = routeStops.map(
    (stop) => stop.destinationId as PlannerDestinationId
  );
  const currentAnchor = routeStops.length
    ? getPlannerDestination(routeStops[routeStops.length - 1].destinationId)
    : airport;

  const addableDestinationIds = useMemo(() => {
    const visited = new Set(routeDestinationIds);
    const valid = new Set<Exclude<PlannerDestinationId, "airport">>();

    for (const destination of plannerDestinations) {
      if (destination.id === "airport" || visited.has(destination.id)) {
        continue;
      }
      const leg = getPlannerLeg(currentAnchor.id, destination.id);
      if (!leg) continue;

      if (
        currentAnchor.next.includes(destination.id) ||
        (leg.driveHours <= ROUTE_COMFORT_HARD_CAP_HOURS &&
          leg.distanceKm <= ROUTE_COMFORT_MAX_KM)
      ) {
        valid.add(destination.id);
      }
    }

    return valid;
  }, [currentAnchor.id, currentAnchor.next, routeDestinationIds]);

  const quickSuggestions = useMemo(
    () => getSuggestedNextDestinations(routeDestinationIds).slice(0, 4),
    [routeDestinationIds]
  );

  const routeDetails = useMemo(
    () =>
      routeStops.map((stop, index) => {
        const destination = getPlannerDestination(stop.destinationId);
        const hotelChoices = getPlannerHotelsForDestination(
          stop.destinationId,
          hotels,
          packages
        );
        const selectedHotel =
          hotelChoices.find((hotel) => hotel.id === stop.hotelId) ??
          hotelChoices[0] ??
          null;
        const fromDestinationId =
          index === 0
            ? ("airport" as const)
            : (routeStops[index - 1].destinationId as PlannerDestinationId);
        const leg = getPlannerLeg(fromDestinationId, stop.destinationId);

        return {
          ...stop,
          destination,
          leg,
          hotelChoices,
          selectedHotel,
          activities: getPlannerActivities(stop.destinationId).slice(0, 3),
        };
      }),
    [hotels, packages, routeStops]
  );

  const effectivePreviewDestinationId = useMemo(() => {
    if (previewDestinationId === "airport") {
      return routeDetails[0]?.destination.id ?? quickSuggestions[0]?.destination.id ?? "airport";
    }

    const previewInRoute = routeDetails.some(
      (stop) => stop.destination.id === previewDestinationId
    );
    if (previewInRoute) {
      return previewDestinationId;
    }

    if (addableDestinationIds.has(previewDestinationId)) {
      return previewDestinationId;
    }

    return routeDetails[0]?.destination.id ?? quickSuggestions[0]?.destination.id ?? "airport";
  }, [addableDestinationIds, previewDestinationId, quickSuggestions, routeDetails]);

  const previewDestination = getPlannerDestination(effectivePreviewDestinationId);
  const previewRouteStop =
    routeDetails.find((stop) => stop.destination.id === effectivePreviewDestinationId) ??
    null;
  const previewHotels =
    previewDestination.id === "airport"
      ? []
      : getPlannerHotelsForDestination(previewDestination.id, hotels, packages);
  const previewDefaultHotel =
    previewDestination.id === "airport"
      ? null
      : pickDefaultPlannerHotel(previewHotels, "boutique");
  const previewActivities =
    previewDestination.id === "airport"
      ? []
      : getPlannerActivities(previewDestination.id).slice(0, 3);
  const previewIsAddable =
    builderStep === "route" &&
    previewDestination.id !== "airport" &&
    addableDestinationIds.has(previewDestination.id);
  const previewLeg = previewRouteStop?.leg
    ? previewRouteStop.leg
    : previewIsAddable && previewDestination.id !== "airport"
      ? getPlannerLeg(currentAnchor.id, previewDestination.id)
      : null;

  const pricing = useMemo(
    () =>
      calculateCustomJourneyPricing({
        pax,
        routeStops: routeDetails.map((stop) => ({
          nights: stop.nights,
          hotel: stop.selectedHotel
            ? {
                id: stop.selectedHotel.id,
                name: stop.selectedHotel.name,
                pricePerNight: stop.selectedHotel.pricePerNight,
                currency: stop.selectedHotel.currency,
              }
            : null,
        })),
        transportOption: selectedTransport,
        mealOption: selectedMeal,
        guidanceFee,
        guidanceLabel,
      }),
    [guidanceFee, guidanceLabel, pax, routeDetails, selectedMeal, selectedTransport]
  );

  const totalDriveHours = useMemo(() => {
    const routeHours = routeDetails.reduce(
      (sum, stop) => sum + (stop.leg?.driveHours ?? 0),
      0
    );
    const airportReturnHours =
      routeDetails[routeDetails.length - 1]?.destination.airportTransfer.driveHours ?? 0;
    return routeHours + airportReturnHours;
  }, [routeDetails]);

  const mapDestinations = plannerDestinations.map((destination) => {
    const routeOrder =
      routeDetails.findIndex((stop) => stop.destination.id === destination.id) + 1;

    return {
      id: destination.id,
      name: destination.name,
      shortName: destination.shortName,
      region: destination.region,
      coordinates: getPlannerDestinationCoordinates(destination.id),
      isAirport: destination.id === "airport",
      isPreview: previewDestination.id === destination.id,
      isInRoute: routeOrder > 0,
      isAddable:
        builderStep === "route" &&
        destination.id !== "airport" &&
        addableDestinationIds.has(destination.id),
      routeOrder: routeOrder > 0 ? routeOrder : null,
    };
  });

  const orderedRouteIds: PlannerDestinationId[] = [
    "airport",
    ...routeDetails.map((stop) => stop.destination.id),
  ];
  const routeSegments = orderedRouteIds.slice(1).map((destinationId, index) => ({
    id: `${orderedRouteIds[index]}_${destinationId}`,
    coordinates: [
      getPlannerDestinationCoordinates(orderedRouteIds[index]),
      getPlannerDestinationCoordinates(destinationId),
    ] as [number, number][],
  }));
  const suggestionSegments =
    builderStep === "route"
      ? quickSuggestions.map(({ destination }) => ({
          id: `${currentAnchor.id}_${destination.id}`,
          coordinates: [
            getPlannerDestinationCoordinates(currentAnchor.id),
            getPlannerDestinationCoordinates(destination.id),
          ] as [number, number][],
        }))
      : [];

  const builderSteps: Array<{
    id: BuilderStepId;
    label: string;
    summary: string;
  }> = [
    { id: "trip", label: "Trip", summary: "Dates and guests" },
    { id: "route", label: "Route", summary: "Pick the journey flow" },
    { id: "choices", label: "Choices", summary: "Hotels, transport, meals" },
    { id: "summary", label: "Summary", summary: "Review and confirm" },
  ];
  const currentStepIndex = builderSteps.findIndex((step) => step.id === builderStep);

  function createRouteStop(destinationId: Exclude<PlannerDestinationId, "airport">) {
    const hotelChoices = getPlannerHotelsForDestination(destinationId, hotels, packages);
    const defaultHotel = pickDefaultPlannerHotel(hotelChoices, "boutique");
    stopCounterRef.current += 1;

    return {
      id: `${destinationId}_${stopCounterRef.current}`,
      destinationId,
      nights: 1,
      hotelId: defaultHotel?.id ?? "",
    } satisfies RouteStop;
  }

  function goToStep(step: BuilderStepId) {
    setError("");
    setBuilderStep(step);
  }

  function goNext() {
    if (builderStep === "trip" && !travelDate) {
      setError("Choose the guest travel date first.");
      return;
    }

    if (builderStep === "route" && routeStops.length === 0) {
      setError("Add at least one destination to build the journey.");
      return;
    }

    if (currentStepIndex < builderSteps.length - 1) {
      goToStep(builderSteps[currentStepIndex + 1].id);
    }
  }

  function goBack() {
    setError("");
    if (currentStepIndex > 0) {
      goToStep(builderSteps[currentStepIndex - 1].id);
    }
  }

  function addStop(destinationId: Exclude<PlannerDestinationId, "airport">) {
    if (routeDestinationIds.includes(destinationId)) return;
    if (!addableDestinationIds.has(destinationId)) return;

    const stop = createRouteStop(destinationId);
    setRouteStops((current) => [...current, stop]);
    setPreviewDestinationId(destinationId);
  }

  function removeStop(stopId: string) {
    setRouteStops((current) => current.filter((stop) => stop.id !== stopId));
  }

  function updateStop(stopId: string, patch: Partial<RouteStop>) {
    setRouteStops((current) =>
      current.map((stop) => (stop.id === stopId ? { ...stop, ...patch } : stop))
    );
  }

  function applyAiPlan(plan: ClientJourneyPlan) {
    const nextStops = plan.routeStops.map((stop) => {
      const seed = createRouteStop(stop.destinationId);
      return {
        ...seed,
        nights: stop.nights,
        hotelId: stop.hotelId || seed.hotelId,
      };
    });

    setTravelDate(plan.travelDate);
    setPax(plan.pax);
    setAccommodationMode(plan.accommodationMode);
    setTransportSelectionId(plan.transportSelectionId);
    setMealSelectionId(plan.mealSelectionId);
    setMealRequest(plan.mealRequest);
    setRouteStops(nextStops);
    setPreviewDestinationId(nextStops[0]?.destinationId ?? "airport");
    setBuilderStep("summary");
  }

  async function handleAiDraft() {
    if (!aiConciergeEnabled) {
      setAiStatus("AI concierge is not enabled right now.");
      return;
    }

    if (!aiPrompt.trim()) {
      setError("Describe the trip you want before asking AI to draft it.");
      return;
    }

    setError("");
    setAiStatus("");
    setAiGenerating(true);

    const result = await generateClientJourneyPlanAction({
      prompt: aiPrompt,
      travelDate,
      pax,
      routeStops: routeStops.map((stop) => ({
        destinationId: stop.destinationId,
        nights: stop.nights,
        hotelId: stop.hotelId,
      })),
      accommodationMode,
      transportSelectionId,
      mealSelectionId,
      mealRequest,
    });

    setAiGenerating(false);

    if (!result.ok || !result.plan) {
      setAiStatus(result.message);
      return;
    }

    applyAiPlan(result.plan);
    setAiStatus(result.message);
    setAiSummary(result.plan.summary);
    setAiQuestions(result.plan.followUpQuestions);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!travelDate) {
      setError("Choose the guest travel date before confirming.");
      return;
    }

    if (!name.trim() || !email.trim()) {
      setError("Enter the guest name and email before confirming.");
      return;
    }

    if (routeDetails.length === 0) {
      setError("Add at least one destination before confirming.");
      return;
    }

    setSubmitting(true);

    const result = await createCustomRouteRequestAction({
      name,
      email,
      phone,
      travelDate,
      pax,
      desiredNights: pricing.totalNights,
      stayStyle:
        accommodationMode === "choose"
          ? "Guest-selected accommodation"
          : "Best available accommodation",
      transportLabel: selectedTransport?.label ?? "No transport required",
      mealLabel: selectedMeal?.label ?? "No meal plan",
      mealRequest,
      accommodationMode,
      guidanceFee: pricing.guidanceFee,
      guidanceLabel,
      routeStops: routeDetails.map((stop) => ({
        destinationId: stop.destination.id,
        destinationName: stop.destination.name,
        nights: stop.nights,
        hotelName: stop.selectedHotel?.name,
        hotelId: stop.selectedHotel?.id,
        hotelRate: stop.selectedHotel?.pricePerNight,
        hotelCurrency: stop.selectedHotel?.currency,
        activities: stop.activities.map((activity) => activity.title),
        legDistanceKm: stop.leg?.distanceKm,
        legDriveHours: stop.leg?.driveHours,
      })),
      estimatedTotal: pricing.total,
      estimatedCurrency: pricing.currency,
      totalDriveHours,
      notes,
    });

    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    router.push(
      result.reference
        ? `/booking-confirmed?ref=${encodeURIComponent(result.reference)}`
        : "/booking-confirmed"
    );
    router.refresh();
  }

  return (
    <div className="space-y-6 pb-16">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-[#12343b] text-[#f7ead7] shadow-[0_28px_70px_-34px_rgba(18,52,59,0.95)]">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(circle at 12% 18%, rgba(220,184,123,0.26), transparent 24%), radial-gradient(circle at 86% 12%, rgba(97,160,172,0.24), transparent 20%), linear-gradient(135deg, rgba(18,52,59,0.98), rgba(18,52,59,0.84))",
          }}
        />
        <div className="relative grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-[#efd5aa]">
              <Sparkles className="h-3.5 w-3.5" />
              Craft your Sri Lanka journey
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
              Build the route first, then confirm the details.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#e5dccd]">
              Choose your dates, add the destinations you want, then pick transport,
              stays, and meal style. Before you confirm, you get a clean route summary
              with the map, hotel choices, optional activities, and the full price.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-[1.5rem] border border-white/12 bg-white/10 px-4 py-4">
              <CalendarDays className="h-5 w-5 text-[#efd5aa]" />
              <p className="mt-3 text-sm font-medium">Any travel date</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/12 bg-white/10 px-4 py-4">
              <CarFront className="h-5 w-5 text-[#efd5aa]" />
              <p className="mt-3 text-sm font-medium">Car, van, or no vehicle</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/12 bg-white/10 px-4 py-4">
              <BedDouble className="h-5 w-5 text-[#efd5aa]" />
              <p className="mt-3 text-sm font-medium">Pick hotels or let us choose</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.9rem] border border-[#d8c2a4] bg-white/76 p-6 shadow-[0_20px_48px_-34px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
              AI concierge
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
              Describe the trip once. AI drafts the route A-Z.
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Tell the concierge the dates, number of guests, destinations, transport,
              meal plan, and hotel preference. It will draft the whole journey builder,
              then send you straight to the summary to review the map, pricing, and route.
            </p>
          </div>
          <div className="rounded-[1.35rem] border border-[#ead7be] bg-[#fbf3e6] px-4 py-4 text-sm text-stone-600">
            <p className="font-semibold text-stone-900">Uses live trip options</p>
            <p className="mt-2 leading-6">
              Sri Lanka routing, saved hotels, transport choices, meal plans, and the
              current guidance fee all feed the AI draft.
            </p>
          </div>
        </div>

        <label className="mt-6 block">
          <span className="text-sm font-medium text-stone-700">
            Tell AI what the guest wants
          </span>
          <textarea
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
            rows={5}
            placeholder="Example: We are 2 adults traveling in July for 8 nights. Start with Sigiriya, then Kandy, Ella, and end on the south coast. We want a chauffeur car, boutique hotels, and half board."
            className="mt-1 w-full rounded-[1.5rem] border border-[#ddc8b0] bg-[#fffaf4] px-4 py-4 text-sm text-stone-900 outline-none transition focus:border-[#12343b] focus:ring-4 focus:ring-[#12343b]/10"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          {conciergePromptExamples.map((example, index) => (
            <button
              key={example}
              type="button"
              onClick={() => setAiPrompt(example)}
              className="rounded-full border border-[#ddc8b0] bg-white px-3 py-2 text-left text-xs font-medium text-stone-700 transition hover:border-[#12343b] hover:text-[#12343b]"
            >
              Sample {index + 1}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleAiDraft}
            disabled={!aiConciergeEnabled || aiGenerating}
            className="inline-flex items-center gap-2 rounded-full bg-[#12343b] px-5 py-3 text-sm font-semibold text-[#f7ead7] shadow-[0_18px_44px_-26px_rgba(18,52,59,0.92)] transition hover:bg-[#0f2b31] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {aiGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {aiGenerating ? "Drafting journey..." : "Draft my whole journey"}
          </button>
          <p className="text-sm text-stone-500">
            You can still edit every step manually after the AI draft is applied.
          </p>
        </div>

        {!aiConciergeEnabled ? (
          <div className="mt-5 rounded-[1.3rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            AI concierge is visible, but it is not configured yet on this local app.
            Enable AI in Admin Settings and add a working provider key to use the button.
          </div>
        ) : null}

        {aiStatus ? (
          <div className="mt-5 rounded-[1.3rem] border border-[#ead7be] bg-[#fbf3e6] px-4 py-4 text-sm text-stone-700">
            {aiStatus}
          </div>
        ) : null}

        {aiSummary || aiQuestions.length > 0 ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            {aiSummary ? (
              <div className="rounded-[1.3rem] border border-[#ead7be] bg-[#fffaf4] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[#8c6a38]">
                  AI draft summary
                </p>
                <p className="mt-3 text-sm leading-6 text-stone-700">
                  {aiSummary}
                </p>
              </div>
            ) : null}
            {aiQuestions.length > 0 ? (
              <div className="rounded-[1.3rem] border border-[#ead7be] bg-[#fffaf4] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[#8c6a38]">
                  AI still needs
                </p>
                <div className="mt-3 space-y-2">
                  {aiQuestions.map((question) => (
                    <p key={question} className="text-sm leading-6 text-stone-700">
                      {question}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="flex flex-wrap gap-3">
        {builderSteps.map((step, index) => (
          <StepButton
            key={step.id}
            current={builderStep === step.id}
            done={index < currentStepIndex}
            label={step.label}
            summary={step.summary}
            onClick={() => goToStep(step.id)}
          />
        ))}
      </section>

      {error ? (
        <div className="rounded-[1.2rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
        <div className="space-y-6">
          {builderStep === "trip" ? (
            <section className="rounded-[1.8rem] border border-[#ddc8b0] bg-white/74 p-6 shadow-[0_20px_48px_-34px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-7">
              <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
                Step 1
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
                Start with the guest details
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
                Keep this simple: set the travel date and the number of guests first.
                The route, hotels, transport, meals, and summary come next.
              </p>

              <div className="mt-6 grid gap-5 sm:grid-cols-[1fr_auto]">
                <label className="block">
                  <span className="text-sm font-medium text-stone-700">
                    Travel date
                  </span>
                  <input
                    type="date"
                    value={travelDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => setTravelDate(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-[#ddc8b0] bg-[#fffaf4] px-4 py-3 text-stone-900 outline-none transition focus:border-[#12343b] focus:ring-4 focus:ring-[#12343b]/10"
                  />
                </label>

                <div className="rounded-[1.4rem] border border-[#ddc8b0] bg-[#fffaf4] px-4 py-4">
                  <p className="text-sm font-medium text-stone-700">Guests</p>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPax((current) => Math.max(1, current - 1))}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d8c2a4] bg-white text-stone-700 transition hover:border-[#12343b] hover:text-[#12343b]"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <div className="min-w-[5rem] text-center">
                      <p className="text-2xl font-semibold text-stone-900">{pax}</p>
                      <p className="text-xs uppercase tracking-[0.22em] text-stone-400">
                        traveler{pax === 1 ? "" : "s"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPax((current) => current + 1)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d8c2a4] bg-white text-stone-700 transition hover:border-[#12343b] hover:text-[#12343b]"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.35rem] border border-[#ead7be] bg-[#fbf3e6] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-[#8c6a38]">
                    Start point
                  </p>
                  <p className="mt-2 font-semibold text-stone-900">
                    Bandaranaike Airport
                  </p>
                </div>
                <div className="rounded-[1.35rem] border border-[#ead7be] bg-[#fbf3e6] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-[#8c6a38]">
                    Guidance fee
                  </p>
                  <p className="mt-2 font-semibold text-stone-900">
                    {currencyFormat(guidanceFee, estimateCurrency)}
                  </p>
                </div>
                <div className="rounded-[1.35rem] border border-[#ead7be] bg-[#fbf3e6] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-[#8c6a38]">
                    Vehicle
                  </p>
                  <p className="mt-2 font-semibold text-stone-900">
                    Optional
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {builderStep === "route" ? (
            <section className="space-y-6">
              <div className="rounded-[1.8rem] border border-[#ddc8b0] bg-white/74 p-6 shadow-[0_20px_48px_-34px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-7">
                <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
                  Step 2
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
                  Choose the route
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
                  Click the map or use the quick suggestions. Every new stop respects
                  a comfortable transfer from the current route anchor.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {quickSuggestions.map(({ destination, leg }) => (
                    <button
                      type="button"
                      key={destination.id}
                      onClick={() =>
                        addStop(destination.id as Exclude<PlannerDestinationId, "airport">)
                      }
                      className="rounded-[1.3rem] border border-[#ddc8b0] bg-[#fffaf4] p-4 text-left transition hover:border-[#12343b] hover:bg-white"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`text-sm font-semibold ${getDestinationAccent(destination.id)}`}>
                            {destination.name}
                          </p>
                          <p className="mt-1 text-sm text-stone-500">
                            {destination.region}
                          </p>
                        </div>
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#12343b] text-[#f7ead7]">
                          {renderDestinationIcon(destination.id, "h-4 w-4")}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-stone-600">
                        {destination.summary}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.22em] text-[#8c6a38]">
                        {leg.distanceKm} km · {leg.driveHours.toFixed(1)} h
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-[#ddc8b0] bg-white/74 p-6 shadow-[0_20px_48px_-34px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-7">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
                      Selected route
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
                      {routeDetails.length === 0
                        ? "No stops yet"
                        : `${routeDetails.length} stop${routeDetails.length === 1 ? "" : "s"} · ${pricing.totalNights} nights`}
                    </h3>
                  </div>
                </div>

                {routeDetails.length === 0 ? (
                  <div className="mt-5 rounded-[1.3rem] border border-dashed border-[#d8c2a4] bg-[#fbf3e6] px-4 py-5 text-sm text-stone-600">
                    Start by adding the first destination after the airport.
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {routeDetails.map((stop, index) => (
                      <div
                        key={stop.id}
                        className="rounded-[1.35rem] border border-[#ead7be] bg-[#fffaf4] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-xs uppercase tracking-[0.22em] text-[#8c6a38]">
                              Stop {index + 1}
                            </p>
                            <h4 className="mt-2 text-lg font-semibold text-stone-900">
                              {stop.destination.name}
                            </h4>
                            <p className="mt-1 text-sm text-stone-500">
                              {stop.leg
                                ? `${stop.leg.distanceKm} km · ${stop.leg.driveHours.toFixed(1)} h from ${
                                    index === 0
                                      ? "airport"
                                      : routeDetails[index - 1].destination.name
                                  }`
                                : stop.destination.region}
                            </p>
                            <p className="mt-2 text-sm text-stone-600">
                              {stop.selectedHotel
                                ? `${stop.selectedHotel.name} · ${currencyFormat(
                                    stop.selectedHotel.pricePerNight,
                                    stop.selectedHotel.currency
                                  )} per night`
                                : "Hotel will be selected in the next step."}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateStop(stop.id, {
                                  nights: Math.max(1, stop.nights - 1),
                                })
                              }
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d8c2a4] bg-white text-stone-700 transition hover:border-[#12343b] hover:text-[#12343b]"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="min-w-[4.5rem] text-center text-sm font-semibold text-stone-900">
                              {stop.nights} night{stop.nights === 1 ? "" : "s"}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateStop(stop.id, {
                                  nights: Math.min(6, stop.nights + 1),
                                })
                              }
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d8c2a4] bg-white text-stone-700 transition hover:border-[#12343b] hover:text-[#12343b]"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeStop(stop.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600 transition hover:border-rose-300 hover:bg-rose-100"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {builderStep === "choices" ? (
            <section className="space-y-6">
              <div className="rounded-[1.8rem] border border-[#ddc8b0] bg-white/74 p-6 shadow-[0_20px_48px_-34px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-7">
                <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
                  Step 3
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
                  Pick the travel choices
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
                  Keep it simple: choose how transport should work, whether meals are needed,
                  and if the guest wants to pick hotels directly or leave that to the team.
                </p>
              </div>

              <div className="rounded-[1.8rem] border border-[#ddc8b0] bg-white/74 p-6 shadow-[0_20px_48px_-34px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-7">
                <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
                  Accommodation
                </p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <ChoiceCard
                    title="Let the team choose"
                    summary="We keep the best available stay selected in each destination based on the saved supplier and package rates."
                    selected={accommodationMode === "auto"}
                    icon={<ConciergeBell className="h-5 w-5" />}
                    onClick={() => setAccommodationMode("auto")}
                  />
                  <ChoiceCard
                    title="Choose every hotel"
                    summary="The guest picks the stay in each destination from the available accommodation list."
                    selected={accommodationMode === "choose"}
                    icon={<BedDouble className="h-5 w-5" />}
                    onClick={() => setAccommodationMode("choose")}
                  />
                </div>

                {accommodationMode === "choose" ? (
                  <div className="mt-5 space-y-3">
                    {routeDetails.map((stop) => (
                      <div
                        key={stop.id}
                        className="rounded-[1.25rem] border border-[#ead7be] bg-[#fffaf4] p-4"
                      >
                        <p className="text-sm font-semibold text-stone-900">
                          {stop.destination.name}
                        </p>
                        <select
                          value={stop.hotelId}
                          onChange={(event) =>
                            updateStop(stop.id, { hotelId: event.target.value })
                          }
                          className="mt-3 w-full rounded-2xl border border-[#ddc8b0] bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#12343b] focus:ring-4 focus:ring-[#12343b]/10"
                        >
                          {stop.hotelChoices.map((hotel) => (
                            <option key={hotel.id} value={hotel.id}>
                              {hotel.name} · {currencyFormat(hotel.pricePerNight, hotel.currency)} / night
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-[1.25rem] border border-[#ead7be] bg-[#fbf3e6] px-4 py-4 text-sm text-stone-600">
                    The summary will show the best available hotel selected for each stop.
                  </div>
                )}
              </div>

              <div className="rounded-[1.8rem] border border-[#ddc8b0] bg-white/74 p-6 shadow-[0_20px_48px_-34px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-7">
                <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
                  Transport
                </p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <ChoiceCard
                    title="No transport required"
                    summary="The guest will arrange their own transport."
                    selected={transportSelectionId === "none"}
                    icon={<CarFront className="h-5 w-5" />}
                    onClick={() => setTransportSelectionId("none")}
                  />
                  {transportOptions.map((option) => (
                    <ChoiceCard
                      key={option.id}
                      title={option.label}
                      summary={option.description}
                      priceLabel={currencyFormat(option.price, option.currency)}
                      selected={transportSelectionId === option.id}
                      icon={<CarFront className="h-5 w-5" />}
                      onClick={() => setTransportSelectionId(option.id)}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-[#ddc8b0] bg-white/74 p-6 shadow-[0_20px_48px_-34px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-7">
                <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
                  Meal plan
                </p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <ChoiceCard
                    title="No meal plan"
                    summary="The guest will eat independently."
                    selected={mealSelectionId === "none"}
                    icon={<Soup className="h-5 w-5" />}
                    onClick={() => setMealSelectionId("none")}
                  />
                  {mealOptions.map((option) => (
                    <ChoiceCard
                      key={option.id}
                      title={option.label}
                      summary={option.description}
                      priceLabel={currencyFormat(option.price, option.currency)}
                      selected={mealSelectionId === option.id}
                      icon={<Soup className="h-5 w-5" />}
                      onClick={() => setMealSelectionId(option.id)}
                    />
                  ))}
                </div>

                <label className="mt-5 block">
                  <span className="text-sm font-medium text-stone-700">
                    Custom meal notes
                  </span>
                  <textarea
                    value={mealRequest}
                    onChange={(event) => setMealRequest(event.target.value)}
                    rows={3}
                    placeholder="Dietary requests, child meals, vegetarian preference, no seafood, late-arrival dinner, and similar notes."
                    className="mt-1 w-full rounded-2xl border border-[#ddc8b0] bg-[#fffaf4] px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#12343b] focus:ring-4 focus:ring-[#12343b]/10"
                  />
                </label>
              </div>
            </section>
          ) : null}

          {builderStep === "summary" ? (
            <form ref={summaryFormRef} onSubmit={handleSubmit} className="space-y-6">
              <section className="rounded-[1.8rem] border border-[#ddc8b0] bg-white/74 p-6 shadow-[0_20px_48px_-34px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-7">
                <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
                  Step 4
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
                  Review the journey summary
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
                  This is the final review before confirmation. The activities below are
                  suggested experiences on the route and are not included in the total unless
                  your team adds them later.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-[1.3rem] border border-[#ead7be] bg-[#fbf3e6] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#8c6a38]">
                      Travel date
                    </p>
                    <p className="mt-2 font-semibold text-stone-900">{travelDate}</p>
                  </div>
                  <div className="rounded-[1.3rem] border border-[#ead7be] bg-[#fbf3e6] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#8c6a38]">
                      Guests
                    </p>
                    <p className="mt-2 font-semibold text-stone-900">
                      {pax} traveler{pax === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="rounded-[1.3rem] border border-[#ead7be] bg-[#fbf3e6] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#8c6a38]">
                      Route
                    </p>
                    <p className="mt-2 font-semibold text-stone-900">
                      {routeDetails.length} stop{routeDetails.length === 1 ? "" : "s"} · {pricing.totalNights} nights
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.8rem] border border-[#ddc8b0] bg-white/74 p-6 shadow-[0_20px_48px_-34px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
                      Price summary
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
                      {currencyFormat(pricing.total, pricing.currency)}
                    </h3>
                  </div>
                  <div className="rounded-full bg-[#12343b] px-4 py-2 text-sm font-semibold text-[#f7ead7]">
                    {guidanceLabel}
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {pricing.lineItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 rounded-[1.2rem] border border-[#ead7be] bg-[#fffaf4] px-4 py-3"
                    >
                      <span className="text-sm font-medium text-stone-700">
                        {item.label}
                      </span>
                      <span className="text-sm font-semibold text-stone-900">
                        {currencyFormat(item.amount, pricing.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[1.8rem] border border-[#ddc8b0] bg-white/74 p-6 shadow-[0_20px_48px_-34px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-7">
                <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
                  Route details
                </p>
                <div className="mt-5 space-y-4">
                  {routeDetails.map((stop, index) => (
                    <div
                      key={stop.id}
                      className="rounded-[1.35rem] border border-[#ead7be] bg-[#fffaf4] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-[#8c6a38]">
                            Stop {index + 1}
                          </p>
                          <h4 className="mt-2 text-lg font-semibold text-stone-900">
                            {stop.destination.name}
                          </h4>
                          <p className="mt-1 text-sm text-stone-500">
                            {stop.nights} night{stop.nights === 1 ? "" : "s"}
                            {stop.leg
                              ? ` · ${stop.leg.distanceKm} km / ${stop.leg.driveHours.toFixed(1)} h`
                              : ""}
                          </p>
                        </div>
                        {stop.selectedHotel ? (
                          <div className="rounded-2xl bg-[#f1e0c1] px-4 py-3 text-right">
                            <p className="text-xs uppercase tracking-[0.22em] text-[#8c6a38]">
                              Stay
                            </p>
                            <p className="mt-1 text-sm font-semibold text-stone-900">
                              {stop.selectedHotel.name}
                            </p>
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {stop.activities.map((activity) => (
                          <span
                            key={activity.id}
                            className="rounded-full border border-[#ddc8b0] bg-white px-3 py-1.5 text-xs font-medium text-stone-700"
                          >
                            {activity.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[1.8rem] border border-[#ddc8b0] bg-white/74 p-6 shadow-[0_20px_48px_-34px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-7">
                <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
                  Confirm request
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-stone-700">Guest name</span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[#ddc8b0] bg-[#fffaf4] px-4 py-3 text-stone-900 outline-none transition focus:border-[#12343b] focus:ring-4 focus:ring-[#12343b]/10"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-stone-700">Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[#ddc8b0] bg-[#fffaf4] px-4 py-3 text-stone-900 outline-none transition focus:border-[#12343b] focus:ring-4 focus:ring-[#12343b]/10"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-stone-700">Phone</span>
                    <input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[#ddc8b0] bg-[#fffaf4] px-4 py-3 text-stone-900 outline-none transition focus:border-[#12343b] focus:ring-4 focus:ring-[#12343b]/10"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-stone-700">
                      Extra notes
                    </span>
                    <input
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[#ddc8b0] bg-[#fffaf4] px-4 py-3 text-stone-900 outline-none transition focus:border-[#12343b] focus:ring-4 focus:ring-[#12343b]/10"
                      placeholder="Airport arrival time, child seat, birthday dinner, and similar notes."
                    />
                  </label>
                </div>

                <div className="mt-5 rounded-[1.25rem] border border-[#ead7be] bg-[#fbf3e6] px-4 py-4 text-sm text-stone-600">
                  The system will create a custom journey request in admin with the route,
                  selected hotels, transport, meal preference, estimated total, and suggested
                  activities for your team to review.
                </div>
              </section>
            </form>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={currentStepIndex === 0 || submitting}
              className="inline-flex items-center gap-2 rounded-full border border-[#ddc8b0] bg-white/72 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-[#12343b] hover:text-[#12343b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>

            {builderStep === "summary" ? (
              <button
                type="button"
                onClick={() => summaryFormRef.current?.requestSubmit()}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-[#12343b] px-6 py-3 text-sm font-semibold text-[#f7ead7] shadow-[0_18px_44px_-26px_rgba(18,52,59,0.92)] transition hover:bg-[#0f2b31] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Sending request…" : "Confirm journey request"}
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center gap-2 rounded-full bg-[#12343b] px-6 py-3 text-sm font-semibold text-[#f7ead7] shadow-[0_18px_44px_-26px_rgba(18,52,59,0.92)] transition hover:bg-[#0f2b31]"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-5 xl:sticky xl:top-28 xl:self-start">
          <JourneyMap
            destinations={mapDestinations}
            routeSegments={routeSegments}
            suggestionSegments={suggestionSegments}
            previewDestinationId={previewDestination.id}
            previewDestinationName={previewDestination.name}
            previewDestinationRegion={previewDestination.region}
            currentAnchorName={currentAnchor.name}
            totalStops={routeDetails.length}
            totalNights={pricing.totalNights}
            onSelectDestination={(destinationId) => setPreviewDestinationId(destinationId)}
          />

          <div className="rounded-[1.8rem] border border-[#ddc8b0] bg-white/74 p-5 shadow-[0_20px_48px_-34px_rgba(43,32,15,0.5)] backdrop-blur-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
                  On the map
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
                  {previewDestination.name}
                </h3>
                <p className="mt-1 text-sm text-stone-500">
                  {previewDestination.region}
                </p>
              </div>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#12343b] text-[#f7ead7]">
                {renderDestinationIcon(previewDestination.id, "h-5 w-5")}
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-stone-600">
              {previewDestination.id === "airport"
                ? previewDestination.arrivalNote
                : previewDestination.summary}
            </p>

            {previewLeg ? (
              <div className="mt-4 rounded-[1.25rem] border border-[#ead7be] bg-[#fbf3e6] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[#8c6a38]">
                  Transfer
                </p>
                <p className="mt-2 text-sm font-semibold text-stone-900">
                  {previewLeg.distanceKm} km · {previewLeg.driveHours.toFixed(1)} h
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  {previewLeg.scenicNote}
                </p>
              </div>
            ) : null}

            {previewDestination.id !== "airport" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.2rem] border border-[#ead7be] bg-[#fffaf4] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#8c6a38]">
                    Suggested hotel
                  </p>
                  <p className="mt-2 text-sm font-semibold text-stone-900">
                    {previewRouteStop?.selectedHotel?.name ??
                      previewDefaultHotel?.name ??
                      "Select in choices"}
                  </p>
                </div>
                <div className="rounded-[1.2rem] border border-[#ead7be] bg-[#fffaf4] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#8c6a38]">
                    Things to do
                  </p>
                  <p className="mt-2 text-sm font-semibold text-stone-900">
                    {previewActivities.length} suggestion{previewActivities.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            ) : null}

            {previewDestination.id !== "airport" && previewActivities.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {previewActivities.map((activity) => (
                  <span
                    key={activity.id}
                    className="rounded-full border border-[#ddc8b0] bg-white px-3 py-1.5 text-xs font-medium text-stone-700"
                  >
                    {activity.title}
                  </span>
                ))}
              </div>
            ) : null}

            {previewIsAddable ? (
              <button
                type="button"
                onClick={() =>
                  addStop(previewDestination.id as Exclude<PlannerDestinationId, "airport">)
                }
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#12343b] px-5 py-3 text-sm font-semibold text-[#f7ead7] shadow-[0_18px_44px_-26px_rgba(18,52,59,0.92)] transition hover:bg-[#0f2b31]"
              >
                Add {previewDestination.shortName} to the route
                <Plus className="h-4 w-4" />
              </button>
            ) : previewRouteStop ? (
              <div className="mt-5 rounded-full bg-[#eff6f2] px-4 py-3 text-center text-sm font-medium text-[#12343b]">
                Already in the selected journey
              </div>
            ) : null}
          </div>

          <div className="rounded-[1.8rem] border border-[#ddc8b0] bg-white/74 p-5 shadow-[0_20px_48px_-34px_rgba(43,32,15,0.5)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
                  Live summary
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
                  {currencyFormat(pricing.total, pricing.currency)}
                </h3>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#12343b] px-3 py-2 text-sm font-semibold text-[#f7ead7]">
                <Users className="h-4 w-4" />
                {pax}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.2rem] border border-[#ead7be] bg-[#fffaf4] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[#8c6a38]">
                  Nights
                </p>
                <p className="mt-2 text-sm font-semibold text-stone-900">
                  {pricing.totalNights} nights
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-[#ead7be] bg-[#fffaf4] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[#8c6a38]">
                  Drive time
                </p>
                <p className="mt-2 text-sm font-semibold text-stone-900">
                  {totalDriveHours.toFixed(1)} hours
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-[#ead7be] bg-[#fffaf4] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[#8c6a38]">
                  Transport
                </p>
                <p className="mt-2 text-sm font-semibold text-stone-900">
                  {selectedTransport?.label ?? "No transport"}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-[#ead7be] bg-[#fffaf4] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[#8c6a38]">
                  Meals
                </p>
                <p className="mt-2 text-sm font-semibold text-stone-900">
                  {selectedMeal?.label ?? "No meal plan"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
