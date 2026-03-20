"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CarFront,
  Check,
  Mail,
  Minus,
  Mountain,
  Phone,
  PlaneLanding,
  Plus,
  Trash2,
  Trees,
  Waves,
} from "lucide-react";
import type { HotelSupplier, TourPackage } from "@/lib/types";
import { createCustomRouteRequestAction } from "@/app/actions/custom-route-request";
import { JourneyMap } from "./JourneyMap";
import {
  getPlannerDestination,
  getPlannerDestinationCoordinates,
  getPlannerDestinations,
  getPlannerHotelsForDestination,
  getPlannerLeg,
  getSuggestedNextDestinations,
  getSuggestedNightsForDestination,
  pickDefaultPlannerHotel,
  plannerStayStyles,
  plannerTransportProfiles,
  ROUTE_COMFORT_HARD_CAP_HOURS,
  ROUTE_COMFORT_MAX_KM,
  type PlannerDestinationId,
  type PlannerStayStyleId,
  type PlannerTransportId,
} from "@/lib/route-planner";

type RouteStop = {
  id: string;
  destinationId: Exclude<PlannerDestinationId, "airport">;
  nights: number;
  hotelId: string;
};

type JourneyPreset = {
  id: string;
  title: string;
  summary: string;
  bestFor: string;
  tripWindow: string;
  destinationIds: Array<Exclude<PlannerDestinationId, "airport">>;
};

type BuilderStepId = "setup" | "route" | "send";

const airport = getPlannerDestination("airport");
const plannerDestinations = getPlannerDestinations();

const journeyPresets: JourneyPreset[] = [
  {
    id: "classic-highlights",
    title: "Classic Highlights",
    summary: "Culture, tea country, safari, and a softer southern finish.",
    bestFor: "First-time guests who want the main Sri Lanka story in one route.",
    tripWindow: "Best around 7-10 nights",
    destinationIds: ["sigiriya", "kandy", "ella", "yala", "galle"],
  },
  {
    id: "culture-tea",
    title: "Culture and Tea",
    summary: "A calmer inland route focused on heritage and scenic hill-country nights.",
    bestFor: "Guests who prefer scenery and culture over beaches.",
    tripWindow: "Best around 6-9 nights",
    destinationIds: ["negombo", "sigiriya", "kandy", "nuwara-eliya", "ella"],
  },
  {
    id: "south-coast",
    title: "South Coast Easy",
    summary: "A lighter route built around easy beach transfers and fort-town stays.",
    bestFor: "Families and couples wanting a softer route with less driving stress.",
    tripWindow: "Best around 5-8 nights",
    destinationIds: ["bentota", "galle", "mirissa", "tangalle"],
  },
  {
    id: "east-explorer",
    title: "East Explorer",
    summary: "Cultural triangle into Sri Lanka's calmer east-coast beach belt.",
    bestFor: "Guests travelling in the east-coast season who want a different island pace.",
    tripWindow: "Best around 7-9 nights",
    destinationIds: ["negombo", "dambulla", "trincomalee", "pasikuda"],
  },
];

function currencyFormat(value: number, currency: string) {
  return `${Math.round(value).toLocaleString()} ${currency}`;
}

function getEstimatedRooms(pax: number) {
  return Math.max(1, Math.ceil(pax / 2));
}

function getDestinationAccent(destinationId: PlannerDestinationId) {
  if (destinationId === "galle" || destinationId === "pasikuda" || destinationId === "negombo") {
    return "text-[#0f5965]";
  }
  if (destinationId === "yala") {
    return "text-[#3d5f2b]";
  }
  return "text-[#7a4a1f]";
}

function getDestinationSurface(destinationId: PlannerDestinationId) {
  if (
    destinationId === "negombo" ||
    destinationId === "bentota" ||
    destinationId === "galle" ||
    destinationId === "mirissa" ||
    destinationId === "tangalle" ||
    destinationId === "pasikuda" ||
    destinationId === "trincomalee" ||
    destinationId === "arugam-bay" ||
    destinationId === "kalpitiya"
  ) {
    return "bg-[radial-gradient(circle_at_18%_20%,rgba(148,205,215,0.38),transparent_26%),linear-gradient(145deg,#184149,#0f5965)]";
  }

  if (destinationId === "yala") {
    return "bg-[radial-gradient(circle_at_18%_20%,rgba(177,196,110,0.34),transparent_26%),linear-gradient(145deg,#304924,#3d5f2b)]";
  }

  return "bg-[radial-gradient(circle_at_18%_20%,rgba(220,184,123,0.34),transparent_26%),linear-gradient(145deg,#4b2d1b,#7a4a1f)]";
}

function renderDestinationIcon(
  destinationId: PlannerDestinationId,
  className: string
) {
  if (destinationId === "airport") {
    return <PlaneLanding className={className} />;
  }

  if (
    destinationId === "galle" ||
    destinationId === "pasikuda" ||
    destinationId === "negombo"
  ) {
    return <Waves className={className} />;
  }

  if (destinationId === "yala") {
    return <Trees className={className} />;
  }

  return <Mountain className={className} />;
}

function pickPresetStops(
  preset: JourneyPreset,
  desiredNights: number
): Array<Exclude<PlannerDestinationId, "airport">> {
  const result: Array<Exclude<PlannerDestinationId, "airport">> = [];
  let idealNightTotal = 0;

  for (const destinationId of preset.destinationIds) {
    const destination = getPlannerDestination(destinationId);
    result.push(destinationId);
    idealNightTotal += destination.recommendedNights.ideal;

    if (result.length >= 3 && idealNightTotal >= desiredNights) {
      break;
    }
  }

  return result.length > 0 ? result : preset.destinationIds.slice(0, 1);
}

function allocateNights(
  destinationIds: Array<Exclude<PlannerDestinationId, "airport">>,
  desiredNights: number
) {
  const working = destinationIds.map((destinationId) => ({
    destinationId,
    destination: getPlannerDestination(destinationId),
    nights: 1,
  }));

  let remaining = Math.max(desiredNights - working.length, 0);

  for (const stop of working) {
    if (remaining <= 0) break;
    const extraToIdeal = Math.max(stop.destination.recommendedNights.ideal - stop.nights, 0);
    const add = Math.min(extraToIdeal, remaining);
    stop.nights += add;
    remaining -= add;
  }

  for (const stop of working) {
    if (remaining <= 0) break;
    const extraToMax = Math.max(stop.destination.recommendedNights.max - stop.nights, 0);
    const add = Math.min(extraToMax, remaining);
    stop.nights += add;
    remaining -= add;
  }

  return working.map((stop) => ({
    destinationId: stop.destinationId,
    nights: stop.nights,
  }));
}

export function JourneyPlanner({
  hotels,
  packages,
}: {
  hotels: HotelSupplier[];
  packages: TourPackage[];
}) {
  const router = useRouter();
  const estimateCurrency =
    packages[0]?.currency ?? hotels.find((hotel) => hotel.currency)?.currency ?? "USD";
  const stopCounterRef = useRef(0);

  const [selectedPresetId, setSelectedPresetId] = useState<string>(journeyPresets[0].id);
  const [desiredNights, setDesiredNights] = useState(7);
  const [pax, setPax] = useState(2);
  const [stayStyle, setStayStyle] = useState<PlannerStayStyleId>("boutique");
  const [transportId, setTransportId] =
    useState<PlannerTransportId>("premium_van");
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [previewDestinationId, setPreviewDestinationId] =
    useState<PlannerDestinationId>("airport");
  const [builderStep, setBuilderStep] = useState<BuilderStepId>("setup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const transportProfile = useMemo(
    () =>
      plannerTransportProfiles.find((profile) => profile.id === transportId) ??
      plannerTransportProfiles[0],
    [transportId]
  );

  useEffect(() => {
    const preset = journeyPresets.find((item) => item.id === selectedPresetId) ?? journeyPresets[0];
    const destinationIds = pickPresetStops(preset, desiredNights);
    const stopPlan = allocateNights(destinationIds, desiredNights);
    const nextStops: RouteStop[] = stopPlan.map(({ destinationId, nights }) => {
      const hotelChoices = getPlannerHotelsForDestination(destinationId, hotels, packages);
      const defaultHotel = pickDefaultPlannerHotel(hotelChoices, stayStyle);
      stopCounterRef.current += 1;

      return {
        id: `${destinationId}_${stopCounterRef.current}`,
        destinationId,
        nights: Math.max(1, nights),
        hotelId: defaultHotel?.id ?? "",
      };
    });

    setRouteStops(nextStops);
    setPreviewDestinationId(nextStops[0]?.destinationId ?? "airport");
  }, [desiredNights, hotels, packages, selectedPresetId, stayStyle]);

  const routeDestinationIds = useMemo(
    () => routeStops.map((stop) => stop.destinationId as PlannerDestinationId),
    [routeStops]
  );

  const routeDetails = useMemo(
    () =>
      routeStops.map((stop, index) => {
        const destination = getPlannerDestination(stop.destinationId);
        const fromDestinationId =
          index === 0
            ? ("airport" as const)
            : (routeStops[index - 1].destinationId as PlannerDestinationId);
        const leg = getPlannerLeg(fromDestinationId, stop.destinationId);
        const hotelChoices = getPlannerHotelsForDestination(
          stop.destinationId,
          hotels,
          packages
        );
        const selectedHotel =
          hotelChoices.find((hotel) => hotel.id === stop.hotelId) ?? hotelChoices[0] ?? null;

        return {
          ...stop,
          destination,
          leg,
          hotelChoices,
          selectedHotel,
        };
      }),
    [hotels, packages, routeStops]
  );

  const currentAnchor = routeDetails[routeDetails.length - 1]?.destination ?? airport;
  const extensionSuggestions = useMemo(
    () => getSuggestedNextDestinations(routeDestinationIds).slice(0, 3),
    [routeDestinationIds]
  );

  const effectivePreviewDestinationId = useMemo(() => {
    if (previewDestinationId === "airport") {
      return routeDetails[0]?.destination.id ?? "airport";
    }

    const inRoute = routeDetails.some(
      (stop) => stop.destination.id === previewDestinationId
    );
    if (inRoute) {
      return previewDestinationId;
    }

    const isExtension = extensionSuggestions.some(
      (entry) => entry.destination.id === previewDestinationId
    );
    if (isExtension) {
      return previewDestinationId;
    }

    return routeDetails[0]?.destination.id ?? "airport";
  }, [extensionSuggestions, previewDestinationId, routeDetails]);

  const previewDestination = getPlannerDestination(effectivePreviewDestinationId);
  const previewRouteStop =
    routeDetails.find((stop) => stop.destination.id === effectivePreviewDestinationId) ?? null;
  const previewExtension =
    extensionSuggestions.find(
      (entry) => entry.destination.id === effectivePreviewDestinationId
    ) ?? null;
  const previewHotelChoices =
    previewDestination.id === "airport"
      ? []
      : getPlannerHotelsForDestination(previewDestination.id, hotels, packages);
  const previewDefaultHotel =
    previewDestination.id === "airport"
      ? null
      : pickDefaultPlannerHotel(previewHotelChoices, stayStyle);
  const previewLeg = previewRouteStop?.leg ?? previewExtension?.leg ?? null;

  const totalNights = useMemo(
    () => routeDetails.reduce((sum, stop) => sum + stop.nights, 0),
    [routeDetails]
  );

  const departureTransfer =
    routeDetails.length > 0
      ? routeDetails[routeDetails.length - 1].destination.airportTransfer
      : null;

  const totalDriveHours = useMemo(
    () =>
      routeDetails.reduce((sum, stop) => sum + (stop.leg?.driveHours ?? 0), 0) +
      (departureTransfer?.driveHours ?? 0),
    [departureTransfer, routeDetails]
  );

  const hotelEstimate = useMemo(() => {
    const rooms = getEstimatedRooms(pax);
    return routeDetails.reduce((sum, stop) => {
      if (!stop.selectedHotel) return sum;
      return sum + stop.selectedHotel.pricePerNight * stop.nights * rooms;
    }, 0);
  }, [pax, routeDetails]);

  const transportEstimate =
    routeDetails.length > 0
      ? transportProfile.ratePerDay * Math.max(totalNights, routeDetails.length)
      : 0;

  const estimatedTotal = hotelEstimate + transportEstimate;

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
      isAddable: extensionSuggestions.some(
        (entry) => entry.destination.id === destination.id
      ),
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

  const suggestionSegments = extensionSuggestions.map(({ destination }) => ({
    id: `${currentAnchor.id}_${destination.id}`,
    coordinates: [
      getPlannerDestinationCoordinates(currentAnchor.id),
      getPlannerDestinationCoordinates(destination.id),
    ] as [number, number][],
  }));

  const builderSteps: Array<{
    id: BuilderStepId;
    label: string;
    summary: string;
  }> = [
    {
      id: "setup",
      label: "Setup",
      summary: "Choose the trip frame",
    },
    {
      id: "route",
      label: "Route",
      summary: "Shape the island flow",
    },
    {
      id: "send",
      label: "Send",
      summary: "Submit the request",
    },
  ];
  const builderStepIndex = builderSteps.findIndex((step) => step.id === builderStep);

  function selectDestination(destinationId: PlannerDestinationId) {
    setPreviewDestinationId(destinationId);
  }

  function goToStep(step: BuilderStepId) {
    setBuilderStep(step);
  }

  function goToAdjacentStep(offset: 1 | -1) {
    const nextIndex = Math.max(
      0,
      Math.min(builderSteps.length - 1, builderStepIndex + offset)
    );
    goToStep(builderSteps[nextIndex].id);
  }

  function updateStop(stopId: string, updates: Partial<RouteStop>) {
    setRouteStops((current) =>
      current.map((stop) => (stop.id === stopId ? { ...stop, ...updates } : stop))
    );
  }

  function addExtensionStop(destinationId: Exclude<PlannerDestinationId, "airport">) {
    const hotelChoices = getPlannerHotelsForDestination(destinationId, hotels, packages);
    const defaultHotel = pickDefaultPlannerHotel(hotelChoices, stayStyle);
    const nights = Math.max(1, getSuggestedNightsForDestination(destinationId, 2));
    stopCounterRef.current += 1;
    const stopId = `${destinationId}_${stopCounterRef.current}`;

    setRouteStops((current) => [
      ...current,
      {
        id: stopId,
        destinationId,
        nights,
        hotelId: defaultHotel?.id ?? "",
      },
    ]);
    setPreviewDestinationId(destinationId);
  }

  function removeLastStop() {
    const lastStop = routeDetails[routeDetails.length - 1];
    if (!lastStop) return;

    const nextRoute = routeDetails.slice(0, -1);
    setRouteStops((current) => current.filter((stop) => stop.id !== lastStop.id));
    setPreviewDestinationId(nextRoute[nextRoute.length - 1]?.destination.id ?? "airport");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (routeDetails.length === 0) {
      setError("Build at least one stop before sending the journey request.");
      return;
    }

    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }

    setSubmitting(true);

    const result = await createCustomRouteRequestAction({
      name,
      email,
      phone,
      travelDate,
      pax,
      desiredNights,
      stayStyle:
        plannerStayStyles.find((style) => style.id === stayStyle)?.label ?? stayStyle,
      transportLabel: transportProfile.label,
      routeStops: routeDetails.map((stop) => ({
        destinationId: stop.destination.id,
        destinationName: stop.destination.name,
        nights: stop.nights,
        hotelName: stop.selectedHotel?.name,
        hotelId: stop.selectedHotel?.id,
        hotelRate: stop.selectedHotel?.pricePerNight,
        hotelCurrency: stop.selectedHotel?.currency,
        activities: [],
        legDistanceKm: stop.leg?.distanceKm,
        legDriveHours: stop.leg?.driveHours,
      })),
      estimatedTotal,
      estimatedCurrency: estimateCurrency,
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
        <div className="absolute inset-0">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/5/58/20160128_Sri_Lanka_4132_Sinharaja_Forest_Preserve_sRGB_%2825674474901%29.jpg"
            alt="Sri Lanka travel builder"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(118deg,rgba(11,33,38,0.94)_12%,rgba(11,33,38,0.72)_48%,rgba(11,33,38,0.3)_100%)]" />
        </div>

        <div className="relative grid gap-6 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.08fr_0.92fr] lg:px-10 lg:py-12">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.32em] text-[#e5c48e]">
              Travel Builder
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              Build the island route in a calmer, step-by-step way.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#e5dccd] sm:text-base">
              Start with a suggested route, adjust only the stops you want, keep the map as a live
              visual guide, and send the final request once everything feels right.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                "Auto-built route first",
                "Only one step open at a time",
                "Map stays visible",
                "1-night minimum stays",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-[#efe3d0]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-white/12 bg-white/10 p-5 backdrop-blur-md sm:p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-[#e5c48e]">Simple flow</p>
            <div className="mt-4 space-y-4 text-sm leading-6 text-[#e6dccd]">
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f2dfbf] text-xs font-semibold text-[#17343b]">
                  1
                </span>
                <p>Choose the trip frame and let the builder propose a route first.</p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f2dfbf] text-xs font-semibold text-[#17343b]">
                  2
                </span>
                <p>Add or remove stops from the route timeline while the map stays in sync.</p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f2dfbf] text-xs font-semibold text-[#17343b]">
                  3
                </span>
                <p>Review the route, hotel style, and travel notes, then send it to the team.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.96fr)]">
        <div className="space-y-6">
          <section className="rounded-[1.8rem] border border-[#ddc8b0] bg-white/80 p-4 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {builderSteps.map((step, index) => {
                const isActive = builderStep === step.id;
                const isComplete = builderStepIndex > index;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => goToStep(step.id)}
                    className={`rounded-[1.25rem] border px-4 py-4 text-left transition ${
                      isActive
                        ? "border-[#12343b] bg-[#f3e3c7]"
                        : isComplete
                          ? "border-[#c9b28f] bg-[#fbf7f1]"
                          : "border-[#e4d6c4] bg-white hover:border-[#c59e69]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs uppercase tracking-[0.24em] text-[#8c6a38]">
                        Step {index + 1}
                      </span>
                      {isComplete ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#12343b] text-[#f6ead6]">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 font-semibold text-stone-900">{step.label}</p>
                    <p className="mt-1 text-sm text-stone-600">{step.summary}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {builderStep === "setup" ? (
            <section className="rounded-[1.8rem] border border-[#ddc8b0] bg-white/80 p-5 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[#8c6a38]">Trip setup</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
                    Start with a route style, not a blank screen
                  </h2>
                </div>
                <span className="rounded-full bg-[#f2e2c6] px-4 py-2 text-sm font-medium text-[#17343b]">
                  Auto-built route: {routeDetails.length} stop{routeDetails.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-6 grid gap-3 lg:grid-cols-2">
                {journeyPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPresetId(preset.id)}
                    className={`rounded-[1.35rem] border px-4 py-4 text-left transition ${
                      selectedPresetId === preset.id
                        ? "border-[#12343b] bg-[#f3e3c7]"
                        : "border-[#ddc8b0] bg-[#fbf7f1] hover:border-[#c59e69]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-[#8c6a38]">
                          {preset.tripWindow}
                        </p>
                        <p className="mt-2 font-semibold text-stone-900">{preset.title}</p>
                      </div>
                      {selectedPresetId === preset.id ? (
                        <Check className="h-4 w-4 shrink-0 text-[#12343b]" />
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-stone-600">{preset.summary}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#8c6a38]">
                      {preset.bestFor}
                    </p>
                  </button>
                ))}
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.3rem] bg-[#fbf7f1] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-stone-700">Trip length</span>
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#d8c5a7] bg-white px-2 py-1">
                      <button
                        type="button"
                        onClick={() => setDesiredNights((value) => Math.max(3, value - 1))}
                        className="rounded-full p-1 text-stone-600 transition hover:bg-[#f3e7d5]"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-[3rem] text-center text-sm font-semibold text-stone-900">
                        {desiredNights}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDesiredNights((value) => Math.min(14, value + 1))}
                        className="rounded-full p-1 text-stone-600 transition hover:bg-[#f3e7d5]"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-stone-600">
                    Every destination can be reduced to 1 night if needed.
                  </p>
                </div>

                <div className="rounded-[1.3rem] bg-[#fbf7f1] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-stone-700">Travellers</span>
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#d8c5a7] bg-white px-2 py-1">
                      <button
                        type="button"
                        onClick={() => setPax((value) => Math.max(1, value - 1))}
                        className="rounded-full p-1 text-stone-600 transition hover:bg-[#f3e7d5]"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-[3rem] text-center text-sm font-semibold text-stone-900">
                        {pax}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPax((value) => Math.min(8, value + 1))}
                        className="rounded-full p-1 text-stone-600 transition hover:bg-[#f3e7d5]"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-stone-600">
                    Estimated on {getEstimatedRooms(pax)} room
                    {getEstimatedRooms(pax) === 1 ? "" : "s"}.
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-stone-700">Stay style</p>
                  <div className="mt-2 grid gap-2">
                    {plannerStayStyles.map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setStayStyle(style.id)}
                        className={`rounded-[1rem] border px-3 py-3 text-left transition ${
                          stayStyle === style.id
                            ? "border-[#12343b] bg-[#f3e3c7]"
                            : "border-[#ddc8b0] bg-[#fbf7f1] hover:border-[#c59e69]"
                        }`}
                      >
                        <span className="block font-semibold text-stone-900">{style.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-stone-600">
                          {style.summary}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-stone-700">Transport</p>
                  <div className="mt-2 grid gap-2">
                    {plannerTransportProfiles.map((profile) => (
                      <label
                        key={profile.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-[1rem] border px-4 py-4 transition ${
                          transportId === profile.id
                            ? "border-[#12343b] bg-[#f3e3c7]"
                            : "border-[#ddc8b0] bg-[#fbf7f1] hover:border-[#c59e69]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="transportProfile"
                          checked={transportId === profile.id}
                          onChange={() => setTransportId(profile.id)}
                          className="mt-1"
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 font-semibold text-stone-900">
                            <CarFront className="h-4 w-4 text-[#12343b]" />
                            {profile.label}
                          </span>
                          <span className="mt-1 block text-sm text-stone-600">
                            {profile.summary}
                          </span>
                          <span className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-700">
                            {currencyFormat(profile.ratePerDay, estimateCurrency)} / day
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-[1.35rem] border border-[#e5d7c4] bg-[#fbf7f1] p-4">
                <p className="text-sm font-semibold text-stone-900">Current route draft</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {routeDetails.map((stop, index) => (
                    <span
                      key={stop.id}
                      className="inline-flex items-center gap-2 rounded-full border border-[#d7c2a4] bg-white px-3 py-2 text-sm text-stone-700"
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#12343b] text-[11px] font-semibold text-[#f6ead6]">
                        {index + 1}
                      </span>
                      {stop.destination.shortName}
                      <span className="text-stone-400">·</span>
                      {stop.nights}n
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => goToStep("route")}
                  className="inline-flex items-center gap-2 rounded-full bg-[#12343b] px-5 py-3 text-sm font-semibold text-[#f6ead6] transition hover:bg-[#0f2b31]"
                >
                  Continue to route
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          ) : null}

          {builderStep === "route" ? (
            <section className="rounded-[1.8rem] border border-[#ddc8b0] bg-white/80 p-5 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[#8c6a38]">Route builder</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
                    Keep the route simple, then send it
                  </h2>
                </div>
                <span className="rounded-full bg-[#f2e2c6] px-4 py-2 text-sm font-medium text-[#17343b]">
                  {totalNights} nights · {totalDriveHours.toFixed(1)} h driving
                </span>
              </div>

              <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="space-y-4">
                  {routeDetails.map((stop, index) => {
                    const isSelected = previewDestination.id === stop.destination.id;
                    return (
                      <div
                        key={stop.id}
                        className={`rounded-[1.35rem] border px-4 py-4 transition ${
                          isSelected
                            ? "border-[#12343b] bg-[#f3e3c7]"
                            : "border-[#ddc8b0] bg-[#fbf7f1]"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-[#8c6a38]">
                              Stop {index + 1}
                            </p>
                            <p className="mt-1 text-lg font-semibold text-stone-900">
                              {stop.destination.name}
                            </p>
                            <p className="mt-1 text-sm text-stone-600">
                              {stop.leg ? `${stop.leg.distanceKm} km · ${stop.leg.driveHours.toFixed(1)} h in` : "Arrival stop"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => selectDestination(stop.destination.id)}
                            className="rounded-full border border-[#d7c2a4] bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:text-[#12343b]"
                          >
                            Preview on map
                          </button>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-stone-700">
                          <div className="inline-flex items-center gap-2 rounded-full border border-[#d8c5a7] bg-white px-2 py-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateStop(stop.id, {
                                  nights: Math.max(1, stop.nights - 1),
                                })
                              }
                              className="rounded-full p-1 text-stone-600 transition hover:bg-[#f3e7d5]"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="min-w-[3rem] text-center text-sm font-semibold text-stone-900">
                              {stop.nights}n
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateStop(stop.id, {
                                  nights: Math.min(
                                    stop.destination.recommendedNights.max,
                                    stop.nights + 1
                                  ),
                                })
                              }
                              className="rounded-full p-1 text-stone-600 transition hover:bg-[#f3e7d5]"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                          {stop.selectedHotel ? (
                            <span className="rounded-full bg-white px-3 py-1.5">
                              Suggested stay: {stop.selectedHotel.name}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.35rem] border border-[#e5d7c4] bg-[#fbf7f1] p-4">
                    <p className="text-sm font-semibold text-stone-900">
                      Best next stops from {currentAnchor.shortName}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#8c6a38]">
                      Under {ROUTE_COMFORT_MAX_KM} km / {ROUTE_COMFORT_HARD_CAP_HOURS} h
                    </p>
                    <div className="mt-4 space-y-3">
                      {extensionSuggestions.map(({ destination, leg }) => (
                        <button
                          key={destination.id}
                          type="button"
                          onClick={() =>
                            addExtensionStop(destination.id as Exclude<PlannerDestinationId, "airport">)
                          }
                          className="w-full rounded-[1rem] border border-[#ddc8b0] bg-white px-4 py-3 text-left transition hover:border-[#c59e69]"
                        >
                          <p className="font-semibold text-stone-900">{destination.name}</p>
                          <p className="mt-1 text-sm text-stone-600">
                            {leg.distanceKm} km · {leg.driveHours.toFixed(1)} h drive
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#8c6a38]">
                            Add as next stop
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.35rem] border border-[#e5d7c4] bg-[#fbf7f1] p-4 text-sm text-stone-700">
                    Click any marker on the map to preview another region. Only the comfortable next
                    stops are shown as add buttons here. Hotel choice follows your selected stay
                    style automatically.
                  </div>

                  {routeDetails.length > 0 ? (
                    <button
                      type="button"
                      onClick={removeLastStop}
                      className="inline-flex items-center gap-2 rounded-full border border-[#d7c2a4] bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:text-[#12343b]"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove last stop
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={() => goToAdjacentStep(-1)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d7c2a4] bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition hover:text-[#12343b]"
                >
                  Back to setup
                </button>
                <button
                  type="button"
                  onClick={() => goToStep("send")}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#12343b] px-5 py-3 text-sm font-semibold text-[#f6ead6] transition hover:bg-[#0f2b31]"
                >
                  Continue to send
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          ) : null}

          {builderStep === "send" ? (
            <section className="rounded-[1.8rem] border border-[#ddc8b0] bg-white/80 p-5 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[#8c6a38]">Send request</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
                    Review the journey and send it to the team
                  </h2>
                </div>
                <span className="rounded-full bg-[#f2e2c6] px-4 py-2 text-sm font-medium text-[#17343b]">
                  {currencyFormat(estimatedTotal, estimateCurrency)}
                </span>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.15rem] bg-[#fbf7f1] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8c6a38]">Itinerary</p>
                  <p className="mt-2 font-semibold text-stone-900">
                    {routeDetails.length} stop{routeDetails.length === 1 ? "" : "s"} · {totalNights} nights
                  </p>
                </div>
                <div className="rounded-[1.15rem] bg-[#fbf7f1] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8c6a38]">Driving</p>
                  <p className="mt-2 font-semibold text-stone-900">
                    {totalDriveHours.toFixed(1)} total hours
                  </p>
                </div>
                <div className="rounded-[1.15rem] bg-[#fbf7f1] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8c6a38]">Stay style</p>
                  <p className="mt-2 font-semibold text-stone-900">
                    {plannerStayStyles.find((style) => style.id === stayStyle)?.label ?? stayStyle}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[1.35rem] border border-[#e5d7c4] bg-[#fbf7f1] p-4">
                <p className="text-sm font-semibold text-stone-900">Journey summary</p>
                <div className="mt-4 space-y-3">
                  {routeDetails.map((stop, index) => (
                    <div
                      key={stop.id}
                      className="rounded-[1rem] bg-white px-4 py-3 text-sm text-stone-700"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-stone-900">
                            Stop {index + 1} · {stop.destination.name}
                          </p>
                          <p className="mt-1 text-stone-600">
                            {stop.nights} night{stop.nights === 1 ? "" : "s"}
                            {stop.selectedHotel ? ` · ${stop.selectedHotel.name}` : ""}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#f3e3c7] px-3 py-1 text-xs font-medium text-[#17343b]">
                          {transportProfile.label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {departureTransfer ? (
                <div
                  className={`mt-5 rounded-[1.15rem] px-4 py-3 text-sm ${
                    departureTransfer.driveHours > ROUTE_COMFORT_HARD_CAP_HOURS
                      ? "bg-amber-100 text-amber-800"
                      : "bg-[#fbf7f1] text-stone-700"
                  }`}
                >
                  <p className="font-semibold">
                    Final airport transfer: {departureTransfer.distanceKm} km /{" "}
                    {departureTransfer.driveHours.toFixed(1)} h
                  </p>
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
                {error ? (
                  <div className="rounded-[1rem] bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-stone-700">Name</span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="mt-1 w-full rounded-[1rem] border border-[#ddc8b0] bg-white px-4 py-3 focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
                      placeholder="Guest name"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-stone-700">Email</span>
                    <div className="relative mt-1">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="w-full rounded-[1rem] border border-[#ddc8b0] bg-white py-3 pl-11 pr-4 focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
                        placeholder="guest@email.com"
                      />
                    </div>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-stone-700">Phone</span>
                    <div className="relative mt-1">
                      <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                      <input
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        className="w-full rounded-[1rem] border border-[#ddc8b0] bg-white py-3 pl-11 pr-4 focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
                        placeholder="+94 77 123 4567"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-stone-700">Preferred start date</span>
                    <div className="relative mt-1">
                      <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                      <input
                        type="date"
                        value={travelDate}
                        onChange={(event) => setTravelDate(event.target.value)}
                        className="w-full rounded-[1rem] border border-[#ddc8b0] bg-white py-3 pl-11 pr-4 focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
                      />
                    </div>
                  </label>
                </div>

                <label className="block">
                  <span className="text-sm font-medium text-stone-700">Special notes</span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-[1rem] border border-[#ddc8b0] bg-white px-4 py-3 focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
                    placeholder="Flight timing, room preferences, child seats, dietary notes, special requests..."
                  />
                </label>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={() => goToAdjacentStep(-1)}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d7c2a4] bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition hover:text-[#12343b]"
                  >
                    Back to route
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || routeDetails.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#12343b] px-6 py-3.5 font-semibold text-[#f6ead6] shadow-[0_16px_40px_-26px_rgba(18,52,59,0.95)] transition hover:bg-[#0f2b31] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? "Sending request..." : "Send custom journey"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </section>
          ) : null}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <section className="overflow-hidden rounded-[2rem] border border-[#ddc8b0] bg-white/80 shadow-[0_20px_50px_-32px_rgba(43,32,15,0.56)] backdrop-blur-sm">
            <div className="border-b border-[#e6d8c4] px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">Island map</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
                    Live route preview
                  </h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#f2e2c6] px-4 py-2 text-sm font-medium text-[#17343b]">
                  {renderDestinationIcon(previewDestination.id, "h-4 w-4")}
                  {previewDestination.name}
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <JourneyMap
                destinations={mapDestinations}
                routeSegments={routeSegments}
                suggestionSegments={suggestionSegments}
                previewDestinationId={previewDestination.id}
                previewDestinationName={previewDestination.name}
                previewDestinationRegion={previewDestination.region}
                currentAnchorName={currentAnchor.name}
                totalStops={routeDetails.length}
                totalNights={totalNights}
                onSelectDestination={selectDestination}
              />

              <div className="mt-4 grid gap-3 border border-[#dcc8aa] bg-white/65 p-4 sm:grid-cols-3">
                <div className="rounded-[1.2rem] bg-[#fbf7f1] px-4 py-3 text-sm text-stone-700">
                  <span className="block text-xs uppercase tracking-[0.22em] text-[#8c6a38]">
                    Route anchor
                  </span>
                  <span className={`mt-2 block font-semibold ${getDestinationAccent(currentAnchor.id)}`}>
                    {currentAnchor.name}
                  </span>
                </div>
                <div className="rounded-[1.2rem] bg-[#fbf7f1] px-4 py-3 text-sm text-stone-700">
                  <span className="block text-xs uppercase tracking-[0.22em] text-[#8c6a38]">
                    Previewing
                  </span>
                  <span className={`mt-2 block font-semibold ${getDestinationAccent(previewDestination.id)}`}>
                    {previewDestination.name}
                  </span>
                </div>
                <div className="rounded-[1.2rem] bg-[#fbf7f1] px-4 py-3 text-sm text-stone-700">
                  <span className="block text-xs uppercase tracking-[0.22em] text-[#8c6a38]">
                    Trip shape
                  </span>
                  <span className="mt-2 block font-semibold text-stone-900">
                    {routeDetails.length} stop{routeDetails.length === 1 ? "" : "s"} · {totalNights} nights
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section
            className={`rounded-[2rem] border border-[#e0cfb7] p-5 text-[#f7ead7] shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] ${getDestinationSurface(
              previewDestination.id
            )}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[#e5c48e]">
                  {previewDestination.region}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  {renderDestinationIcon(previewDestination.id, "h-5 w-5 text-[#f2dfbf]")}
                  <h3 className="text-2xl font-semibold tracking-tight">
                    {previewDestination.name}
                  </h3>
                </div>
              </div>
              {previewRouteStop ? (
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#f6ead6]">
                  In route
                </span>
              ) : previewExtension ? (
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#f6ead6]">
                  Addable next
                </span>
              ) : null}
            </div>

            <p className="mt-3 text-sm leading-6 text-[#e6dccd]">{previewDestination.summary}</p>

            <p className="mt-4 rounded-[1rem] border border-white/10 bg-white/10 px-4 py-3 text-sm text-[#ece1cf]">
              {previewLeg
                ? `${previewLeg.distanceKm} km · ${previewLeg.driveHours.toFixed(1)} h from the current route context`
                : previewDestination.arrivalNote}
            </p>

            {previewRouteStop ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1rem] bg-white/10 px-4 py-3 text-sm">
                  <p className="text-[#e5c48e]">Stay</p>
                  <p className="mt-1 font-semibold text-[#f7ead7]">
                    {previewRouteStop.nights} night{previewRouteStop.nights === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="rounded-[1rem] bg-white/10 px-4 py-3 text-sm">
                  <p className="text-[#e5c48e]">Hotel</p>
                  <p className="mt-1 font-semibold text-[#f7ead7]">
                    {previewRouteStop.selectedHotel?.name ?? "Auto-picked from stay style"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[1rem] bg-white/10 px-4 py-3 text-sm text-[#ece1cf]">
                Minimum 1 night. Best at {previewDestination.recommendedNights.ideal} night
                {previewDestination.recommendedNights.ideal === 1 ? "" : "s"}.
                {previewDefaultHotel
                  ? ` Default stay: ${previewDefaultHotel.name}.`
                  : ""}
              </div>
            )}

            {previewExtension ? (
              <button
                type="button"
                onClick={() =>
                  addExtensionStop(previewDestination.id as Exclude<PlannerDestinationId, "airport">)
                }
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#f6ead6] px-4 py-2.5 text-sm font-semibold text-[#17343b] transition hover:bg-white"
              >
                Add this stop next
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
