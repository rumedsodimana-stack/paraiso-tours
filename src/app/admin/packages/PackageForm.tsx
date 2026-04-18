"use client";

import { useState, type ReactNode } from "react";
import {
  BadgeCheck,
  BedDouble,
  CheckCheck,
  ChevronDown,
  Clock3,
  DollarSign,
  Globe,
  ImageIcon,
  ListChecks,
  Map,
  Package,
  Plus,
  Sparkles,
  Star,
  Trash2,
  TriangleAlert,
  X,
  type LucideIcon,
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
  return `${value.toLocaleString()} ${currency}`;
}

function parseDurationMetrics(duration: string) {
  const d = duration.match(/(\d+)\s*Days?/i);
  const n = duration.match(/(\d+)\s*Nights?/i);
  return { days: d ? parseInt(d[1], 10) : undefined, nights: n ? parseInt(n[1], 10) : undefined };
}

function getRecommendedDuration(dayCount: number) {
  return `${dayCount} Days / ${Math.max(0, dayCount - 1)} Nights`;
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
    // Per-night meal plan
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

// ─── Shared input class ───────────────────────────────────────────────────────

const INPUT =
  "mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-sm text-[#11272b] placeholder-[#b0bdc2] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20";

const LABEL = "block text-sm font-medium text-[#11272b]";

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  step,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  step: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e0e4dd] bg-[#fffbf4] shadow-sm">
      <div className="flex items-start gap-4 border-b border-[#e0e4dd] bg-[#f4ecdd] px-6 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#12343b] text-[#f6ead6]">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#c9922f]">{step}</p>
          <h2 className="text-base font-bold text-[#11272b]">{title}</h2>
          <p className="mt-0.5 text-sm text-[#5e7279]">{description}</p>
        </div>
      </div>
      <div className="space-y-6 p-6">{children}</div>
    </section>
  );
}

// ─── Interactive list editor (inclusions / exclusions) ────────────────────────

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

// ─── Sidebar stat tile ────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  accent = "text-[#11272b]",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[#8a9ba1]">{label}</p>
      <p className={`mt-1 text-base font-bold ${accent}`}>{value}</p>
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
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Basics
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

  // Content lists
  const [inclusions, setInclusions] = useState<string[]>(pkg?.inclusions ?? []);
  const [exclusions, setExclusions] = useState<string[]>(pkg?.exclusions ?? []);

  // Itinerary — mealPlanOptions are now per-night, not package-level
  const [itinerary, setItinerary] = useState<ItineraryDay[]>(
    pkg?.itinerary?.length
      ? pkg.itinerary.map((d) => ({
          ...d,
          accommodationOptions: d.accommodationOptions ?? [],
          mealPlanOptions: d.mealPlanOptions ?? [],
        }))
      : [{ day: 1, title: "", description: "", accommodation: "", accommodationOptions: [], mealPlanOptions: [] }]
  );

  // Options
  const [transportOptions, setTransportOptions] = useState<PackageOption[]>(pkg?.transportOptions ?? []);
  const [customOptions, setCustomOptions] = useState<PackageOption[]>(pkg?.customOptions ?? []);

  // Derived
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

  const linkedSupplierIds = new Set<string>();
  itinerary.forEach((d) => {
    (d.accommodationOptions ?? []).forEach((o) => o.supplierId && linkedSupplierIds.add(o.supplierId));
    (d.mealPlanOptions ?? []).forEach((o) => o.supplierId && linkedSupplierIds.add(o.supplierId));
  });
  transportOptions.forEach((o) => o.supplierId && linkedSupplierIds.add(o.supplierId));
  customOptions.forEach((o) => o.supplierId && linkedSupplierIds.add(o.supplierId));

  // Nights that have a hotel but no meal plan configured
  const missingMealNights = Array.from({ length: itineraryNights }, (_, i) => i + 1).filter(
    (n) =>
      (itinerary[n - 1]?.accommodationOptions?.length ?? 0) > 0 &&
      (itinerary[n - 1]?.mealPlanOptions?.length ?? 0) === 0
  );

  const warnings: string[] = [
    ...(durationMismatch ? [`Duration text says "${duration}" but itinerary maps to ${recommendedDuration}.`] : []),
    ...(missingAccommodationNights.length > 0 ? [`Hotel choices missing for night${missingAccommodationNights.length > 1 ? "s" : ""} ${missingAccommodationNights.join(", ")}.`] : []),
    ...(transportOptions.length === 0 ? ["No transport option configured yet."] : []),
    ...(missingMealNights.length > 0 ? [`Meal plans missing for night${missingMealNights.length > 1 ? "s" : ""} ${missingMealNights.join(", ")}.`] : []),
  ];

  // ── Handlers ────────────────────────────────────────────────────────────────

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
    // Meal plans are now per-night on each itinerary day — clear the legacy package-level field
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
    setItinerary((prev) => [
      ...prev,
      { day: prev.length + 1, title: "", description: "", accommodation: "", accommodationOptions: [], mealPlanOptions: [] },
    ]);
  }

  function removeDay(i: number) {
    setItinerary((prev) => prev.filter((_, j) => j !== i));
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">

        {/* ── Main content ── */}
        <div className="space-y-6">

          {/* Step 1 — Basics */}
          <SectionCard
            icon={Sparkles}
            step="Step 1"
            title="Package Identity"
            description="Name, destination, pricing, and client-facing details."
          >
            {/* Name + Destination */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className={LABEL}>Package Name *</label>
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
                  <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a9ba1]" style={{top: "calc(50% + 2px)"}} />
                  <select
                    id="region" name="region"
                    defaultValue={pkg?.region ?? ""}
                    className={`${INPUT} pl-9`}
                  >
                    <option value="">— All Sri Lanka —</option>
                    {["Colombo","Kandy","Galle","Ella","Sigiriya","Yala","Nuwara Eliya","Southern Coast","Cultural Triangle","Tea Country"].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a9ba1]" style={{top: "calc(50% + 2px)"}} />
                </div>
                <p className="mt-1 text-xs text-[#8a9ba1]">Used for client-side filtering.</p>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
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
                  <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a9ba1]" style={{top: "calc(50% + 2px)"}} />
                  <input
                    id="price" name="price" type="number" min={0} step={0.01} required
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    className={`${INPUT} pl-9 text-base font-semibold`}
                    placeholder="0"
                  />
                </div>
                <p className="mt-1 text-xs text-[#8a9ba1]">Per-traveller base before options are added.</p>
              </div>
              <div>
                <label htmlFor="currency" className={LABEL}>Currency</label>
                <select
                  id="currency" name="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className={INPUT}
                >
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
                placeholder="Short overview that clients will read before booking…"
              />
            </div>

            {/* Image URL + preview */}
            <div>
              <label htmlFor="imageUrl" className={LABEL}>Cover image URL</label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a9ba1]" style={{top: "calc(50% + 2px)"}} />
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
                    src={imageUrlInput}
                    alt="Cover preview"
                    className="h-10 w-16 shrink-0 rounded-lg object-cover border border-[#e0e4dd]"
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

            {/* Rating + Review count + Toggles */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="rating" className={LABEL}>Rating (0–5)</label>
                <div className="relative">
                  <Star className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a9ba1]" style={{top: "calc(50% + 2px)"}} />
                  <input
                    id="rating" name="rating" type="number" min={0} max={5} step={0.1}
                    defaultValue={pkg?.rating ?? ""}
                    className={`${INPUT} pl-9`}
                    placeholder="4.9"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="reviewCount" className={LABEL}>Review count</label>
                <input
                  id="reviewCount" name="reviewCount" type="number" min={0}
                  defaultValue={pkg?.reviewCount ?? ""}
                  className={INPUT}
                  placeholder="127"
                />
              </div>
              <div className="flex items-end">
                <label className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] px-4 py-3 text-sm font-medium text-[#11272b] transition hover:bg-[#eaded0]">
                  <input
                    type="checkbox" name="featured"
                    defaultChecked={pkg?.featured ?? false}
                    className="h-4 w-4 rounded border-[#c0b8ae] text-[#12343b] focus:ring-[#c9922f]"
                  />
                  <BadgeCheck className="h-4 w-4 text-[#c9922f]" />
                  Featured
                </label>
              </div>
              <div className="flex items-end">
                <label className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] px-4 py-3 text-sm font-medium text-[#11272b] transition hover:bg-[#eaded0]">
                  <input
                    type="checkbox" name="published"
                    defaultChecked={pkg?.published ?? true}
                    className="h-4 w-4 rounded border-[#c0b8ae] text-[#12343b] focus:ring-[#c9922f]"
                  />
                  <Globe className="h-4 w-4 text-[#12343b]" />
                  Published
                </label>
              </div>
            </div>
          </SectionCard>

          {/* Step 2 — Itinerary + Meal Plans */}
          <SectionCard
            icon={Map}
            step="Step 2"
            title="Itinerary & Meal Plans"
            description="Map the route day by day, assign hotels per night, then set the meal plans available from those hotels."
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#5e7279]">
                <span className="font-semibold text-[#11272b]">{itineraryDays}</span> days ·{" "}
                <span className="font-semibold text-[#11272b]">{itineraryNights}</span> overnight stay{itineraryNights === 1 ? "" : "s"}
              </p>
              <button
                type="button"
                onClick={addDay}
                className="inline-flex items-center gap-2 rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] px-4 py-2 text-sm font-medium text-[#12343b] transition hover:bg-[#eaded0] active:scale-95"
              >
                <Plus className="h-4 w-4" />
                Add Day
              </button>
            </div>

            <div className="space-y-4">
              {itinerary.map((day, index) => {
                const isStayNight = index < itineraryNights;
                const hasHotels = (day.accommodationOptions?.length ?? 0) > 0;

                return (
                  <div key={index} className="overflow-hidden rounded-2xl border border-[#e0e4dd] bg-white/70">
                    {/* Day header */}
                    <div className="flex items-center justify-between gap-3 border-b border-[#e0e4dd] bg-[#f4ecdd] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#12343b] text-sm font-bold text-[#f6ead6]">
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-[#11272b]">Day {index + 1}</p>
                          <p className="text-xs text-[#8a9ba1]">
                            {isStayNight
                              ? hasHotels
                                ? `Night ${index + 1} — ${day.accommodationOptions!.length} hotel option${day.accommodationOptions!.length === 1 ? "" : "s"}`
                                : `Night ${index + 1} — no hotel configured yet`
                              : "Final day · no overnight"}
                          </p>
                        </div>
                      </div>
                      {itinerary.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDay(index)}
                          className="rounded-lg p-1.5 text-[#8a9ba1] transition hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Day fields */}
                    <div className="space-y-3 p-4">
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
                        placeholder="What happens this day — highlights, meals, transfers…"
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
                          {/* Meal plans for this night — filtered to the hotels assigned above */}
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
                    </div>
                  </div>
                );
              })}
            </div>

          </SectionCard>

          {/* Step 3 — Transport & Add-ons */}
          <SectionCard
            icon={Package}
            step="Step 3"
            title="Transport & Add-ons"
            description="Link transport suppliers and any custom add-ons. Saved supplier rates are copied as your starting point."
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <OptionsEditor
                title="Transport"
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
          </SectionCard>

          {/* Step 4 — Inclusions / Exclusions */}
          <SectionCard
            icon={ListChecks}
            step="Step 4"
            title="What's Included"
            description="Tell clients exactly what they get — and what stays outside the package price."
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
          </SectionCard>

        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">

          {/* Identity card */}
          <div className="overflow-hidden rounded-2xl border border-[#e0e4dd] bg-[#fffbf4] shadow-md">
            <div className="border-b border-[#e0e4dd] bg-[#f4ecdd] px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#c9922f]">Tour Composer</p>
              <h2 className="mt-1 text-xl font-bold text-[#11272b] leading-tight">
                {packageName.trim() || "Untitled Package"}
              </h2>
              <p className="mt-0.5 text-sm text-[#5e7279]">
                {destination.trim() || "Choose destination"} · {currency}
              </p>
            </div>

            <div className="space-y-4 p-5">
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2">
                <StatTile
                  label="Duration"
                  value={`${itineraryDays}D / ${itineraryNights}N`}
                  accent="text-[#12343b]"
                />
                <StatTile
                  label="Hotels ready"
                  value={`${preview.configuredNights}/${itineraryNights}`}
                  accent={missingAccommodationNights.length > 0 ? "text-amber-600" : "text-emerald-700"}
                />
                <StatTile
                  label="Suppliers linked"
                  value={String(linkedSupplierIds.size)}
                />
                <StatTile
                  label="Base price"
                  value={fmt(basePrice, currency)}
                />
              </div>

              {/* Live pricing preview */}
              <div className="rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#11272b]">
                  <DollarSign className="h-4 w-4 text-[#c9922f]" />
                  Live pricing preview
                </div>
                <p className="mt-0.5 text-xs text-[#8a9ba1]">
                  1 traveller · default options only
                </p>
                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="flex items-center justify-between gap-2 text-[#5e7279]">
                    <span>Base package</span>
                    <span className="font-medium text-[#11272b]">{fmt(basePrice, currency)}</span>
                  </div>
                  {preview.lines.map((line) => (
                    <div key={line.label} className="flex items-center justify-between gap-2 text-[#5e7279]">
                      <span className="max-w-[65%] truncate">{line.label}</span>
                      <span>{fmt(line.sellAmount, currency)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-1.5 border-t border-[#ddd3c4] pt-3 text-sm">
                  <div className="flex items-center justify-between gap-2 font-bold text-[#11272b]">
                    <span>Guest total</span>
                    <span>{fmt(preview.sellTotal, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[#5e7279]">
                    <span>Tracked cost</span>
                    <span>{fmt(preview.trackedCostTotal, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 font-semibold text-emerald-700">
                    <span>Tracked spread</span>
                    <span>{fmt(preview.spread, currency)}</span>
                  </div>
                </div>
              </div>

              {/* Builder health */}
              <div className="rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#11272b]">
                  <Clock3 className="h-4 w-4 text-[#12343b]" />
                  Builder health
                </div>
                <div className="mt-3 space-y-1.5 text-sm text-[#5e7279]">
                  {[
                    ["Accommodation rows", itinerary.reduce((t, d) => t + (d.accommodationOptions?.length ?? 0), 0)],
                    ["Transport options", transportOptions.length],
                    ["Meal plan rows", itinerary.reduce((t, d) => t + (d.mealPlanOptions?.length ?? 0), 0)],
                    ["Inclusions", inclusions.length],
                    ["Exclusions", exclusions.length],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex items-center justify-between">
                      <span>{label}</span>
                      <span className={`font-semibold ${Number(val) === 0 ? "text-[#8a9ba1]" : "text-[#11272b]"}`}>
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warnings */}
              {warnings.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                    <TriangleAlert className="h-4 w-4" />
                    Needs attention
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {warnings.map((w) => (
                      <li key={w} className="text-sm text-amber-900">{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tips */}
              <div className="rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#11272b]">
                  <CheckCheck className="h-4 w-4 text-[#12343b]" />
                  Composer tips
                </div>
                <ol className="mt-2 space-y-1.5 text-sm text-[#5e7279]">
                  <li>1. Map the route and nights first.</li>
                  <li>2. Pick hotels from your supplier catalog.</li>
                  <li>3. Add transport and meal options.</li>
                  <li>4. List inclusions and exclusions clearly.</li>
                  <li>5. Review the live pricing preview before saving.</li>
                </ol>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#12343b] px-6 py-3.5 text-sm font-semibold text-[#f6ead6] shadow-sm transition hover:bg-[#1a474f] active:scale-[0.98] disabled:opacity-60"
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
        </aside>
      </div>
    </form>
  );
}
