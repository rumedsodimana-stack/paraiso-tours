"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Globe,
  ImageIcon,
  ListChecks,
  Map,
  Package,
  PlaneLanding,
  Plus,
  Sparkles,
  Star,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import type {
  TourPackage,
  ItineraryDay,
  HotelSupplier,
  HotelMealPlan,
  PackageOption,
} from "@/lib/types";
import type { PlannerDestination } from "@/lib/route-planner";
import { calcOptionPrice } from "@/lib/package-price";
import { OptionsEditor, type MealPlanEntry } from "./OptionsEditor";

// ─── Types ───────────────────────────────────────────────────────────────────

type PreviewLine = { label: string; sellAmount: number; costAmount: number };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(value: number, currency: string) {
  return `${Math.round(value).toLocaleString()} ${currency}`;
}

function getRecommendedDuration(dayCount: number) {
  return `${dayCount} Days / ${Math.max(0, dayCount - 1)} Nights`;
}

function parseDurationMetrics(duration: string) {
  const d = duration.match(/(\d+)\s*Days?/i);
  const n = duration.match(/(\d+)\s*Nights?/i);
  return { days: d ? parseInt(d[1], 10) : undefined, nights: n ? parseInt(n[1], 10) : undefined };
}

function getDefaultOption(options: PackageOption[]): PackageOption | null {
  return options.find((o) => o.isDefault) ?? options[0] ?? null;
}

function calcTrackedCost(option: PackageOption, pax: number, nights: number) {
  const cost = option.costPrice ?? option.price;
  switch (option.priceType) {
    case "per_person": return cost * pax;
    case "per_night":  return cost * nights;
    case "per_day":    return cost * Math.max(1, nights + 1);
    case "total":      return cost;
    default:           return cost;
  }
}

function buildPreview(args: {
  itinerary: ItineraryDay[];
  transportOptions: PackageOption[];
  customOptions: PackageOption[];
  basePrice: number;
}) {
  const { itinerary, transportOptions, customOptions, basePrice } = args;
  const pax = 1;
  const expectedNights = Math.max(0, itinerary.length - 1);
  const lines: PreviewLine[] = [];
  let sellTotal = basePrice;
  let trackedCostTotal = 0;
  let configuredNights = 0;

  itinerary.slice(0, expectedNights).forEach((day, i) => {
    const accom = getDefaultOption(day.accommodationOptions ?? []);
    if (accom) {
      configuredNights += 1;
      const sell = calcOptionPrice(accom, pax, 1);
      const cost = calcTrackedCost(accom, pax, 1);
      lines.push({ label: `Night ${i + 1}: ${accom.label}`, sellAmount: sell, costAmount: cost });
      sellTotal += sell;
      trackedCostTotal += cost;
    }
    const meal = getDefaultOption(day.mealPlanOptions ?? []);
    if (meal) {
      const sell = calcOptionPrice(meal, pax, 1);
      const cost = calcTrackedCost(meal, pax, 1);
      lines.push({ label: `Night ${i + 1} meals: ${meal.label}`, sellAmount: sell, costAmount: cost });
      sellTotal += sell;
      trackedCostTotal += cost;
    }
  });

  const transport = getDefaultOption(transportOptions);
  if (transport) {
    const sell = calcOptionPrice(transport, pax, expectedNights);
    const cost = calcTrackedCost(transport, pax, expectedNights);
    lines.push({ label: `Transport: ${transport.label}`, sellAmount: sell, costAmount: cost });
    sellTotal += sell; trackedCostTotal += cost;
  }

  customOptions.filter((o) => o.isDefault).forEach((opt) => {
    const sell = calcOptionPrice(opt, pax, expectedNights);
    const cost = calcTrackedCost(opt, pax, expectedNights);
    lines.push({ label: `Add-on: ${opt.label}`, sellAmount: sell, costAmount: cost });
    sellTotal += sell; trackedCostTotal += cost;
  });

  return { lines, sellTotal, trackedCostTotal, configuredNights, expectedNights, spread: sellTotal - trackedCostTotal };
}

// ─── Shared field styles ──────────────────────────────────────────────────────

const INPUT =
  "mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-sm text-[#11272b] placeholder-[#b0bdc2] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20";
const LABEL = "block text-sm font-medium text-[#11272b]";

// ─── Section accordion (matches journey-builder pattern) ──────────────────────

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
    <section className="overflow-hidden rounded-2xl border border-[#e0e4dd] bg-[#fffbf4] shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition active:bg-[#f4ecdd]"
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition ${
            done && !open
              ? "bg-emerald-600 text-white"
              : open
                ? "bg-[#12343b] text-[#f6ead6]"
                : "bg-[#f4ecdd] text-[#8a9ba1]"
          }`}
        >
          {done && !open ? <Check className="h-4 w-4" /> : number}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-[#11272b]">{title}</span>
          <span className="block truncate text-sm text-[#5e7279]">{subtitle}</span>
        </span>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-[#8a9ba1]" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-[#8a9ba1]" />
        )}
      </button>
      {open && (
        <div className="border-t border-[#e0e4dd] px-5 pb-6 pt-5">
          {children}
        </div>
      )}
    </section>
  );
}

// ─── Interactive list editor ──────────────────────────────────────────────────

function ListEditor({
  label,
  items,
  onChange,
  placeholder,
  bulletColor = "bg-[#c9922f]",
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  bulletColor?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  }

  return (
    <div>
      <label className={LABEL}>{label}</label>
      <div className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="group flex items-center gap-2 rounded-lg bg-[#f4ecdd] px-3 py-2">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${bulletColor}`} />
            <span className="flex-1 text-sm text-[#11272b]">{item}</span>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-[#8a9ba1] transition hover:text-red-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
            placeholder={placeholder ?? "Type and press Enter or Add"}
            className="flex-1 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm text-[#11272b] placeholder-[#b0bdc2] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
          <button
            type="button"
            onClick={commit}
            className="flex items-center gap-1.5 rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] px-3 py-2 text-sm font-medium text-[#12343b] transition hover:bg-[#eaded0] active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function PackageForm({
  pkg,
  hotels = [],
  destinations = [],
  allMealPlans = [],
  onSubmit,
}: {
  pkg?: TourPackage;
  hotels?: HotelSupplier[];
  destinations?: PlannerDestination[];
  allMealPlans?: HotelMealPlan[];
  onSubmit: (formData: FormData) => Promise<{ error?: string } | void>;
}) {
  const dayCounterRef = useRef(0);

  // ── UI state ──
  const [openSection, setOpenSection] = useState(1);
  const [expandedDayIdx, setExpandedDayIdx] = useState<number | null>(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Step 1: Identity ──
  const [packageName, setPackageName] = useState(pkg?.name ?? "");
  const [destination, setDestination] = useState(pkg?.destination ?? "");
  const [selectedDestId, setSelectedDestId] = useState<string>(
    () => destinations.find((d) => d.name === (pkg?.destination ?? ""))?.id ?? ""
  );
  const [duration, setDuration] = useState(
    pkg?.duration ?? getRecommendedDuration(pkg?.itinerary?.length ?? 1)
  );
  const [priceInput, setPriceInput] = useState(pkg?.price != null ? String(pkg.price) : "");
  const [currency, setCurrency] = useState(pkg?.currency ?? "USD");
  const [imageUrlInput, setImageUrlInput] = useState(pkg?.imageUrl ?? "");

  // ── Step 2: Itinerary ──
  const [itinerary, setItinerary] = useState<ItineraryDay[]>(
    pkg?.itinerary?.length
      ? pkg.itinerary.map((d) => ({
          ...d,
          accommodationOptions: d.accommodationOptions ?? [],
          mealPlanOptions: d.mealPlanOptions ?? [],
        }))
      : [{ day: 1, title: "", description: "", accommodation: "", accommodationOptions: [], mealPlanOptions: [] }]
  );

  // ── Step 3: Transport & add-ons ──
  const [transportOptions, setTransportOptions] = useState<PackageOption[]>(pkg?.transportOptions ?? []);
  const [customOptions, setCustomOptions] = useState<PackageOption[]>(pkg?.customOptions ?? []);

  // ── Step 4: Inclusions / Exclusions ──
  const [inclusions, setInclusions] = useState<string[]>(pkg?.inclusions ?? []);
  const [exclusions, setExclusions] = useState<string[]>(pkg?.exclusions ?? []);

  // ── Derived ──
  const hotelById: Record<string, HotelSupplier> = {};
  for (const h of hotels) hotelById[h.id] = h;

  const enrichedMealPlans: MealPlanEntry[] = allMealPlans
    .filter((mp) => {
      const hotel = hotelById[mp.hotelId];
      if (!hotel) return true;
      if (selectedDestId && hotel.destinationId && hotel.destinationId !== selectedDestId) return false;
      return true;
    })
    .map((mp) => ({ ...mp, hotelName: hotelById[mp.hotelId]?.name ?? "Unknown Hotel" }));

  const basePrice = parseFloat(priceInput) || 0;
  const recommendedDuration = getRecommendedDuration(itinerary.length);
  const durationMetrics = parseDurationMetrics(duration);
  const itineraryDays = itinerary.length;
  const itineraryNights = Math.max(0, itineraryDays - 1);
  const durationMismatch =
    durationMetrics.days !== undefined &&
    durationMetrics.nights !== undefined &&
    (durationMetrics.days !== itineraryDays || durationMetrics.nights !== itineraryNights);

  const preview = buildPreview({ itinerary, transportOptions, customOptions, basePrice });

  const missingAccommodationNights = Array.from({ length: itineraryNights }, (_, i) => i + 1).filter(
    (n) => (itinerary[n - 1]?.accommodationOptions?.length ?? 0) === 0
  );

  const missingMealNights = Array.from({ length: itineraryNights }, (_, i) => i + 1).filter(
    (n) =>
      (itinerary[n - 1]?.accommodationOptions?.length ?? 0) > 0 &&
      (itinerary[n - 1]?.mealPlanOptions?.length ?? 0) === 0
  );

  const warnings: string[] = [
    ...(durationMismatch ? [`Duration "${duration}" doesn't match itinerary (${recommendedDuration}).`] : []),
    ...(missingAccommodationNights.length > 0 ? [`Hotel choices missing for night${missingAccommodationNights.length > 1 ? "s" : ""} ${missingAccommodationNights.join(", ")}.`] : []),
    ...(transportOptions.length === 0 ? ["No transport option added yet."] : []),
    ...(missingMealNights.length > 0 ? [`Meal plans missing for night${missingMealNights.length > 1 ? "s" : ""} ${missingMealNights.join(", ")}.`] : []),
  ];

  // ── Section done checks ──
  function sectionDone(n: number) {
    if (n === 1) return !!packageName.trim() && !!destination.trim() && basePrice > 0;
    if (n === 2) return itinerary.length > 0;
    if (n === 3) return transportOptions.length > 0;
    if (n === 4) return inclusions.length > 0;
    return false;
  }

  // ── Handlers ──
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);

    itinerary.forEach((day, i) => {
      formData.set(`itinerary_${i}_title`, day.title);
      formData.set(`itinerary_${i}_description`, day.description);
      formData.set(`itinerary_${i}_accommodation`, day.accommodation || "");
      formData.set(`itinerary_${i}_accommodationOptions`, JSON.stringify(day.accommodationOptions ?? []));
      formData.set(`itinerary_${i}_mealPlanOptions`, JSON.stringify(day.mealPlanOptions ?? []));
    });

    formData.set("inclusions", inclusions.join("\n"));
    formData.set("exclusions", exclusions.join("\n"));
    formData.set("mealOptions", JSON.stringify([]));
    formData.set("transportOptions", JSON.stringify(transportOptions));
    formData.set("customOptions", JSON.stringify(customOptions));

    const result = await onSubmit(formData);
    setSubmitting(false);
    if (result && "error" in result && result.error) setError(result.error);
  }

  function updateDay(i: number, patch: Partial<ItineraryDay>) {
    setItinerary((prev) => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  }

  function addDay() {
    dayCounterRef.current += 1;
    const newIdx = itinerary.length;
    setItinerary((prev) => [
      ...prev,
      { day: prev.length + 1, title: "", description: "", accommodation: "", accommodationOptions: [], mealPlanOptions: [] },
    ]);
    setExpandedDayIdx(newIdx);
  }

  function duplicateDay(i: number) {
    dayCounterRef.current += 1;
    setItinerary((prev) => {
      const source = prev[i];
      const copy: ItineraryDay = {
        ...source,
        accommodationOptions: [...(source.accommodationOptions ?? [])],
        mealPlanOptions: [...(source.mealPlanOptions ?? [])],
      };
      const next = [...prev];
      next.splice(i + 1, 0, copy);
      return next.map((d, j) => ({ ...d, day: j + 1 }));
    });
    setExpandedDayIdx(i + 1);
  }

  function removeDay(i: number) {
    setItinerary((prev) =>
      prev.filter((_, j) => j !== i).map((d, j) => ({ ...d, day: j + 1 }))
    );
    setExpandedDayIdx(null);
  }

  // ── Section subtitles ──
  const step1Subtitle =
    packageName.trim() && destination.trim() && basePrice > 0
      ? `${packageName} · ${destination} · ${fmt(basePrice, currency)}`
      : "Package name, destination and base price";

  const step2Subtitle =
    itinerary.length > 0
      ? `${itineraryDays} day${itineraryDays === 1 ? "" : "s"} · ${itineraryNights} overnight stay${itineraryNights === 1 ? "" : "s"}`
      : "Build the route day by day";

  const step3Subtitle =
    transportOptions.length > 0
      ? `${transportOptions.length} transport option${transportOptions.length === 1 ? "" : "s"}${customOptions.length > 0 ? ` · ${customOptions.length} add-on${customOptions.length === 1 ? "" : "s"}` : ""}`
      : "Add transport options";

  const step4Subtitle =
    inclusions.length > 0 || exclusions.length > 0
      ? `${inclusions.length} inclusion${inclusions.length === 1 ? "" : "s"} · ${exclusions.length} exclusion${exclusions.length === 1 ? "" : "s"}`
      : "List what's included and excluded";

  // ── Render ──
  return (
    <form onSubmit={handleSubmit} className="mt-6 pb-28">

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Warnings banner (non-blocking) */}
      {warnings.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <TriangleAlert className="h-4 w-4" />
            Needs attention
          </div>
          <ul className="mt-1.5 space-y-1">
            {warnings.map((w) => (
              <li key={w} className="text-sm text-amber-900">{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">

        {/* ══════════════════════════════════════════════════════ */}
        {/*  STEP 1 — Package Identity                            */}
        {/* ══════════════════════════════════════════════════════ */}
        <SectionAccordion
          number={1}
          title="Package Identity"
          subtitle={step1Subtitle}
          open={openSection === 1}
          done={sectionDone(1)}
          onToggle={() => setOpenSection(openSection === 1 ? 0 : 1)}
        >
          <div className="space-y-5">
            {/* Name + Destination */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className={LABEL}>Package name *</label>
                <input
                  id="name" name="name" type="text" required
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  className={INPUT}
                  placeholder="Ceylon Heritage & Wildlife"
                />
              </div>
              <div>
                <label htmlFor="destination" className={LABEL}>Destination *</label>
                {destinations.length > 0 ? (
                  <select
                    id="destination" name="destination" required
                    value={destination}
                    onChange={(e) => {
                      const name = e.target.value;
                      setDestination(name);
                      setSelectedDestId(destinations.find((d) => d.name === name)?.id ?? "");
                    }}
                    className={INPUT}
                  >
                    <option value="">— Select destination —</option>
                    {destinations.map((d) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="destination" name="destination" type="text" required
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className={INPUT}
                    placeholder="Sri Lanka"
                  />
                )}
              </div>
            </div>

            {/* Region + Duration */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="region" className={LABEL}>Region</label>
                <div className="relative">
                  <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a9ba1]" style={{ top: "calc(50% + 2px)" }} />
                  <select id="region" name="region" defaultValue={pkg?.region ?? ""} className={`${INPUT} pl-9`}>
                    <option value="">— All Sri Lanka —</option>
                    {["Colombo","Kandy","Galle","Ella","Sigiriya","Yala","Nuwara Eliya","Southern Coast","Cultural Triangle","Tea Country"].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="duration" className={LABEL}>Duration</label>
                  <button
                    type="button"
                    onClick={() => setDuration(recommendedDuration)}
                    className="text-xs font-semibold text-[#12343b] underline decoration-dotted hover:no-underline"
                  >
                    Sync from itinerary
                  </button>
                </div>
                <input
                  id="duration" name="duration" type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className={INPUT}
                  placeholder="8 Days / 7 Nights"
                />
                <p className="mt-1 text-xs text-[#8a9ba1]">Itinerary implies: {recommendedDuration}</p>
              </div>
            </div>

            {/* Price + Currency */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="price" className={LABEL}>Base price *</label>
                <div className="relative">
                  <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a9ba1]" style={{ top: "calc(50% + 2px)" }} />
                  <input
                    id="price" name="price" type="number" min={0} step={0.01} required
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    className={`${INPUT} pl-9 text-base font-semibold`}
                    placeholder="0"
                  />
                </div>
                <p className="mt-1 text-xs text-[#8a9ba1]">Per-traveller base before options.</p>
              </div>
              <div>
                <label htmlFor="currency" className={LABEL}>Currency</label>
                <select id="currency" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={INPUT}>
                  {["USD","EUR","GBP","LKR"].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className={LABEL}>Description</label>
              <textarea
                id="description" name="description" rows={3}
                defaultValue={pkg?.description}
                className={INPUT}
                placeholder="Short overview for clients before booking…"
              />
            </div>

            {/* Image URL */}
            <div>
              <label htmlFor="imageUrl" className={LABEL}>Cover image URL</label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a9ba1]" style={{ top: "calc(50% + 2px)" }} />
                  <input
                    id="imageUrl" name="imageUrl" type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    className={`${INPUT} pl-9`}
                    placeholder="https://images.unsplash.com/…"
                  />
                </div>
                {imageUrlInput && (
                  <img
                    src={imageUrlInput} alt="Cover preview"
                    className="h-10 w-16 shrink-0 rounded-lg border border-[#e0e4dd] object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
              </div>
            </div>

            {/* Cancellation policy */}
            <div>
              <label htmlFor="cancellationPolicy" className={LABEL}>Cancellation policy</label>
              <input
                id="cancellationPolicy" name="cancellationPolicy" type="text"
                defaultValue={pkg?.cancellationPolicy ?? ""}
                className={INPUT}
                placeholder="Free cancellation up to 48 hours before departure"
              />
            </div>

            {/* Rating + Reviews + Toggles */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="rating" className={LABEL}>Rating (0–5)</label>
                <div className="relative">
                  <Star className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a9ba1]" style={{ top: "calc(50% + 2px)" }} />
                  <input id="rating" name="rating" type="number" min={0} max={5} step={0.1} defaultValue={pkg?.rating ?? ""} className={`${INPUT} pl-9`} placeholder="4.9" />
                </div>
              </div>
              <div>
                <label htmlFor="reviewCount" className={LABEL}>Reviews</label>
                <input id="reviewCount" name="reviewCount" type="number" min={0} defaultValue={pkg?.reviewCount ?? ""} className={INPUT} placeholder="127" />
              </div>
              <div className="flex items-end">
                <label className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] px-4 py-3 text-sm font-medium text-[#11272b] transition hover:bg-[#eaded0]">
                  <input type="checkbox" name="featured" defaultChecked={pkg?.featured ?? false} className="h-4 w-4 rounded border-[#c0b8ae] text-[#12343b] focus:ring-[#c9922f]" />
                  <BadgeCheck className="h-4 w-4 text-[#c9922f]" />
                  Featured
                </label>
              </div>
              <div className="flex items-end">
                <label className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] px-4 py-3 text-sm font-medium text-[#11272b] transition hover:bg-[#eaded0]">
                  <input type="checkbox" name="published" defaultChecked={pkg?.published ?? true} className="h-4 w-4 rounded border-[#c0b8ae] text-[#12343b] focus:ring-[#c9922f]" />
                  <Globe className="h-4 w-4 text-[#12343b]" />
                  Published
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!packageName.trim()) { setError("Package name is required."); return; }
                if (!destination.trim()) { setError("Destination is required."); return; }
                if (!priceInput || parseFloat(priceInput) <= 0) { setError("Set a base price greater than 0."); return; }
                setError("");
                setOpenSection(2);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#12343b] py-3 text-sm font-semibold text-[#f6ead6] transition hover:bg-[#1a474f]"
            >
              Next: Build the itinerary <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </SectionAccordion>

        {/* ══════════════════════════════════════════════════════ */}
        {/*  STEP 2 — Itinerary                                   */}
        {/* ══════════════════════════════════════════════════════ */}
        <SectionAccordion
          number={2}
          title="Itinerary"
          subtitle={step2Subtitle}
          open={openSection === 2}
          done={sectionDone(2)}
          onToggle={() => setOpenSection(openSection === 2 ? 0 : 2)}
        >
          <div className="space-y-3">
            {/* Arrival marker */}
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#12343b]/30 bg-[#12343b]/5 px-4 py-3">
              <PlaneLanding className="h-4 w-4 text-[#12343b]" />
              <div>
                <p className="text-sm font-semibold text-[#12343b]">Arrival — Day 1</p>
                <p className="text-xs text-[#8a9ba1]">Guests fly in and begin the tour</p>
              </div>
            </div>

            {/* Day cards */}
            {itinerary.map((day, index) => {
              const isOpen = expandedDayIdx === index;
              const isStayNight = index < itineraryNights;
              const hotelCount = day.accommodationOptions?.length ?? 0;
              const mealCount = day.mealPlanOptions?.length ?? 0;

              // collapsed header subtitle
              const daySummary = isStayNight
                ? [
                    hotelCount > 0 ? `${hotelCount} hotel option${hotelCount === 1 ? "" : "s"}` : "No hotel yet",
                    mealCount > 0 ? `${mealCount} meal plan${mealCount === 1 ? "" : "s"}` : null,
                  ].filter(Boolean).join(" · ")
                : "Final day · no overnight";

              return (
                <div key={index} className="overflow-hidden rounded-xl border border-[#e0e4dd] bg-white">
                  {/* Day header */}
                  <button
                    type="button"
                    onClick={() => setExpandedDayIdx(isOpen ? null : index)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-[#f4ecdd]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#12343b] text-xs font-bold text-[#f6ead6]">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#11272b]">
                        {day.title.trim() || `Day ${index + 1} — add title`}
                      </p>
                      <p className="text-xs text-[#8a9ba1]">{daySummary}</p>
                    </div>
                    {isOpen
                      ? <ChevronUp className="h-4 w-4 shrink-0 text-[#8a9ba1]" />
                      : <ChevronDown className="h-4 w-4 shrink-0 text-[#8a9ba1]" />
                    }
                  </button>

                  {/* Day expanded content */}
                  {isOpen && (
                    <div className="border-t border-[#e0e4dd] space-y-4 px-4 pb-4 pt-4">
                      <input
                        type="text"
                        value={day.title}
                        onChange={(e) => updateDay(index, { title: e.target.value })}
                        placeholder={`Day ${index + 1} title — e.g. Arrival in Colombo & City Tour`}
                        className="w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2.5 text-sm text-[#11272b] placeholder-[#b0bdc2] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
                      />
                      <textarea
                        value={day.description}
                        onChange={(e) => updateDay(index, { description: e.target.value })}
                        rows={2}
                        placeholder="What happens this day — highlights, transfers, activities…"
                        className="w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2.5 text-sm text-[#11272b] placeholder-[#b0bdc2] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
                      />

                      {isStayNight ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <OptionsEditor
                            title={`Night ${index + 1} — Hotel options`}
                            options={day.accommodationOptions ?? []}
                            onChange={(opts) => updateDay(index, { accommodationOptions: opts })}
                            hotels={hotels}
                            showSupplier
                            supplierType="hotel"
                            allowCustom={false}
                            packageCurrency={currency}
                            destinationId={selectedDestId || undefined}
                          />
                          {(() => {
                            const nightHotelIds = new Set(
                              (day.accommodationOptions ?? [])
                                .map((o) => o.supplierId)
                                .filter((id): id is string => Boolean(id))
                            );
                            const nightMealPlans = enrichedMealPlans.filter(
                              (mp) => nightHotelIds.size === 0 || nightHotelIds.has(mp.hotelId)
                            );
                            return (
                              <OptionsEditor
                                title={`Night ${index + 1} — Meal plan options`}
                                options={day.mealPlanOptions ?? []}
                                onChange={(opts) => updateDay(index, { mealPlanOptions: opts })}
                                hotels={hotels}
                                showSupplier
                                supplierType="meal"
                                packageCurrency={currency}
                                mealPlans={nightMealPlans.length > 0 ? nightMealPlans : enrichedMealPlans.length > 0 ? enrichedMealPlans : undefined}
                              />
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-[#ddd3c4] bg-[#faf6ef] px-4 py-3 text-sm text-[#8a9ba1]">
                          No hotel selector — this is the final / transit day.
                        </div>
                      )}

                      {/* Day actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => duplicateDay(index)}
                          className="rounded-lg border border-[#e0e4dd] px-3 py-1.5 text-xs font-medium text-[#5e7279] transition hover:bg-[#f4ecdd]"
                        >
                          + Extra night here
                        </button>
                        {itinerary.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeDay(index)}
                            className="ml-auto flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Departure marker */}
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#12343b]/30 bg-[#12343b]/5 px-4 py-3">
              <PlaneLanding className="h-4 w-4 rotate-180 text-[#12343b]" />
              <div>
                <p className="text-sm font-semibold text-[#12343b]">Departure — after Day {itineraryDays}</p>
                <p className="text-xs text-[#8a9ba1]">Guests depart or transfer to the airport</p>
              </div>
            </div>

            {/* Add day */}
            <button
              type="button"
              onClick={addDay}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#12343b]/30 py-4 text-sm font-semibold text-[#12343b] transition hover:border-[#12343b]/60 hover:bg-[#12343b]/5"
            >
              <Plus className="h-4 w-4" />
              Add a day
            </button>

            <button
              type="button"
              onClick={() => { setError(""); setOpenSection(3); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#12343b] py-3 text-sm font-semibold text-[#f6ead6] transition hover:bg-[#1a474f]"
            >
              Next: Add transport <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </SectionAccordion>

        {/* ══════════════════════════════════════════════════════ */}
        {/*  STEP 3 — Transport & Add-ons                         */}
        {/* ══════════════════════════════════════════════════════ */}
        <SectionAccordion
          number={3}
          title="Transport & Add-ons"
          subtitle={step3Subtitle}
          open={openSection === 3}
          done={sectionDone(3)}
          onToggle={() => setOpenSection(openSection === 3 ? 0 : 3)}
        >
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <OptionsEditor
                title="Transport options"
                options={transportOptions}
                onChange={setTransportOptions}
                hotels={hotels}
                showSupplier
                supplierType="transport"
                packageCurrency={currency}
              />
              <OptionsEditor
                title="Custom add-ons"
                options={customOptions}
                onChange={setCustomOptions}
                packageCurrency={currency}
              />
            </div>
            <button
              type="button"
              onClick={() => { setError(""); setOpenSection(4); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#12343b] py-3 text-sm font-semibold text-[#f6ead6] transition hover:bg-[#1a474f]"
            >
              Next: What's included <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </SectionAccordion>

        {/* ══════════════════════════════════════════════════════ */}
        {/*  STEP 4 — Inclusions / Exclusions                     */}
        {/* ══════════════════════════════════════════════════════ */}
        <SectionAccordion
          number={4}
          title="What's Included"
          subtitle={step4Subtitle}
          open={openSection === 4}
          done={sectionDone(4)}
          onToggle={() => setOpenSection(openSection === 4 ? 0 : 4)}
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <ListEditor
              label="Inclusions"
              items={inclusions}
              onChange={setInclusions}
              placeholder="e.g. All accommodation, Breakfast daily…"
              bulletColor="bg-[#c9922f]"
            />
            <ListEditor
              label="Exclusions"
              items={exclusions}
              onChange={setExclusions}
              placeholder="e.g. International flights, Travel insurance…"
              bulletColor="bg-[#c0b8ae]"
            />
          </div>
        </SectionAccordion>

      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/*  STICKY BOTTOM BAR                                        */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#e0e4dd] bg-[#fffbf4]/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          {/* Package identity */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[#11272b]">
              {packageName.trim() || "Untitled Package"}
            </p>
            <p className="text-xs text-[#5e7279]">
              {destination.trim() || "No destination"} · {itineraryDays}D / {itineraryNights}N
            </p>
          </div>

          {/* Pricing preview */}
          <div className="hidden shrink-0 text-right sm:block">
            <p className="text-xs text-[#8a9ba1]">Estimated (1 pax)</p>
            <p className="text-sm font-bold text-[#12343b]">{fmt(preview.sellTotal, currency)}</p>
          </div>

          {/* Warnings pill */}
          {warnings.length > 0 && (
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              <TriangleAlert className="h-3 w-3" />
              {warnings.length}
            </div>
          )}

          {/* Save button */}
          <button
            type="submit"
            disabled={submitting}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-[#12343b] px-5 py-2.5 text-sm font-semibold text-[#f6ead6] shadow-sm transition hover:bg-[#1a474f] active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#f6ead6]/30 border-t-[#f6ead6]" />
                Saving…
              </>
            ) : (
              <>
                <Package className="h-4 w-4" />
                {pkg ? "Update Package" : "Create Package"}
              </>
            )}
          </button>
        </div>
      </div>

    </form>
  );
}
