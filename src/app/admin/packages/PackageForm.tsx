"use client";

import { useRef, useState, useMemo, type ReactNode } from "react";
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
  Star,
  Trash2,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";
import type {
  TourPackage,
  ItineraryDay,
  HotelSupplier,
  HotelMealPlan,
  PackageOption,
} from "@/lib/types";
import type { PlannerDestination, PlannerDestinationId } from "@/lib/route-planner";
import { getPlannerActivities } from "@/lib/route-planner";
import { calcOptionPrice } from "@/lib/package-price";
import type { MealPlanEntry } from "./OptionsEditor";

// ─── Types ───────────────────────────────────────────────────────────────────

type HotelMode = "pick" | "own";

type AdminDay = {
  id: string;
  day: number;
  title: string;
  description: string;
  accommodation: string;
  accommodationOptions: PackageOption[];
  mealPlanOptions: PackageOption[];
  // admin-only (not persisted)
  destinationId: string | null;
  hotelMode: HotelMode;
  selectedActivityIds: string[];
  notes: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _counter = 0;
function genId() {
  return `opt_${Date.now()}_${++_counter}`;
}

function fmt(value: number, currency: string) {
  return `${Math.round(value).toLocaleString()} ${currency}`;
}

function getRecommendedDuration(dayCount: number) {
  return `${dayCount} Days / ${Math.max(0, dayCount - 1)} Nights`;
}

function calcOptionCost(opt: PackageOption, pax: number, nights: number) {
  const p = opt.costPrice ?? opt.price;
  switch (opt.priceType) {
    case "per_person":
    case "per_person_total": return p * pax;
    case "per_night":
    case "per_room_per_night": return p * nights;
    case "per_person_per_night": return p * pax * nights;
    case "per_day":
    case "per_vehicle_per_day": return p * Math.max(1, nights);
    case "per_person_per_day": return p * pax * Math.max(1, nights);
    default: return p;
  }
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const INPUT =
  "mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-sm text-[#11272b] placeholder-[#b0bdc2] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20";
const LABEL = "block text-sm font-medium text-[#11272b]";

// ─── Section accordion ────────────────────────────────────────────────────────

function SectionAccordion({
  number, title, subtitle, open, done, onToggle, children,
}: {
  number: number; title: string; subtitle: string;
  open: boolean; done: boolean;
  onToggle: () => void; children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e0e4dd] bg-[#fffbf4] shadow-sm">
      <button
        type="button" onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition active:bg-[#f4ecdd]"
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition ${
          done && !open ? "bg-emerald-600 text-white"
          : open ? "bg-[#12343b] text-[#f6ead6]"
          : "bg-[#f4ecdd] text-[#8a9ba1]"
        }`}>
          {done && !open ? <Check className="h-4 w-4" /> : number}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-[#11272b]">{title}</span>
          <span className="block truncate text-sm text-[#5e7279]">{subtitle}</span>
        </span>
        {open ? <ChevronUp className="h-5 w-5 shrink-0 text-[#8a9ba1]" /> : <ChevronDown className="h-5 w-5 shrink-0 text-[#8a9ba1]" />}
      </button>
      {open && <div className="border-t border-[#e0e4dd] px-5 pb-6 pt-5">{children}</div>}
    </section>
  );
}

// ─── List editor ──────────────────────────────────────────────────────────────

function ListEditor({ label, items, onChange, placeholder, accent = "bg-[#c9922f]" }: {
  label: string; items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string; accent?: string;
}) {
  const [draft, setDraft] = useState("");
  function commit() {
    const v = draft.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setDraft("");
  }
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <div className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="group flex items-center gap-2 rounded-lg bg-[#f4ecdd] px-3 py-2">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${accent}`} />
            <span className="flex-1 text-sm text-[#11272b]">{item}</span>
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-[#8a9ba1] transition hover:text-red-500">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <input value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
            placeholder={placeholder ?? "Type and press Enter…"}
            className="flex-1 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm text-[#11272b] placeholder-[#b0bdc2] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
          <button type="button" onClick={commit}
            className="flex items-center gap-1.5 rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] px-3 py-2 text-sm font-medium text-[#12343b] transition hover:bg-[#eaded0]">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

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
  const dayCounter = useRef(0);

  // ── UI ──
  const [openSection, setOpenSection] = useState(1);
  const [expandedDayIdx, setExpandedDayIdx] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Step 1: Basics ──
  const [packageName, setPackageName] = useState(pkg?.name ?? "");
  const [destination, setDestination] = useState(pkg?.destination ?? "");
  const [currency, setCurrency] = useState(pkg?.currency ?? "USD");

  // ── Step 2: Transport ──
  const [transportOptions, setTransportOptions] = useState<PackageOption[]>(pkg?.transportOptions ?? []);

  // ── Step 3: Days ──
  const [days, setDays] = useState<AdminDay[]>(() => {
    if (pkg?.itinerary?.length) {
      return pkg.itinerary.map((d, i) => ({
        id: `day_${i + 1}`,
        day: i + 1,
        title: d.title,
        description: d.description,
        accommodation: d.accommodation ?? "",
        accommodationOptions: d.accommodationOptions ?? [],
        mealPlanOptions: d.mealPlanOptions ?? [],
        destinationId: null,
        hotelMode: "pick" as HotelMode,
        selectedActivityIds: [],
        notes: "",
      }));
    }
    return [];
  });

  // ── Step 4: Inclusions / Exclusions + meta ──
  const [inclusions, setInclusions] = useState<string[]>(pkg?.inclusions ?? []);
  const [exclusions, setExclusions] = useState<string[]>(pkg?.exclusions ?? []);
  const [description, setDescription] = useState(pkg?.description ?? "");
  const [imageUrlInput, setImageUrlInput] = useState(pkg?.imageUrl ?? "");

  // ── Derived ──
  const hotelById = useMemo(() => {
    const m: Record<string, HotelSupplier> = {};
    for (const h of hotels) m[h.id] = h;
    return m;
  }, [hotels]);

  const enrichedMealPlans: MealPlanEntry[] = useMemo(() =>
    allMealPlans.map((mp) => ({ ...mp, hotelName: hotelById[mp.hotelId]?.name ?? "Unknown Hotel" })),
    [allMealPlans, hotelById]
  );

  const transportSuppliers = useMemo(() =>
    hotels.filter((h) => h.type === "transport"),
    [hotels]
  );

  const nights = Math.max(0, days.length - 1);
  const duration = getRecommendedDuration(days.length);

  // Auto-generated inclusions from selected activities
  const activityInclusions = useMemo(() => {
    const items: string[] = [];
    days.forEach((day) => {
      if (!day.destinationId || day.selectedActivityIds.length === 0) return;
      try {
        const acts = getPlannerActivities(day.destinationId as PlannerDestinationId);
        day.selectedActivityIds.forEach((aid) => {
          const act = acts.find((a) => a.id === aid);
          if (act) items.push(act.title);
        });
      } catch { /* destination not in planner */ }
    });
    return [...new Set(items)];
  }, [days]);

  // Min price calculation (cheapest options, 1 pax)
  const minPrice = useMemo(() => {
    let total = 0;
    days.slice(0, nights).forEach((day) => {
      if (day.hotelMode === "own") return;
      const cheapHotel = [...day.accommodationOptions].sort((a, b) => a.price - b.price)[0];
      if (cheapHotel) total += calcOptionPrice(cheapHotel, 1, 1);
      const cheapMeal = [...day.mealPlanOptions].sort((a, b) => a.price - b.price)[0];
      if (cheapMeal) total += calcOptionPrice(cheapMeal, 1, 1);
    });
    const cheapTransport = [...transportOptions].sort((a, b) => a.price - b.price)[0];
    if (cheapTransport) total += calcOptionCost(cheapTransport, 1, nights);
    return total;
  }, [days, nights, transportOptions]);

  const warnings = [
    ...(!packageName.trim() ? ["Package name is required."] : []),
    ...(days.length === 0 ? ["Add at least one day to the itinerary."] : []),
    ...(transportOptions.length === 0 ? ["No transport option added yet."] : []),
  ];

  // ── Section done ──
  function sectionDone(n: number) {
    if (n === 1) return !!packageName.trim() && !!destination.trim();
    if (n === 2) return transportOptions.length > 0;
    if (n === 3) return days.length > 0;
    if (n === 4) return inclusions.length > 0;
    return false;
  }

  // ── Handlers ──

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!packageName.trim()) { setError("Package name is required."); return; }
    if (!destination.trim()) { setError("Destination is required."); return; }
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);

    // Serialise itinerary
    days.forEach((day, i) => {
      formData.set(`itinerary_${i}_title`, day.title);
      formData.set(`itinerary_${i}_description`, day.description);
      formData.set(`itinerary_${i}_accommodation`,
        day.hotelMode === "own" ? "Own arrangement" : (day.accommodationOptions[0]?.label ?? ""));
      formData.set(`itinerary_${i}_accommodationOptions`,
        JSON.stringify(day.hotelMode === "own" ? [] : day.accommodationOptions));
      formData.set(`itinerary_${i}_mealPlanOptions`,
        JSON.stringify(day.hotelMode === "own" ? [] : day.mealPlanOptions));
    });

    // Merge activity inclusions with manual
    const allInclusions = [...new Set([...activityInclusions, ...inclusions])];
    formData.set("inclusions", allInclusions.join("\n"));
    formData.set("exclusions", exclusions.join("\n"));
    formData.set("mealOptions", JSON.stringify([]));
    formData.set("transportOptions", JSON.stringify(transportOptions));
    formData.set("customOptions", JSON.stringify([]));

    // Auto-set price to min total, duration from day count
    formData.set("price", String(minPrice > 0 ? minPrice : 0));
    formData.set("duration", duration);
    formData.set("description", description);

    const result = await onSubmit(formData);
    setSubmitting(false);
    if (result && "error" in result && result.error) setError(result.error);
  }

  // Day management
  function makeDay(idx: number): AdminDay {
    dayCounter.current += 1;
    return {
      id: `day_${dayCounter.current}`,
      day: idx + 1,
      title: "",
      description: "",
      accommodation: "",
      accommodationOptions: [],
      mealPlanOptions: [],
      destinationId: null,
      hotelMode: "pick",
      selectedActivityIds: [],
      notes: "",
    };
  }

  function addDay() {
    const idx = days.length;
    const d = makeDay(idx);
    setDays((prev) => [...prev, d]);
    setExpandedDayIdx(idx);
  }

  function duplicateDay(i: number) {
    dayCounter.current += 1;
    const src = days[i];
    const copy: AdminDay = {
      ...src,
      id: `day_${dayCounter.current}`,
      accommodationOptions: src.accommodationOptions.map((o) => ({ ...o, id: genId() })),
      mealPlanOptions: src.mealPlanOptions.map((o) => ({ ...o, id: genId() })),
      selectedActivityIds: [...src.selectedActivityIds],
    };
    setDays((prev) => {
      const next = [...prev];
      next.splice(i + 1, 0, copy);
      return next.map((d, j) => ({ ...d, day: j + 1 }));
    });
    setExpandedDayIdx(i + 1);
  }

  function removeDay(i: number) {
    setDays((prev) => prev.filter((_, j) => j !== i).map((d, j) => ({ ...d, day: j + 1 })));
    setExpandedDayIdx(null);
  }

  function updateDay(i: number, patch: Partial<AdminDay>) {
    setDays((prev) => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  }

  // Hotel selection
  function toggleHotel(dayIdx: number, hotel: HotelSupplier) {
    const day = days[dayIdx];
    const existing = day.accommodationOptions.find((o) => o.supplierId === hotel.id);
    if (existing) {
      updateDay(dayIdx, {
        accommodationOptions: day.accommodationOptions.filter((o) => o.supplierId !== hotel.id),
      });
    } else {
      const isFirst = day.accommodationOptions.length === 0;
      const newOpt: PackageOption = {
        id: genId(),
        label: hotel.name,
        supplierId: hotel.id,
        price: hotel.defaultPricePerNight ?? 0,
        costPrice: hotel.defaultPricePerNight ?? 0,
        priceType: "per_room_per_night",
        capacity: 2,
        isDefault: isFirst,
      };
      updateDay(dayIdx, {
        accommodationOptions: [...day.accommodationOptions, newOpt],
      });
    }
  }

  // Meal plan selection
  function toggleMealPlan(dayIdx: number, mp: MealPlanEntry) {
    const day = days[dayIdx];
    const key = `${mp.hotelId}|||${mp.label}`;
    const existing = day.mealPlanOptions.find(
      (o) => o.supplierId === mp.hotelId && o.label.endsWith(mp.label)
    );
    if (existing) {
      updateDay(dayIdx, {
        mealPlanOptions: day.mealPlanOptions.filter((o) => o.id !== existing.id),
      });
    } else {
      const isFirst = day.mealPlanOptions.length === 0;
      const newOpt: PackageOption = {
        id: genId(),
        label: `${mp.hotelName} — ${mp.label}`,
        supplierId: mp.hotelId,
        price: mp.pricePerPerson,
        costPrice: mp.pricePerPerson,
        priceType: "per_person_per_day",
        isDefault: isFirst,
      };
      updateDay(dayIdx, {
        mealPlanOptions: [...day.mealPlanOptions, newOpt],
      });
    }
  }

  // Activity selection
  function toggleActivity(dayIdx: number, actId: string) {
    const day = days[dayIdx];
    const has = day.selectedActivityIds.includes(actId);
    updateDay(dayIdx, {
      selectedActivityIds: has
        ? day.selectedActivityIds.filter((a) => a !== actId)
        : [...day.selectedActivityIds, actId],
    });
  }

  // Transport selection
  function toggleTransport(supplier: HotelSupplier) {
    const existing = transportOptions.find((o) => o.supplierId === supplier.id);
    if (existing) {
      setTransportOptions((prev) => prev.filter((o) => o.supplierId !== supplier.id));
    } else {
      const isFirst = transportOptions.length === 0;
      setTransportOptions((prev) => [
        ...prev,
        {
          id: genId(),
          label: supplier.name,
          supplierId: supplier.id,
          price: supplier.defaultPricePerNight ?? 0,
          costPrice: supplier.defaultPricePerNight ?? 0,
          priceType: "per_vehicle_per_day",
          capacity: supplier.capacity ?? 4,
          isDefault: isFirst,
        },
      ]);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="mt-6 pb-28 max-w-3xl">

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">

        {/* ═══════════════════════════════════════════════ */}
        {/*  STEP 1 — Basics                               */}
        {/* ═══════════════════════════════════════════════ */}
        <SectionAccordion
          number={1} title="Package Basics"
          subtitle={packageName.trim() && destination.trim()
            ? `${packageName} · ${destination} · ${currency}`
            : "Name, destination and currency"}
          open={openSection === 1} done={sectionDone(1)}
          onToggle={() => setOpenSection(openSection === 1 ? 0 : 1)}
        >
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className={LABEL}>Tour package name *</label>
                <input id="name" name="name" type="text" required
                  value={packageName} onChange={(e) => setPackageName(e.target.value)}
                  className={INPUT} placeholder="Ceylon Heritage & Wildlife" />
              </div>
              <div>
                <label htmlFor="destination" className={LABEL}>Destination / Country *</label>
                <input id="destination" name="destination" type="text" required
                  value={destination} onChange={(e) => setDestination(e.target.value)}
                  className={INPUT} placeholder="Sri Lanka" />
                <p className="mt-1 text-xs text-[#8a9ba1]">Overall label shown to guests (e.g. "Sri Lanka")</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="currency" className={LABEL}>Currency</label>
                <select id="currency" name="currency" value={currency}
                  onChange={(e) => setCurrency(e.target.value)} className={INPUT}>
                  {["USD","EUR","GBP","LKR"].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="region" className={LABEL}>Region</label>
                <select id="region" name="region" defaultValue={pkg?.region ?? ""} className={INPUT}>
                  <option value="">— All Sri Lanka —</option>
                  {["Colombo","Kandy","Galle","Ella","Sigiriya","Yala","Nuwara Eliya","Southern Coast","Cultural Triangle","Tea Country"].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Rating + Review + Toggles */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="rating" className={LABEL}>Rating (0–5)</label>
                <div className="relative">
                  <Star className="pointer-events-none absolute left-3 top-[calc(50%+2px)] h-4 w-4 -translate-y-1/2 text-[#8a9ba1]" />
                  <input id="rating" name="rating" type="number" min={0} max={5} step={0.1}
                    defaultValue={pkg?.rating ?? ""} className={`${INPUT} pl-9`} placeholder="4.9" />
                </div>
              </div>
              <div>
                <label htmlFor="reviewCount" className={LABEL}>Reviews</label>
                <input id="reviewCount" name="reviewCount" type="number" min={0}
                  defaultValue={pkg?.reviewCount ?? ""} className={INPUT} placeholder="127" />
              </div>
              <div className="flex items-end">
                <label className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] px-4 py-3 text-sm font-medium text-[#11272b] transition hover:bg-[#eaded0]">
                  <input type="checkbox" name="featured" defaultChecked={pkg?.featured ?? false}
                    className="h-4 w-4 rounded border-[#c0b8ae] text-[#12343b] focus:ring-[#c9922f]" />
                  <BadgeCheck className="h-4 w-4 text-[#c9922f]" /> Featured
                </label>
              </div>
              <div className="flex items-end">
                <label className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] px-4 py-3 text-sm font-medium text-[#11272b] transition hover:bg-[#eaded0]">
                  <input type="checkbox" name="published" defaultChecked={pkg?.published ?? true}
                    className="h-4 w-4 rounded border-[#c0b8ae] text-[#12343b] focus:ring-[#c9922f]" />
                  <Globe className="h-4 w-4 text-[#12343b]" /> Published
                </label>
              </div>
            </div>
            <button type="button"
              onClick={() => {
                if (!packageName.trim()) { setError("Package name is required."); return; }
                if (!destination.trim()) { setError("Destination is required."); return; }
                setError(""); setOpenSection(2);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#12343b] py-3 text-sm font-semibold text-[#f6ead6] transition hover:bg-[#1a474f]"
            >
              Next: Add transport <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </SectionAccordion>

        {/* ═══════════════════════════════════════════════ */}
        {/*  STEP 2 — Transport                            */}
        {/* ═══════════════════════════════════════════════ */}
        <SectionAccordion
          number={2} title="Transport"
          subtitle={transportOptions.length > 0
            ? `${transportOptions.length} option${transportOptions.length === 1 ? "" : "s"} · guests pick on booking`
            : "Choose which vehicles guests can select"}
          open={openSection === 2} done={sectionDone(2)}
          onToggle={() => setOpenSection(openSection === 2 ? 0 : 2)}
        >
          <div className="space-y-4">
            {transportSuppliers.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#ddd3c4] py-4 text-center text-sm text-[#8a9ba1]">
                No transport suppliers found — add them in the Suppliers section first.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {transportSuppliers.map((t) => {
                  const isSelected = transportOptions.some((o) => o.supplierId === t.id);
                  return (
                    <button
                      key={t.id} type="button" onClick={() => toggleTransport(t)}
                      className={`rounded-xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? "border-[#12343b] bg-[#12343b] text-[#f6ead6] shadow-sm"
                          : "border-[#e0e4dd] bg-white text-[#11272b] hover:border-[#8a9ba1]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{t.name}</span>
                        {isSelected && <Check className="h-4 w-4 shrink-0" />}
                      </div>
                      <span className={`mt-0.5 block text-xs ${isSelected ? "text-[#f6ead6]/70" : "text-[#5e7279]"}`}>
                        {t.defaultPricePerNight != null
                          ? `${t.defaultPricePerNight.toLocaleString()} ${t.currency}/day`
                          : "Rate not set"}
                        {t.capacity ? ` · up to ${t.capacity} guests` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {transportOptions.length > 0 && (
              <div className="rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] px-4 py-3 text-xs text-[#5e7279]">
                <strong className="text-[#11272b]">{transportOptions.length}</strong> transport option{transportOptions.length === 1 ? "" : "s"} added. Cheapest sets the base price: <strong className="text-[#11272b]">{fmt(Math.min(...transportOptions.map((o) => o.price)), currency)}/day</strong>
              </div>
            )}
            <button type="button"
              onClick={() => { setError(""); setOpenSection(3); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#12343b] py-3 text-sm font-semibold text-[#f6ead6] transition hover:bg-[#1a474f]"
            >
              Next: Build the itinerary <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </SectionAccordion>

        {/* ═══════════════════════════════════════════════ */}
        {/*  STEP 3 — Day by Day                           */}
        {/* ═══════════════════════════════════════════════ */}
        <SectionAccordion
          number={3} title="Day by Day"
          subtitle={days.length > 0
            ? `${days.length} day${days.length === 1 ? "" : "s"} · ${nights} overnight stay${nights === 1 ? "" : "s"}`
            : "Build the route day by day"}
          open={openSection === 3} done={sectionDone(3)}
          onToggle={() => setOpenSection(openSection === 3 ? 0 : 3)}
        >
          <div className="space-y-3">
            {/* Arrival marker */}
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#12343b]/30 bg-[#12343b]/5 px-4 py-3">
              <PlaneLanding className="h-4 w-4 text-[#12343b]" />
              <p className="text-sm font-semibold text-[#12343b]">Arrival · Day 1</p>
            </div>

            {/* Day cards */}
            {days.map((day, idx) => {
              const isOpen = expandedDayIdx === idx;
              const isOvernight = idx < nights;
              const destObj = destinations.find((d) => d.id === day.destinationId);

              // Hotels for this destination
              const destHotels = day.destinationId
                ? hotels.filter((h) => h.type === "hotel" && (h.destinationId === day.destinationId || !h.destinationId))
                : [];

              // Meal plans for hotels already added to this night
              const addedHotelIds = new Set(day.accommodationOptions.map((o) => o.supplierId).filter(Boolean) as string[]);
              const dayMealPlans = enrichedMealPlans.filter(
                (mp) => addedHotelIds.size === 0 || addedHotelIds.has(mp.hotelId)
              );

              // Activities for destination
              let activities: ReturnType<typeof getPlannerActivities> = [];
              if (day.destinationId) {
                try { activities = getPlannerActivities(day.destinationId as PlannerDestinationId); } catch { /* ok */ }
              }

              // Header summary
              const hotelSummary = day.hotelMode === "own"
                ? "Own accommodation"
                : day.accommodationOptions.length > 0
                  ? `${day.accommodationOptions.length} hotel${day.accommodationOptions.length === 1 ? "" : "s"}`
                  : null;
              const mealSummary = day.mealPlanOptions.length > 0
                ? `${day.mealPlanOptions.length} meal plan${day.mealPlanOptions.length === 1 ? "" : "s"}`
                : null;

              return (
                <div key={day.id} className="overflow-hidden rounded-xl border border-[#e0e4dd] bg-white">
                  {/* Header */}
                  <button
                    type="button"
                    onClick={() => setExpandedDayIdx(isOpen ? null : idx)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-[#f4ecdd]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#12343b] text-xs font-bold text-[#f6ead6]">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#11272b]">
                        {day.title.trim() || destObj?.name || `Day ${idx + 1}`}
                      </p>
                      <p className="text-xs text-[#8a9ba1]">
                        {[
                          isOvernight ? `Night ${idx + 1}` : "Final day",
                          hotelSummary,
                          mealSummary,
                          day.selectedActivityIds.length > 0 ? `${day.selectedActivityIds.length} activit${day.selectedActivityIds.length === 1 ? "y" : "ies"}` : null,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {isOpen ? <ChevronUp className="h-4 w-4 shrink-0 text-[#8a9ba1]" /> : <ChevronDown className="h-4 w-4 shrink-0 text-[#8a9ba1]" />}
                  </button>

                  {/* Expanded */}
                  {isOpen && (
                    <div className="border-t border-[#e0e4dd] space-y-5 px-4 pb-5 pt-4">

                      {/* Title */}
                      <input
                        type="text" value={day.title}
                        onChange={(e) => updateDay(idx, { title: e.target.value })}
                        placeholder={`Day ${idx + 1} title — e.g. Sigiriya Rock & Dambulla Cave Temple`}
                        className="w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2.5 text-sm text-[#11272b] placeholder-[#b0bdc2] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
                      />
                      <textarea
                        value={day.description}
                        onChange={(e) => updateDay(idx, { description: e.target.value })}
                        rows={2}
                        placeholder="What happens this day — highlights, transfers, experiences…"
                        className="w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2.5 text-sm text-[#11272b] placeholder-[#b0bdc2] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
                      />

                      {/* ── Destination picker ── */}
                      {destinations.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8a9ba1]">
                            Where is this day?
                          </p>
                          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
                            {destinations.map((d) => (
                              <button
                                key={d.id} type="button"
                                onClick={() => updateDay(idx, { destinationId: d.id, selectedActivityIds: [] })}
                                className={`rounded-lg border px-2 py-2 text-left transition ${
                                  day.destinationId === d.id
                                    ? "border-[#12343b] bg-[#12343b] text-[#f6ead6]"
                                    : "border-[#e0e4dd] bg-[#f4ecdd] text-[#11272b] hover:border-[#8a9ba1]"
                                }`}
                              >
                                <span className="block truncate text-xs font-medium">{d.shortName}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── Hotels (only for overnight days) ── */}
                      {isOvernight && (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8a9ba1]">
                            Hotel options for Night {idx + 1}
                          </p>

                          {/* Own accommodation toggle */}
                          <button
                            type="button"
                            onClick={() => updateDay(idx, {
                              hotelMode: day.hotelMode === "own" ? "pick" : "own",
                              accommodationOptions: [],
                              mealPlanOptions: [],
                            })}
                            className={`mb-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                              day.hotelMode === "own"
                                ? "border-[#c9922f] bg-[#c9922f]/10 text-[#c9922f]"
                                : "border-[#e0e4dd] bg-[#f4ecdd] text-[#5e7279] hover:bg-[#eaded0]"
                            }`}
                          >
                            <span className={`flex h-4 w-4 items-center justify-center rounded border ${
                              day.hotelMode === "own" ? "border-[#c9922f] bg-[#c9922f]" : "border-[#c0b8ae]"
                            }`}>
                              {day.hotelMode === "own" && <Check className="h-3 w-3 text-white" />}
                            </span>
                            Guest books own accommodation (meal plan not required)
                          </button>

                          {day.hotelMode === "pick" && (
                            <>
                              {destHotels.length === 0 && (
                                <p className="rounded-xl border border-dashed border-[#ddd3c4] py-3 text-center text-xs text-[#8a9ba1]">
                                  {day.destinationId ? "No hotels found for this destination." : "Select a destination above to see the hotel catalog."}
                                </p>
                              )}
                              <div className="space-y-1.5">
                                {destHotels.map((h) => {
                                  const isAdded = day.accommodationOptions.some((o) => o.supplierId === h.id);
                                  return (
                                    <button
                                      key={h.id} type="button" onClick={() => toggleHotel(idx, h)}
                                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                                        isAdded
                                          ? "border-[#12343b] bg-[#12343b] text-[#f6ead6] shadow-sm"
                                          : "border-[#e0e4dd] bg-white text-[#11272b] hover:border-[#8a9ba1]"
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold truncate">{h.name}</p>
                                        <p className={`text-xs ${isAdded ? "text-[#f6ead6]/70" : "text-[#5e7279]"}`}>
                                          {h.defaultPricePerNight != null
                                            ? `${h.defaultPricePerNight.toLocaleString()} ${h.currency}/night`
                                            : "Rate not set"}
                                          {h.location ? ` · ${h.location}` : ""}
                                        </p>
                                      </div>
                                      <div className="ml-3 flex shrink-0 items-center gap-2">
                                        {h.starRating ? (
                                          <span className={`text-xs tracking-tight ${isAdded ? "text-yellow-300" : "text-yellow-500"}`}>
                                            {"★".repeat(h.starRating)}
                                          </span>
                                        ) : null}
                                        {isAdded && <Check className="h-4 w-4" />}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                              {day.accommodationOptions.length > 0 && (
                                <p className="mt-1.5 text-xs text-[#8a9ba1]">
                                  {day.accommodationOptions.length} hotel{day.accommodationOptions.length === 1 ? "" : "s"} added — guest picks on booking. Cheapest sets the base price.
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {/* ── Meal plans (only if hotel is selected, not "own") ── */}
                      {isOvernight && day.hotelMode === "pick" && day.accommodationOptions.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8a9ba1]">
                            Meal plan options for Night {idx + 1}
                          </p>
                          {dayMealPlans.length === 0 ? (
                            <p className="text-xs text-[#8a9ba1]">
                              No meal plans found for the selected hotels. Add meal plans to hotels in the Suppliers section.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {dayMealPlans.map((mp) => {
                                const isAdded = day.mealPlanOptions.some(
                                  (o) => o.supplierId === mp.hotelId && o.label.endsWith(mp.label)
                                );
                                return (
                                  <button
                                    key={mp.id} type="button" onClick={() => toggleMealPlan(idx, mp)}
                                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                      isAdded
                                        ? "border-[#12343b] bg-[#12343b] text-[#f6ead6]"
                                        : "border-[#e0e4dd] bg-[#f4ecdd] text-[#11272b] hover:border-[#8a9ba1]"
                                    }`}
                                  >
                                    {mp.label}
                                    <span className={`ml-1 ${isAdded ? "text-[#f6ead6]/70" : "text-[#8a9ba1]"}`}>
                                      · {mp.pricePerPerson.toLocaleString()} {mp.currency}/person
                                    </span>
                                    {isAdded && <Check className="ml-1 inline h-3 w-3" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Activities ── */}
                      {activities.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8a9ba1]">
                            Activities in {destObj?.shortName ?? "this destination"}
                          </p>
                          <div className="space-y-1.5">
                            {activities.map((act) => {
                              const isSelected = day.selectedActivityIds.includes(act.id);
                              return (
                                <button
                                  key={act.id} type="button" onClick={() => toggleActivity(idx, act.id)}
                                  className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                                    isSelected
                                      ? "border-[#12343b] bg-[#12343b]/5"
                                      : "border-[#e0e4dd] bg-white hover:border-[#8a9ba1]"
                                  }`}
                                >
                                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] ${
                                    isSelected ? "border-[#12343b] bg-[#12343b] text-white" : "border-[#c0b8ae] bg-white"
                                  }`}>
                                    {isSelected && <Check className="h-3 w-3" />}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-[#11272b]">{act.title}</p>
                                    <p className="mt-0.5 text-xs text-[#5e7279]">{act.summary}</p>
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                      <span className="rounded-full bg-[#f4ecdd] px-2 py-0.5 text-[10px] text-[#5e7279]">{act.durationLabel}</span>
                                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                                        act.energy === "easy" ? "bg-green-50 text-green-700"
                                          : act.energy === "moderate" ? "bg-amber-50 text-amber-700"
                                          : "bg-orange-50 text-orange-700"
                                      }`}>{act.energy}</span>
                                      {act.estimatedPrice > 0 && (
                                        <span className="rounded-full bg-[#f4ecdd] px-2 py-0.5 text-[10px] text-[#5e7279]">
                                          ~{act.estimatedPrice} USD
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Day actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <button type="button" onClick={() => duplicateDay(idx)}
                          className="rounded-lg border border-[#e0e4dd] px-3 py-1.5 text-xs font-medium text-[#5e7279] transition hover:bg-[#f4ecdd]">
                          + Extra night here
                        </button>
                        {days.length > 1 && (
                          <button type="button" onClick={() => removeDay(idx)}
                            className="ml-auto flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50">
                            <Trash2 className="h-3 w-3" /> Remove day
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Departure marker */}
            {days.length > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#12343b]/30 bg-[#12343b]/5 px-4 py-3">
                <PlaneLanding className="h-4 w-4 rotate-180 text-[#12343b]" />
                <p className="text-sm font-semibold text-[#12343b]">Departure · after Day {days.length}</p>
              </div>
            )}

            {/* Add a day */}
            <button type="button" onClick={addDay}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#12343b]/30 py-4 text-sm font-semibold text-[#12343b] transition hover:border-[#12343b]/60 hover:bg-[#12343b]/5">
              <Plus className="h-4 w-4" /> Add a day
            </button>

            <button type="button"
              onClick={() => { setError(""); setOpenSection(4); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#12343b] py-3 text-sm font-semibold text-[#f6ead6] transition hover:bg-[#1a474f]">
              Next: What's included <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </SectionAccordion>

        {/* ═══════════════════════════════════════════════ */}
        {/*  STEP 4 — Finalize                             */}
        {/* ═══════════════════════════════════════════════ */}
        <SectionAccordion
          number={4} title="What's Included"
          subtitle={inclusions.length > 0 || exclusions.length > 0
            ? `${inclusions.length + activityInclusions.length} inclusions · ${exclusions.length} exclusions`
            : "Inclusions, exclusions and package description"}
          open={openSection === 4} done={sectionDone(4)}
          onToggle={() => setOpenSection(openSection === 4 ? 0 : 4)}
        >
          <div className="space-y-6">

            {/* Activity inclusions (auto-generated) */}
            {activityInclusions.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-[#c9922f]" />
                  <p className="text-sm font-semibold text-[#11272b]">Auto-generated from activities</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activityInclusions.map((item) => (
                    <span key={item} className="flex items-center gap-1 rounded-full border border-[#c9922f]/30 bg-[#c9922f]/10 px-3 py-1 text-xs font-medium text-[#c9922f]">
                      <Check className="h-3 w-3" />{item}
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-[#8a9ba1]">These are added to the package inclusions automatically.</p>
              </div>
            )}

            <div className="grid gap-6 sm:grid-cols-2">
              <ListEditor
                label="Additional inclusions"
                items={inclusions}
                onChange={setInclusions}
                placeholder="e.g. All accommodation, Daily breakfast…"
                accent="bg-[#c9922f]"
              />
              <ListEditor
                label="Exclusions"
                items={exclusions}
                onChange={setExclusions}
                placeholder="e.g. International flights, Travel insurance…"
                accent="bg-[#c0b8ae]"
              />
            </div>

            {/* Package description */}
            <div>
              <label className={LABEL}>Package description</label>
              <textarea
                name="description" rows={3} value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={INPUT}
                placeholder="Overview that clients will read before booking…"
              />
            </div>

            {/* Image + Cancellation */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="imageUrl" className={LABEL}>Cover image URL</label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <ImageIcon className="pointer-events-none absolute left-3 top-[calc(50%+2px)] h-4 w-4 -translate-y-1/2 text-[#8a9ba1]" />
                    <input id="imageUrl" name="imageUrl" type="url"
                      value={imageUrlInput} onChange={(e) => setImageUrlInput(e.target.value)}
                      className={`${INPUT} pl-9`} placeholder="https://…" />
                  </div>
                  {imageUrlInput && (
                    <img src={imageUrlInput} alt="preview"
                      className="h-10 w-14 shrink-0 rounded-lg border border-[#e0e4dd] object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="cancellationPolicy" className={LABEL}>Cancellation policy</label>
                <input id="cancellationPolicy" name="cancellationPolicy" type="text"
                  defaultValue={pkg?.cancellationPolicy ?? ""} className={INPUT}
                  placeholder="Free cancellation up to 48h before departure" />
              </div>
            </div>

            {/* Pricing summary */}
            <div className="rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#11272b]">
                <DollarSign className="h-4 w-4 text-[#c9922f]" />
                Calculated package price
              </div>
              <p className="mt-1 text-xs text-[#8a9ba1]">
                Based on cheapest options (1 traveller). Guests who upgrade will pay the difference.
              </p>
              <p className="mt-2 text-2xl font-bold text-[#12343b]">
                {minPrice > 0 ? fmt(minPrice, currency) : <span className="text-base font-normal text-[#8a9ba1]">Add hotels and transport to see price</span>}
              </p>
              <p className="mt-0.5 text-xs text-[#8a9ba1]">{duration} · starting from</p>
              {/* Hidden input carries the computed price */}
              <input type="hidden" name="price" value={minPrice > 0 ? minPrice : 0} readOnly />
              <input type="hidden" name="duration" value={duration} readOnly />
            </div>

          </div>
        </SectionAccordion>

      </div>

      {/* ══════════════════════════════════════════════ */}
      {/*  STICKY BOTTOM BAR                            */}
      {/* ══════════════════════════════════════════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#e0e4dd] bg-[#fffbf4]/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[#11272b]">{packageName.trim() || "Untitled Package"}</p>
            <p className="text-xs text-[#5e7279]">
              {destination.trim() || "No destination"} · {days.length}D / {nights}N
            </p>
          </div>
          <div className="hidden shrink-0 text-right sm:block">
            <p className="text-xs text-[#8a9ba1]">Starting from (1 pax)</p>
            <p className="text-sm font-bold text-[#12343b]">{minPrice > 0 ? fmt(minPrice, currency) : "—"}</p>
          </div>
          {warnings.length > 0 && (
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              <TriangleAlert className="h-3 w-3" />{warnings.length}
            </div>
          )}
          <button type="submit" disabled={submitting}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-[#12343b] px-5 py-2.5 text-sm font-semibold text-[#f6ead6] shadow-sm transition hover:bg-[#1a474f] active:scale-[0.98] disabled:opacity-60">
            {submitting ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#f6ead6]/30 border-t-[#f6ead6]" />Saving…</>
            ) : (
              <><Package className="h-4 w-4" />{pkg ? "Update Package" : "Create Package"}</>
            )}
          </button>
        </div>
      </div>

    </form>
  );
}
