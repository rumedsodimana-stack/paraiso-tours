"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  MapPinned,
  Minus,
  PlaneLanding,
  Plus,
  Sparkles,
  Trash2,
  Trees,
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
import {
  getPlannerActivities,
  getPlannerDestination,
  getPlannerDestinationCoordinates,
  getPlannerDestinations,
  getPlannerHotelsForDestination,
  getPlannerLeg,
  pickDefaultPlannerHotel,
  type PlannerDestinationId,
} from "@/lib/route-planner";
import { ReviewMap } from "./ReviewMap";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type AccommodationMode = "auto" | "choose";

type HotelMode = "pick" | "own";

type TripDay = {
  id: string;
  destinationId: Exclude<PlannerDestinationId, "airport"> | null;
  selectedActivities: string[];
  hotelId: string;
  hotelMode: HotelMode;
  mealPlanId: string;
  notes: string;
};

/* ------------------------------------------------------------------ */
/*  Static data                                                        */
/* ------------------------------------------------------------------ */

const plannerDestinations = getPlannerDestinations().filter((d) => d.id !== "airport");

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function currencyFormat(value: number, currency: string) {
  return `${Math.round(value).toLocaleString()} ${currency}`;
}

function renderDestinationIcon(id: PlannerDestinationId, className: string) {
  if (id === "airport") return <PlaneLanding className={className} />;
  if (["negombo", "galle", "bentota", "mirissa", "pasikuda", "trincomalee"].includes(id))
    return <Waves className={className} />;
  if (id === "yala") return <Trees className={className} />;
  return <MapPinned className={className} />;
}

function formatDate(isoDate: string, dayOffset: number): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  d.setDate(d.getDate() + dayOffset);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SectionAccordion({
  number,
  title,
  subtitle,
  open,
  done,
  onToggle,
  children,
}: {
  number: number;
  title: string;
  subtitle: string;
  open: boolean;
  done: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#ddc8b0] bg-white/80 shadow-sm backdrop-blur-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition active:bg-stone-50"
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            done
              ? "bg-[#12343b] text-[#f7ead7]"
              : open
                ? "bg-[#12343b] text-[#f7ead7]"
                : "bg-stone-100 text-stone-500"
          }`}
        >
          {done && !open ? <Check className="h-4 w-4" /> : number}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-stone-900">{title}</span>
          <span className="block text-sm text-stone-500">{subtitle}</span>
        </span>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-stone-400" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-stone-400" />
        )}
      </button>
      {open && <div className="border-t border-[#ead7be] px-5 pb-6 pt-5">{children}</div>}
    </section>
  );
}

function OptionPill({
  label,
  detail,
  selected,
  onClick,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition ${
        selected
          ? "border-[#12343b] bg-[#12343b] text-white shadow-md"
          : "border-[#ddc8b0] bg-white text-stone-800 hover:border-stone-400"
      }`}
    >
      <span className="block text-sm font-semibold">{label}</span>
      {detail && (
        <span className={`mt-0.5 block text-xs ${selected ? "text-stone-300" : "text-stone-500"}`}>
          {detail}
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

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
  const dayCounterRef = useRef(0);
  const estimateCurrency =
    packages[0]?.currency ?? hotels.find((h) => h.currency)?.currency ?? "USD";

  /* ---- state ---- */
  const [openSection, setOpenSection] = useState(1);
  const [travelDate, setTravelDate] = useState("");
  const [pax, setPax] = useState(2);
  const [days, setDays] = useState<TripDay[]>([]);
  const [accommodationMode, setAccommodationMode] = useState<AccommodationMode>("auto");
  const [transportSelectionId, setTransportSelectionId] = useState("none");
  const [mealSelectionId, setMealSelectionId] = useState("none");
  const [mealRequest, setMealRequest] = useState("");
  const [guestNames, setGuestNames] = useState<string[]>(["", ""]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  /* AI */
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [aiStatusKind, setAiStatusKind] = useState<"idle" | "info" | "error" | "success">("idle");
  const [aiGenerating, setAiGenerating] = useState(false);
  const aiLastCallRef = useRef<number>(0);
  const draftHydratedRef = useRef(false);

  /* ---- Draft persistence (localStorage) ---- */
  const DRAFT_KEY = "paraiso.journey-builder.draft.v1";

  // Hydrate once on mount
  useEffect(() => {
    if (draftHydratedRef.current) return;
    draftHydratedRef.current = true;
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(DRAFT_KEY) : null;
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<{
        travelDate: string;
        pax: number;
        days: TripDay[];
        accommodationMode: AccommodationMode;
        transportSelectionId: string;
        mealSelectionId: string;
        mealRequest: string;
        guestNames: string[];
        email: string;
        phone: string;
        notes: string;
        aiPrompt: string;
      }>;
      if (draft.travelDate) setTravelDate(draft.travelDate);
      if (typeof draft.pax === "number") setPax(draft.pax);
      if (Array.isArray(draft.days) && draft.days.length > 0) setDays(draft.days);
      if (draft.accommodationMode) setAccommodationMode(draft.accommodationMode);
      if (draft.transportSelectionId) setTransportSelectionId(draft.transportSelectionId);
      if (draft.mealSelectionId) setMealSelectionId(draft.mealSelectionId);
      if (typeof draft.mealRequest === "string") setMealRequest(draft.mealRequest);
      if (Array.isArray(draft.guestNames)) setGuestNames(draft.guestNames);
      if (typeof draft.email === "string") setEmail(draft.email);
      if (typeof draft.phone === "string") setPhone(draft.phone);
      if (typeof draft.notes === "string") setNotes(draft.notes);
      if (typeof draft.aiPrompt === "string") setAiPrompt(draft.aiPrompt);
    } catch {
      // Corrupt draft — ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save whenever anything meaningful changes (debounced by React's batching)
  useEffect(() => {
    if (!draftHydratedRef.current) return;
    try {
      const draft = {
        travelDate,
        pax,
        days,
        accommodationMode,
        transportSelectionId,
        mealSelectionId,
        mealRequest,
        guestNames,
        email,
        phone,
        notes,
        aiPrompt,
      };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      }
    } catch {
      // Quota or serialization errors — ignore
    }
  }, [
    travelDate,
    pax,
    days,
    accommodationMode,
    transportSelectionId,
    mealSelectionId,
    mealRequest,
    guestNames,
    email,
    phone,
    notes,
    aiPrompt,
  ]);

  function clearDraft() {
    try {
      if (typeof window !== "undefined") window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  }

  /* ---- derived ---- */
  const transportOptions = useMemo(
    () => getCustomJourneyTransportOptions(hotels, packages, estimateCurrency),
    [estimateCurrency, hotels, packages],
  );
  const mealOptions = useMemo(
    () => getCustomJourneyMealOptions(hotels, packages, estimateCurrency),
    [estimateCurrency, hotels, packages],
  );

  const selectedTransport =
    transportOptions.find((o) => o.id === transportSelectionId) ?? null;
  const selectedMeal =
    mealOptions.find((o) => o.id === mealSelectionId) ?? null;

  // Enrich days with destination data, hotels, activities, transfer info
  const enrichedDays = useMemo(() => {
    return days.map((day, idx) => {
      const dest = day.destinationId ? getPlannerDestination(day.destinationId) : null;
      const hotelChoices = day.destinationId
        ? getPlannerHotelsForDestination(day.destinationId, hotels, packages)
        : [];
      const selectedHotel =
        hotelChoices.find((h) => h.id === day.hotelId) ?? hotelChoices[0] ?? null;
      const allActivities = day.destinationId
        ? getPlannerActivities(day.destinationId)
        : [];

      // Transfer from previous day
      const prevDest = idx > 0 ? days[idx - 1].destinationId : null;
      const isTransfer = !!day.destinationId && day.destinationId !== prevDest;
      const fromId = prevDest ?? "airport";
      const leg = isTransfer && day.destinationId
        ? getPlannerLeg(fromId as PlannerDestinationId, day.destinationId)
        : null;

      return {
        ...day,
        dayNumber: idx + 1,
        destination: dest,
        hotelChoices,
        selectedHotel,
        allActivities,
        isTransfer,
        leg,
      };
    });
  }, [days, hotels, packages]);

  // Convert day-based model to route-stop model for pricing
  const routeStops = useMemo(() => {
    const stops: { destinationId: string; nights: number; hotel: { id: string; name: string; pricePerNight: number; currency: string } | null }[] = [];
    for (const day of enrichedDays) {
      if (!day.destinationId) continue;
      const hotelForPricing = day.hotelMode === "own" ? null
        : day.selectedHotel ? { id: day.selectedHotel.id, name: day.selectedHotel.name, pricePerNight: day.selectedHotel.pricePerNight, currency: day.selectedHotel.currency }
        : null;
      const last = stops[stops.length - 1];
      if (last && last.destinationId === day.destinationId && ((last.hotel === null) === (hotelForPricing === null))) {
        last.nights += 1;
      } else {
        stops.push({
          destinationId: day.destinationId,
          nights: 1,
          hotel: hotelForPricing,
        });
      }
    }
    return stops;
  }, [enrichedDays]);

  const pricing = useMemo(
    () =>
      calculateCustomJourneyPricing({
        pax,
        routeStops,
        transportOption: selectedTransport,
        mealOption: selectedMeal,
        guidanceFee,
        guidanceLabel,
      }),
    [guidanceFee, guidanceLabel, pax, routeStops, selectedMeal, selectedTransport],
  );

  const totalDriveHours = useMemo(() => {
    return enrichedDays.reduce((sum, d) => sum + (d.leg?.driveHours ?? 0), 0);
  }, [enrichedDays]);

  const totalNights = days.length;
  const uniqueDestinations = new Set(days.map((d) => d.destinationId).filter(Boolean));

  // Travel-time feasibility check: warn on long single legs or dense-transit trips.
  const feasibilityWarnings = useMemo(() => {
    const warnings: string[] = [];
    const longLegs = enrichedDays.filter((d) => (d.leg?.driveHours ?? 0) > 6);
    for (const d of longLegs) {
      warnings.push(
        `Day ${d.dayNumber}: ${d.leg?.driveHours.toFixed(1)}h drive — that's a very long transfer. Consider an overnight stop in between.`
      );
    }
    if (totalNights > 0 && totalDriveHours > totalNights * 4) {
      warnings.push(
        `This route has ${totalDriveHours.toFixed(1)}h of driving across ${totalNights} night${totalNights === 1 ? "" : "s"} — over 4h of transit per day on average. You may lose time at the destinations.`
      );
    }
    return warnings;
  }, [enrichedDays, totalDriveHours, totalNights]);

  const mapPoints = useMemo(() => {
    const pts: { name: string; shortName: string; coordinates: [number, number]; dayNumbers: number[]; isAirport?: boolean }[] = [];
    // Airport start
    pts.push({ name: "Bandaranaike Airport", shortName: "Airport", coordinates: getPlannerDestinationCoordinates("airport") as [number, number], dayNumbers: [], isAirport: true });
    // Destinations in order, grouping consecutive same-destination days
    const seen = new Map<string, number>(); // destId -> index in pts
    for (const day of enrichedDays) {
      if (!day.destinationId) continue;
      const existing = seen.get(day.destinationId);
      if (existing !== undefined) {
        pts[existing].dayNumbers.push(day.dayNumber);
      } else {
        const dest = getPlannerDestination(day.destinationId);
        const idx = pts.length;
        pts.push({
          name: dest.name,
          shortName: dest.shortName,
          coordinates: getPlannerDestinationCoordinates(day.destinationId) as [number, number],
          dayNumbers: [day.dayNumber],
        });
        seen.set(day.destinationId, idx);
      }
    }
    return pts;
  }, [enrichedDays]);

  /* ---- actions ---- */
  function createDay(destinationId?: Exclude<PlannerDestinationId, "airport">): TripDay {
    dayCounterRef.current += 1;
    const destId = destinationId ?? null;
    const hotelChoices = destId ? getPlannerHotelsForDestination(destId, hotels, packages) : [];
    const defaultHotel = destId ? pickDefaultPlannerHotel(hotelChoices, "boutique") : null;
    return {
      id: `day_${dayCounterRef.current}`,
      destinationId: destId,
      selectedActivities: [],
      hotelId: defaultHotel?.id ?? "",
      hotelMode: "pick" as HotelMode,
      mealPlanId: "none",
      notes: "",
    };
  }

  function addDay(destinationId?: Exclude<PlannerDestinationId, "airport">) {
    const day = createDay(destinationId);
    setDays((cur) => [...cur, day]);
    setExpandedDay(day.id);
  }

  function duplicateDay(dayId: string) {
    const source = days.find((d) => d.id === dayId);
    if (!source) return;
    dayCounterRef.current += 1;
    const newDay: TripDay = {
      ...source,
      id: `day_${dayCounterRef.current}`,
      selectedActivities: [],
      hotelMode: source.hotelMode,
      notes: "",
    };
    setDays((cur) => {
      const idx = cur.findIndex((d) => d.id === dayId);
      const next = [...cur];
      next.splice(idx + 1, 0, newDay);
      return next;
    });
    setExpandedDay(newDay.id);
  }

  function removeDay(dayId: string) {
    setDays((cur) => cur.filter((d) => d.id !== dayId));
    if (expandedDay === dayId) setExpandedDay(null);
  }

  function updateDay(dayId: string, patch: Partial<TripDay>) {
    setDays((cur) => cur.map((d) => {
      if (d.id !== dayId) return d;
      const updated = { ...d, ...patch };
      // If destination changed, reset hotel to default
      if (patch.destinationId && patch.destinationId !== d.destinationId) {
        const hc = getPlannerHotelsForDestination(patch.destinationId, hotels, packages);
        const dh = pickDefaultPlannerHotel(hc, "boutique");
        updated.hotelId = dh?.id ?? "";
        updated.selectedActivities = [];
      }
      return updated;
    }));
  }

  function toggleActivity(dayId: string, activityId: string) {
    setDays((cur) => cur.map((d) => {
      if (d.id !== dayId) return d;
      const has = d.selectedActivities.includes(activityId);
      return {
        ...d,
        selectedActivities: has
          ? d.selectedActivities.filter((a) => a !== activityId)
          : [...d.selectedActivities, activityId],
      };
    }));
  }

  // Convert day-based to route-stop for submission
  function getRouteStopsForSubmit() {
    const stops: {
      destinationId: string;
      destinationName: string;
      nights: number;
      hotelName?: string;
      hotelId?: string;
      hotelRate?: number;
      hotelCurrency?: string;
      activities: string[];
      legDistanceKm?: number;
      legDriveHours?: number;
    }[] = [];

    for (const day of enrichedDays) {
      if (!day.destination) continue;
      const last = stops[stops.length - 1];
      if (last && last.destinationId === day.destinationId) {
        last.nights += 1;
        for (const act of day.allActivities.filter((a) => day.selectedActivities.includes(a.id))) {
          if (!last.activities.includes(act.title)) last.activities.push(act.title);
        }
      } else {
        stops.push({
          destinationId: day.destination.id,
          destinationName: day.destination.name,
          nights: 1,
          hotelName: day.selectedHotel?.name,
          hotelId: day.selectedHotel?.id,
          hotelRate: day.selectedHotel?.pricePerNight,
          hotelCurrency: day.selectedHotel?.currency,
          activities: day.allActivities.filter((a) => day.selectedActivities.includes(a.id)).map((a) => a.title),
          legDistanceKm: day.leg?.distanceKm,
          legDriveHours: day.leg?.driveHours,
        });
      }
    }
    return stops;
  }

  /* AI plan adapter */
  function applyAiPlan(plan: ClientJourneyPlan) {
    const newDays: TripDay[] = [];
    for (const stop of plan.routeStops) {
      for (let n = 0; n < stop.nights; n++) {
        const d = createDay(stop.destinationId);
        d.hotelId = stop.hotelId || d.hotelId;
        newDays.push(d);
      }
    }
    setTravelDate(plan.travelDate);
    setPax(plan.pax);
    setAccommodationMode(plan.accommodationMode);
    setTransportSelectionId(plan.transportSelectionId);
    setMealSelectionId(plan.mealSelectionId);
    setMealRequest(plan.mealRequest);
    setDays(newDays);
    setOpenSection(4);
  }

  async function handleAiDraft() {
    if (!aiConciergeEnabled) {
      setAiStatusKind("error");
      setAiStatus("AI concierge is not configured.");
      return;
    }
    if (!aiPrompt.trim()) {
      setError("Describe your trip first.");
      return;
    }
    // Debounce: block rapid repeat calls within 1.5s
    const now = Date.now();
    if (now - aiLastCallRef.current < 1500) return;
    aiLastCallRef.current = now;

    setError("");
    setAiStatus("Drafting your journey…");
    setAiStatusKind("info");
    setAiGenerating(true);
    try {
      const result = await generateClientJourneyPlanAction({
        prompt: aiPrompt,
        travelDate,
        pax,
        routeStops: getRouteStopsForSubmit().map((s) => ({
          destinationId: s.destinationId as Exclude<PlannerDestinationId, "airport">,
          nights: s.nights,
          ...(s.hotelId ? { hotelId: s.hotelId } : {}),
        })),
        accommodationMode,
        transportSelectionId,
        mealSelectionId,
        mealRequest,
      });
      setAiGenerating(false);
      if (!result.ok || !result.plan) {
        setAiStatusKind("error");
        setAiStatus(result.message || "The AI could not draft a journey. Try rephrasing your request.");
        return;
      }
      applyAiPlan(result.plan);
      setAiStatusKind("success");
      setAiStatus(result.message);
    } catch (err) {
      setAiGenerating(false);
      setAiStatusKind("error");
      setAiStatus(
        err instanceof Error
          ? `AI error: ${err.message}. Please try again.`
          : "AI concierge failed unexpectedly. Please try again."
      );
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!travelDate) { setError("Please select a travel date."); return; }
    if (!guestNames[0]?.trim() || !email.trim()) { setError("Lead guest name and email are required."); return; }
    if (days.length === 0) { setError("Add at least one day to your trip."); return; }
    const filledDays = days.filter((d) => d.destinationId);
    if (filledDays.length === 0) { setError("Pick a destination for at least one day."); return; }
    setSubmitting(true);
    const submitStops = getRouteStopsForSubmit();
    const result = await createCustomRouteRequestAction({
      name: guestNames[0], email, phone, travelDate, pax,
      desiredNights: pricing.totalNights,
      stayStyle: accommodationMode === "choose" ? "Guest-selected accommodation" : "Best available accommodation",
      transportLabel: selectedTransport?.label ?? "No transport required",
      mealLabel: selectedMeal?.label ?? "No meal plan",
      mealRequest, accommodationMode, guidanceFee, guidanceLabel,
      routeStops: submitStops,
      estimatedTotal: pricing.total, estimatedCurrency: pricing.currency, totalDriveHours,
      notes: [
        guestNames.length > 1 ? `Guests: ${guestNames.filter(Boolean).join(", ")}` : "",
        notes,
      ].filter(Boolean).join("\n"),
    });
    if (!result || result.error) { setError(result?.error ?? "Something went wrong. Please try again."); setSubmitting(false); return; }
    if (!result.reference) { setError("Booking saved but no reference returned. Please contact us."); setSubmitting(false); return; }
    clearDraft();
    router.push(`/booking-confirmed?ref=${encodeURIComponent(result.reference)}`);
    router.refresh();
  }

  const sectionDone = (n: number) => {
    if (n === 1) return !!travelDate;
    if (n === 2) return days.length > 0 && days.some((d) => d.destinationId);
    if (n === 3) return true;
    return false;
  };

  /* ---------------------------------------------------------------- */
  /*  RENDER                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-32">
      {/* ---- Hero ---- */}
      <section className="rounded-2xl bg-[#12343b] px-5 py-6 text-[#f7ead7]">
        <p className="text-xs uppercase tracking-[0.28em] text-[#efd5aa]">
          Custom trip builder
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Plan your Sri Lanka day by day
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-300">
          Add days, pick where you want to be, choose activities, and we&apos;ll arrange everything.
        </p>
      </section>

      {/* ---- AI Quick Build ---- */}
      {aiConciergeEnabled && (
        <details className="group rounded-2xl border border-[#ddc8b0] bg-white/80 backdrop-blur-sm">
          <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-left">
            <Sparkles className="h-5 w-5 shrink-0 text-[#8c6a38]" />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-stone-900">AI Quick Build</span>
              <span className="block text-xs text-stone-500">Describe your trip and let AI plan each day</span>
            </span>
            <ChevronDown className="h-4 w-4 text-stone-400 transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-[#ead7be] px-5 pb-5 pt-4">
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={3}
              placeholder="E.g. 2 adults, 7 nights in July — Sigiriya, Kandy, Ella, south coast beach. Boutique hotels, half board, chauffeur car."
              className="w-full rounded-xl border border-[#ddc8b0] bg-[#fffaf4] px-4 py-3 text-sm text-stone-900 outline-none focus:border-[#12343b] focus:ring-2 focus:ring-[#12343b]/10"
            />
            <button
              type="button"
              onClick={handleAiDraft}
              disabled={aiGenerating}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#12343b] px-4 py-3 text-sm font-semibold text-[#f7ead7] transition hover:bg-[#0f2b31] disabled:opacity-60 sm:w-auto"
            >
              {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {aiGenerating ? "Building..." : "Build my trip"}
            </button>
            {aiStatus && (
              <div
                className={`mt-3 rounded-xl px-4 py-3 text-sm ${
                  aiStatusKind === "error"
                    ? "border border-rose-200 bg-rose-50 text-rose-700"
                    : aiStatusKind === "success"
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border border-stone-200 bg-stone-50 text-stone-700"
                }`}
              >
                <p>{aiStatus}</p>
                {aiStatusKind === "error" && (
                  <button
                    type="button"
                    onClick={handleAiDraft}
                    disabled={aiGenerating}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold underline disabled:opacity-50"
                  >
                    Try again
                  </button>
                )}
              </div>
            )}
          </div>
        </details>
      )}

      {/* ---- Error ---- */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* ================================================================ */}
      {/*  SECTION 1 — When & Who                                          */}
      {/* ================================================================ */}
      <SectionAccordion
        number={1}
        title="When & Who"
        subtitle={travelDate ? `${travelDate} · ${pax} guest${pax === 1 ? "" : "s"}${guestNames[0] ? ` · ${guestNames[0]}` : ""}` : "Set your travel date & group size"}
        open={openSection === 1}
        done={sectionDone(1)}
        onToggle={() => setOpenSection(openSection === 1 ? 0 : 1)}
      >
        <div className="space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-stone-700">Travel date</span>
            <input
              type="date"
              value={travelDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setTravelDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#ddc8b0] bg-[#fffaf4] px-4 py-3 text-stone-900 outline-none focus:border-[#12343b] focus:ring-2 focus:ring-[#12343b]/10"
            />
          </label>

          <div>
            <span className="text-sm font-medium text-stone-700">Guests</span>
            <div className="mt-2 flex items-center gap-4">
              <button type="button" onClick={() => {
                  const next = Math.max(1, pax - 1);
                  setPax(next);
                  setGuestNames((cur) => cur.slice(0, next));
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 text-stone-600 transition hover:border-[#12343b]">
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[3rem] text-center text-2xl font-bold text-stone-900">{pax}</span>
              <button type="button" onClick={() => {
                  const next = pax + 1;
                  setPax(next);
                  setGuestNames((cur) => [...cur, ""]);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 text-stone-600 transition hover:border-[#12343b]">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Guest names */}
          <div>
            <span className="text-sm font-medium text-stone-700">Guest names</span>
            <div className="mt-2 space-y-2">
              {guestNames.map((gn, idx) => (
                <input
                  key={idx}
                  type="text"
                  value={gn}
                  onChange={(e) => {
                    const next = [...guestNames];
                    next[idx] = e.target.value;
                    setGuestNames(next);
                  }}
                  placeholder={idx === 0 ? "Lead guest (full name) *" : `Guest ${idx + 1} name (optional)`}
                  className="w-full rounded-xl border border-[#ddc8b0] bg-[#fffaf4] px-4 py-3 text-sm text-stone-900 outline-none focus:border-[#12343b] focus:ring-2 focus:ring-[#12343b]/10"
                />
              ))}
            </div>
          </div>

          <button type="button"
            onClick={() => { if (!travelDate) { setError("Pick a date first."); return; } if (!guestNames[0]?.trim()) { setError("Lead guest name is required."); return; } setError(""); setOpenSection(2); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#12343b] py-3 text-sm font-semibold text-[#f7ead7] transition hover:bg-[#0f2b31]">
            Next: Choose your vehicle <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </SectionAccordion>

      {/* ================================================================ */}
      {/*  SECTION 2 — Vehicle                                             */}
      {/* ================================================================ */}
      <SectionAccordion
        number={2}
        title="Your Vehicle"
        subtitle={selectedTransport ? selectedTransport.label : "Choose transport for the trip"}
        open={openSection === 2}
        done={true}
        onToggle={() => setOpenSection(openSection === 2 ? 0 : 2)}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <OptionPill label="No transport" detail="I'll arrange my own" selected={transportSelectionId === "none"} onClick={() => setTransportSelectionId("none")} />
            {transportOptions.map((opt) => {
              const cap = opt.capacity ?? 3;
              const fits = cap >= pax;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={!fits}
                  onClick={() => fits && setTransportSelectionId(opt.id)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    !fits
                      ? "border-stone-200 bg-stone-50 opacity-50 cursor-not-allowed"
                      : transportSelectionId === opt.id
                        ? "border-[#12343b] bg-[#12343b] text-white shadow-md"
                        : "border-[#ddc8b0] bg-white text-stone-800 hover:border-stone-400"
                  }`}
                >
                  <span className="block text-sm font-semibold">{opt.label}</span>
                  <span className={`mt-0.5 block text-xs ${transportSelectionId === opt.id && fits ? "text-stone-300" : "text-stone-500"}`}>
                    {opt.price} {opt.currency}/{opt.priceType.replace(/_/g, " ")} · Up to {cap} guest{cap === 1 ? "" : "s"}
                  </span>
                  {!fits && (
                    <span className="mt-1 block text-[10px] text-rose-500">
                      Too small for {pax} guests
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button type="button"
            onClick={() => { setError(""); setOpenSection(3); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#12343b] py-3 text-sm font-semibold text-[#f7ead7] transition hover:bg-[#0f2b31]">
            Next: Plan your days <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </SectionAccordion>

      {/* ================================================================ */}
      {/*  SECTION 3 — Day by Day                                          */}
      {/* ================================================================ */}
      <SectionAccordion
        number={3}
        title="Day by Day"
        subtitle={days.length ? `${days.length} day${days.length === 1 ? "" : "s"} · ${uniqueDestinations.size} destination${uniqueDestinations.size === 1 ? "" : "s"}` : "Build your itinerary"}
        open={openSection === 3}
        done={sectionDone(2)}
        onToggle={() => setOpenSection(openSection === 3 ? 0 : 3)}
      >
        <div className="space-y-3">
          {/* Arrival marker */}
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#12343b]/30 bg-[#12343b]/5 px-4 py-3">
            <PlaneLanding className="h-4 w-4 text-[#12343b]" />
            <div>
              <p className="text-sm font-semibold text-[#12343b]">Arrival — Bandaranaike Airport</p>
              {travelDate && <p className="text-xs text-stone-500">{formatDate(travelDate, 0)}</p>}
            </div>
          </div>

          {/* Day cards */}
          {enrichedDays.map((day) => {
            const isOpen = expandedDay === day.id;
            return (
              <div key={day.id} className="rounded-xl border border-[#ddc8b0] bg-white overflow-hidden">
                {/* Day header — always visible */}
                <button
                  type="button"
                  onClick={() => setExpandedDay(isOpen ? null : day.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-stone-50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#12343b] text-xs font-bold text-[#f7ead7]">
                    {day.dayNumber}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-stone-900">
                        Day {day.dayNumber}
                      </span>
                      {travelDate && (
                        <span className="text-xs text-stone-400">{formatDate(travelDate, day.dayNumber)}</span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500">
                      {day.destination ? (
                        <>
                          {day.isTransfer && day.leg && (
                            <span className="text-[#8c6a38]">
                              {day.leg.distanceKm}km · {day.leg.driveHours.toFixed(1)}h →{" "}
                            </span>
                          )}
                          {day.destination.name}
                          {day.selectedActivities.length > 0 && ` · ${day.selectedActivities.length} activit${day.selectedActivities.length === 1 ? "y" : "ies"}`}
                          {day.hotelMode === "own" && " · Own stay"}
                          {day.mealPlanId !== "none" && (() => { const m = mealOptions.find((o) => o.id === day.mealPlanId); return m ? ` · ${m.label}` : ""; })()}
                        </>
                      ) : (
                        "Tap to choose destination"
                      )}
                    </p>
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
                </button>

                {/* Day expanded content */}
                {isOpen && (
                  <div className="border-t border-[#ead7be] px-4 pb-4 pt-4 space-y-4">
                    {/* Transfer banner */}
                    {day.isTransfer && day.leg && (
                      <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Transfer from {days[day.dayNumber - 2]?.destinationId ? getPlannerDestination(days[day.dayNumber - 2].destinationId!).shortName : "Airport"}: {day.leg.distanceKm} km · {day.leg.driveHours.toFixed(1)}h drive
                      </div>
                    )}

                    {/* Destination picker */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Where are you today?</p>
                      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                        {plannerDestinations.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => updateDay(day.id, { destinationId: d.id as Exclude<PlannerDestinationId, "airport"> })}
                            className={`rounded-lg border px-2 py-2 text-left transition ${
                              day.destinationId === d.id
                                ? "border-[#12343b] bg-[#12343b] text-white"
                                : "border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-400"
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              {renderDestinationIcon(d.id, "h-3 w-3 shrink-0")}
                              <span className="text-xs font-medium truncate">{d.shortName}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Activities */}
                    {day.destination && day.allActivities.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">
                          Things to do in {day.destination.shortName}
                        </p>
                        <div className="space-y-1.5">
                          {day.allActivities.map((act) => {
                            const selected = day.selectedActivities.includes(act.id);
                            return (
                              <button
                                key={act.id}
                                type="button"
                                onClick={() => toggleActivity(day.id, act.id)}
                                className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                                  selected
                                    ? "border-[#12343b] bg-[#12343b]/5"
                                    : "border-stone-200 bg-white hover:border-stone-400"
                                }`}
                              >
                                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] ${
                                  selected
                                    ? "border-[#12343b] bg-[#12343b] text-white"
                                    : "border-stone-300 bg-white"
                                }`}>
                                  {selected && <Check className="h-3 w-3" />}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-stone-900">{act.title}</p>
                                  <p className="mt-0.5 text-xs text-stone-500">{act.summary}</p>
                                  <div className="mt-1.5 flex flex-wrap gap-2 text-[10px]">
                                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">{act.durationLabel}</span>
                                    <span className={`rounded-full px-2 py-0.5 ${
                                      act.energy === "easy" ? "bg-green-50 text-green-700"
                                        : act.energy === "moderate" ? "bg-amber-50 text-amber-700"
                                        : "bg-orange-50 text-orange-700"
                                    }`}>{act.energy}</span>
                                    {act.estimatedPrice > 0 && (
                                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">~{act.estimatedPrice} USD</span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Hotel */}
                    {day.destination && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">
                          Stay tonight (choose hotel)
                        </p>
                        <div className="space-y-1.5">
                          {day.hotelChoices.map((h) => {
                            const isSelected = day.hotelMode === "pick" && day.hotelId === h.id;
                            return (
                              <button
                                key={h.id}
                                type="button"
                                onClick={() => updateDay(day.id, { hotelMode: "pick", hotelId: h.id })}
                                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                                  isSelected
                                    ? "border-[#12343b] bg-[#12343b] text-white"
                                    : "border-stone-200 bg-white text-stone-800 hover:border-stone-400"
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold truncate">{h.name}</p>
                                  <p className={`text-xs ${isSelected ? "text-stone-300" : "text-stone-500"}`}>
                                    {h.pricePerNight} {h.currency}/night
                                  </p>
                                </div>
                                {h.starRating ? (
                                  <span className={`ml-2 shrink-0 text-xs tracking-tight ${isSelected ? "text-yellow-300" : "text-yellow-500"}`}>
                                    {"★".repeat(h.starRating)}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                          {/* I'll book my own */}
                          <button
                            type="button"
                            onClick={() => updateDay(day.id, { hotelMode: "own", hotelId: "" })}
                            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                              day.hotelMode === "own"
                                ? "border-[#12343b] bg-[#12343b] text-white"
                                : "border-stone-200 bg-white text-stone-800 hover:border-stone-400"
                            }`}
                          >
                            <div>
                              <p className="text-sm font-semibold">I&apos;ll book my own</p>
                              <p className={`text-xs ${day.hotelMode === "own" ? "text-stone-300" : "text-stone-500"}`}>
                                No hotel included for this night
                              </p>
                            </div>
                          </button>
                        </div>

                        {/* Meal plan for this day */}
                        {day.hotelMode === "pick" && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1.5">
                              Meal plan
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              <button type="button" onClick={() => updateDay(day.id, { mealPlanId: "none" })}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                  day.mealPlanId === "none"
                                    ? "border-[#12343b] bg-[#12343b] text-white"
                                    : "border-stone-200 bg-white text-stone-600 hover:border-stone-400"
                                }`}>
                                No meals
                              </button>
                              {mealOptions.map((m) => (
                                <button key={m.id} type="button" onClick={() => updateDay(day.id, { mealPlanId: m.id })}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                    day.mealPlanId === m.id
                                      ? "border-[#12343b] bg-[#12343b] text-white"
                                      : "border-stone-200 bg-white text-stone-600 hover:border-stone-400"
                                  }`}>
                                  {m.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Day notes */}
                    <input
                      type="text"
                      value={day.notes}
                      onChange={(e) => updateDay(day.id, { notes: e.target.value })}
                      placeholder="Notes for this day (optional)"
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none focus:border-[#12343b]"
                    />

                    {/* Day actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button type="button" onClick={() => duplicateDay(day.id)}
                        className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
                        + Extra night here
                      </button>
                      <button type="button" onClick={() => removeDay(day.id)}
                        className="ml-auto flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50">
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Departure marker */}
          {days.length > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#12343b]/30 bg-[#12343b]/5 px-4 py-3">
              <PlaneLanding className="h-4 w-4 text-[#12343b]" />
              <div>
                <p className="text-sm font-semibold text-[#12343b]">Departure — Airport transfer</p>
                {travelDate && <p className="text-xs text-stone-500">{formatDate(travelDate, days.length + 1)}</p>}
              </div>
            </div>
          )}

          {/* Add day button */}
          <button
            type="button"
            onClick={() => addDay()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#12343b]/30 py-4 text-sm font-semibold text-[#12343b] transition hover:border-[#12343b]/60 hover:bg-[#12343b]/5"
          >
            <Plus className="h-4 w-4" />
            Add a day
          </button>

          {/* Quick-add popular destinations */}
          {days.length === 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">
                Or quick-start with a destination
              </p>
              <div className="flex flex-wrap gap-2">
                {plannerDestinations.slice(0, 8).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => addDay(d.id as Exclude<PlannerDestinationId, "airport">)}
                    className="flex items-center gap-1.5 rounded-full border border-[#ddc8b0] bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-[#12343b]"
                  >
                    {renderDestinationIcon(d.id, "h-3 w-3")}
                    {d.shortName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Additional notes */}
          {days.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Additional notes</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any special requests, preferences, or notes for your trip..."
                className="w-full rounded-xl border border-[#ddc8b0] bg-[#fffaf4] px-4 py-3 text-sm text-stone-900 outline-none focus:border-[#12343b] focus:ring-2 focus:ring-[#12343b]/10"
              />
            </div>
          )}

          {days.length > 0 && (
            <button type="button"
              onClick={() => { if (!days.some((d) => d.destinationId)) { setError("Pick a destination for at least one day."); return; } setError(""); setOpenSection(4); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#12343b] py-3 text-sm font-semibold text-[#f7ead7] transition hover:bg-[#0f2b31]">
              Review &amp; confirm <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </SectionAccordion>

      {/* ================================================================ */}
      {/*  SECTION 4 — Review & Confirm                                    */}
      {/* ================================================================ */}
      <SectionAccordion
        number={4}
        title="Review & Confirm"
        subtitle="Check your trip and send the request"
        open={openSection === 4}
        done={false}
        onToggle={() => setOpenSection(openSection === 4 ? 0 : 4)}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Travel-time feasibility warnings */}
          {feasibilityWarnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Heads up — the pace may be tight:</p>
              <ul className="mt-1.5 list-disc pl-5 space-y-1">
                {feasibilityWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-stone-100 px-3 py-3 text-center">
              <p className="text-lg font-bold text-stone-900">{totalNights}</p>
              <p className="text-xs text-stone-500">Night{totalNights === 1 ? "" : "s"}</p>
            </div>
            <div className="rounded-xl bg-stone-100 px-3 py-3 text-center">
              <p className="text-lg font-bold text-stone-900">{pax}</p>
              <p className="text-xs text-stone-500">Guest{pax === 1 ? "" : "s"}</p>
            </div>
            <div className="rounded-xl bg-stone-100 px-3 py-3 text-center">
              <p className="text-lg font-bold text-stone-900">{uniqueDestinations.size}</p>
              <p className="text-xs text-stone-500">Place{uniqueDestinations.size === 1 ? "" : "s"}</p>
            </div>
          </div>

          {/* Route map */}
          {mapPoints.length > 1 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Your route</p>
              <ReviewMap points={mapPoints} />
            </div>
          )}

          {/* Day-by-day summary */}
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Itinerary</p>
            <div className="rounded-xl border border-[#ead7be] bg-[#fffaf4] divide-y divide-[#ead7be]">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <PlaneLanding className="h-3.5 w-3.5 text-[#12343b]" />
                <span className="text-xs font-medium text-stone-700">Arrive{travelDate ? ` · ${formatDate(travelDate, 0)}` : ""}</span>
              </div>
              {enrichedDays.map((day) => (
                <div key={day.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold bg-[#12343b] text-[#f7ead7]">
                      {day.dayNumber}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-stone-900">
                        {day.destination?.name ?? "No destination"}
                      </span>
                      {day.isTransfer && day.leg && (
                        <span className="ml-1.5 text-[10px] text-[#8c6a38]">
                          ({day.leg.driveHours.toFixed(1)}h drive)
                        </span>
                      )}
                    </div>
                    {travelDate && <span className="text-[10px] text-stone-400">{formatDate(travelDate, day.dayNumber)}</span>}
                  </div>
                  {(day.selectedActivities.length > 0 || day.mealPlanId !== "none" || day.hotelMode === "own") && (
                    <div className="ml-8 mt-1 flex flex-wrap gap-1">
                      {day.allActivities
                        .filter((a) => day.selectedActivities.includes(a.id))
                        .map((a) => (
                          <span key={a.id} className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-600">{a.title}</span>
                        ))}
                      {day.mealPlanId !== "none" && (() => { const m = mealOptions.find((o) => o.id === day.mealPlanId); return m ? <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] text-amber-700">{m.label}</span> : null; })()}
                      {day.hotelMode === "own" && <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] text-blue-700">Own stay</span>}
                    </div>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-3 px-4 py-2.5">
                <PlaneLanding className="h-3.5 w-3.5 text-[#12343b]" />
                <span className="text-xs font-medium text-stone-700">Depart{travelDate ? ` · ${formatDate(travelDate, days.length + 1)}` : ""}</span>
              </div>
            </div>
          </div>

          {/* Price breakdown */}
          <div className="rounded-xl border border-[#ead7be] bg-[#fffaf4] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Price estimate</p>
            <div className="mt-3 space-y-2">
              {pricing.lineItems.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-stone-600">{item.label}</span>
                  <span className="font-medium text-stone-900">{currencyFormat(item.amount, pricing.currency)}</span>
                </div>
              ))}
              <div className="border-t border-[#ead7be] pt-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-stone-900">Total</span>
                  <span className="text-lg font-bold text-[#12343b]">{currencyFormat(pricing.total, pricing.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Guests */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Guests ({pax})</p>
            <div className="rounded-xl border border-[#ead7be] bg-[#fffaf4] divide-y divide-[#ead7be]">
              {guestNames.map((gn, idx) => (
                <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold bg-[#12343b] text-[#f7ead7]">{idx + 1}</span>
                  <span className="text-sm text-stone-900">{gn || <span className="text-stone-400 italic">{idx === 0 ? "Lead guest (not set)" : `Guest ${idx + 1}`}</span>}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Contact details */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Contact details</p>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address *" required
              className="w-full rounded-xl border border-[#ddc8b0] bg-[#fffaf4] px-4 py-3 text-sm text-stone-900 outline-none focus:border-[#12343b] focus:ring-2 focus:ring-[#12343b]/10" />
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)"
              className="w-full rounded-xl border border-[#ddc8b0] bg-[#fffaf4] px-4 py-3 text-sm text-stone-900 outline-none focus:border-[#12343b] focus:ring-2 focus:ring-[#12343b]/10" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Special requests, arrival time, anything else..."
              className="w-full rounded-xl border border-[#ddc8b0] bg-[#fffaf4] px-4 py-3 text-sm text-stone-900 outline-none focus:border-[#12343b] focus:ring-2 focus:ring-[#12343b]/10" />
          </div>

          <button type="submit" disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#12343b] py-4 text-base font-bold text-[#f7ead7] shadow-lg transition hover:bg-[#0f2b31] disabled:opacity-60">
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            {submitting ? "Sending..." : "Confirm & send request"}
          </button>

          <p className="text-center text-xs text-stone-500">
            This is a request, not a payment. Our team confirms availability within 24 hours.
          </p>
        </form>
      </SectionAccordion>

      {/* ================================================================ */}
      {/*  STICKY BOTTOM BAR                                               */}
      {/* ================================================================ */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white/95 px-5 py-3 backdrop-blur-md safe-bottom">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div>
            <p className="text-xs text-stone-500">
              {days.length} day{days.length === 1 ? "" : "s"} · {uniqueDestinations.size} place{uniqueDestinations.size === 1 ? "" : "s"} · {pax} guest{pax === 1 ? "" : "s"}
            </p>
            <p className="text-lg font-bold text-[#12343b]">{currencyFormat(pricing.total, pricing.currency)}</p>
          </div>
          {openSection !== 4 ? (
            <button type="button" onClick={() => setOpenSection(4)}
              className="rounded-xl bg-[#12343b] px-5 py-2.5 text-sm font-semibold text-[#f7ead7] transition hover:bg-[#0f2b31]">
              Review
            </button>
          ) : (
            <button type="button" disabled={submitting}
              onClick={() => { const f = document.querySelector<HTMLFormElement>("form"); f?.requestSubmit(); }}
              className="rounded-xl bg-[#12343b] px-5 py-2.5 text-sm font-semibold text-[#f7ead7] transition hover:bg-[#0f2b31] disabled:opacity-60">
              {submitting ? "Sending..." : "Confirm"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
