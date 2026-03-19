"use client";

import { useState, type ReactNode } from "react";
import {
  BedDouble,
  Clock3,
  DollarSign,
  ListChecks,
  Map,
  Package,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type {
  TourPackage,
  ItineraryDay,
  HotelSupplier,
  PackageOption,
} from "@/lib/types";
import { calcOptionPrice } from "@/lib/package-price";
import { OptionsEditor } from "./OptionsEditor";

type PreviewLine = {
  label: string;
  sellAmount: number;
  costAmount: number;
};

function formatMoney(value: number, currency: string): string {
  return `${value.toLocaleString()} ${currency}`;
}

function parseDurationMetrics(duration: string): {
  days?: number;
  nights?: number;
} {
  const daysMatch = duration.match(/(\d+)\s*Days?/i);
  const nightsMatch = duration.match(/(\d+)\s*Nights?/i);

  return {
    days: daysMatch ? parseInt(daysMatch[1], 10) : undefined,
    nights: nightsMatch ? parseInt(nightsMatch[1], 10) : undefined,
  };
}

function getRecommendedDuration(dayCount: number): string {
  const nights = Math.max(0, dayCount - 1);
  return `${dayCount} Days / ${nights} Nights`;
}

function getDefaultOption(options: PackageOption[]): PackageOption | null {
  return options.find((option) => option.isDefault) ?? options[0] ?? null;
}

function calcTrackedCost(
  option: PackageOption,
  pax: number,
  nights: number
): number {
  const cost = option.costPrice ?? option.price;

  switch (option.priceType) {
    case "per_person":
      return cost * pax;
    case "per_night":
      return cost * nights;
    case "per_day":
      return cost * Math.max(1, nights + 1);
    case "total":
      return cost;
    default:
      return cost;
  }
}

function buildPreviewSummary(args: {
  itinerary: ItineraryDay[];
  transportOptions: PackageOption[];
  mealOptions: PackageOption[];
  customOptions: PackageOption[];
  basePrice: number;
}) {
  const { itinerary, transportOptions, mealOptions, customOptions, basePrice } =
    args;
  const pax = 1;
  const expectedNights = Math.max(0, itinerary.length - 1);
  const lines: PreviewLine[] = [];
  let sellTotal = basePrice;
  let trackedCostTotal = 0;
  let configuredAccommodationNights = 0;

  itinerary.slice(0, expectedNights).forEach((day, index) => {
    const option = getDefaultOption(day.accommodationOptions ?? []);
    if (!option) return;
    configuredAccommodationNights += 1;
    const sellAmount = calcOptionPrice(option, pax, 1);
    const costAmount = calcTrackedCost(option, pax, 1);
    lines.push({
      label: `Night ${index + 1}: ${option.label}`,
      sellAmount,
      costAmount,
    });
    sellTotal += sellAmount;
    trackedCostTotal += costAmount;
  });

  const transport = getDefaultOption(transportOptions);
  if (transport) {
    const sellAmount = calcOptionPrice(transport, pax, expectedNights);
    const costAmount = calcTrackedCost(transport, pax, expectedNights);
    lines.push({
      label: `Transport: ${transport.label}`,
      sellAmount,
      costAmount,
    });
    sellTotal += sellAmount;
    trackedCostTotal += costAmount;
  }

  const meals = getDefaultOption(mealOptions);
  if (meals) {
    const sellAmount = calcOptionPrice(meals, pax, expectedNights);
    const costAmount = calcTrackedCost(meals, pax, expectedNights);
    lines.push({
      label: `Meals: ${meals.label}`,
      sellAmount,
      costAmount,
    });
    sellTotal += sellAmount;
    trackedCostTotal += costAmount;
  }

  customOptions
    .filter((option) => option.isDefault)
    .forEach((option) => {
      const sellAmount = calcOptionPrice(option, pax, expectedNights);
      const costAmount = calcTrackedCost(option, pax, expectedNights);
      lines.push({
        label: `Included add-on: ${option.label}`,
        sellAmount,
        costAmount,
      });
      sellTotal += sellAmount;
      trackedCostTotal += costAmount;
    });

  return {
    lines,
    sellTotal,
    trackedCostTotal,
    configuredAccommodationNights,
    expectedNights,
    trackedSpread: sellTotal - trackedCostTotal,
  };
}

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
    <section className="overflow-hidden rounded-2xl border border-white/30 bg-white/45 shadow-sm backdrop-blur-sm">
      <div className="border-b border-white/20 bg-white/35 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
              {step}
            </p>
            <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
            <p className="mt-1 text-sm text-stone-600">{description}</p>
          </div>
        </div>
      </div>
      <div className="space-y-6 p-5">{children}</div>
    </section>
  );
}

function ComposerStat({
  label,
  value,
  accent = "text-stone-900",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/30 bg-white/55 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

export function PackageForm({
  pkg,
  hotels = [],
  onSubmit,
}: {
  pkg?: TourPackage;
  hotels?: HotelSupplier[];
  onSubmit: (formData: FormData) => Promise<{ error?: string } | void>;
}) {
  const [error, setError] = useState<string>("");
  const [packageName, setPackageName] = useState(pkg?.name ?? "");
  const [destination, setDestination] = useState(pkg?.destination ?? "");
  const [duration, setDuration] = useState(
    pkg?.duration ?? getRecommendedDuration(pkg?.itinerary?.length ?? 1)
  );
  const [priceInput, setPriceInput] = useState(
    pkg?.price != null ? String(pkg.price) : ""
  );
  const [currency, setCurrency] = useState(pkg?.currency ?? "USD");
  const [itinerary, setItinerary] = useState<ItineraryDay[]>(
    pkg?.itinerary?.length
      ? pkg.itinerary.map((day) => ({
          ...day,
          accommodationOptions: day.accommodationOptions ?? [],
        }))
      : [
          {
            day: 1,
            title: "",
            description: "",
            accommodation: "",
            accommodationOptions: [],
          },
        ]
  );
  const [mealOptions, setMealOptions] = useState<PackageOption[]>(
    pkg?.mealOptions ?? []
  );
  const [transportOptions, setTransportOptions] = useState<PackageOption[]>(
    pkg?.transportOptions ?? []
  );
  const [customOptions, setCustomOptions] = useState<PackageOption[]>(
    pkg?.customOptions ?? []
  );

  const basePrice = parseFloat(priceInput) || 0;
  const recommendedDuration = getRecommendedDuration(itinerary.length);
  const durationMetrics = parseDurationMetrics(duration);
  const itineraryDays = itinerary.length;
  const itineraryNights = Math.max(0, itineraryDays - 1);
  const durationMismatch =
    durationMetrics.days !== undefined &&
    durationMetrics.nights !== undefined &&
    (durationMetrics.days !== itineraryDays ||
      durationMetrics.nights !== itineraryNights);
  const preview = buildPreviewSummary({
    itinerary,
    transportOptions,
    mealOptions,
    customOptions,
    basePrice,
  });
  const missingAccommodationNights = Array.from(
    { length: itineraryNights },
    (_, index) => index + 1
  ).filter(
    (nightNumber) =>
      (itinerary[nightNumber - 1]?.accommodationOptions?.length ?? 0) === 0
  );
  const linkedSupplierIds = new Set<string>();

  itinerary.forEach((day) => {
    (day.accommodationOptions ?? []).forEach((option) => {
      if (option.supplierId) linkedSupplierIds.add(option.supplierId);
    });
  });
  mealOptions.forEach((option) => {
    if (option.supplierId) linkedSupplierIds.add(option.supplierId);
  });
  transportOptions.forEach((option) => {
    if (option.supplierId) linkedSupplierIds.add(option.supplierId);
  });
  customOptions.forEach((option) => {
    if (option.supplierId) linkedSupplierIds.add(option.supplierId);
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const formData = new FormData(form);

    itinerary.forEach((day, index) => {
      formData.set(`itinerary_${index}_title`, day.title);
      formData.set(`itinerary_${index}_description`, day.description);
      formData.set(`itinerary_${index}_accommodation`, day.accommodation || "");
      formData.set(
        `itinerary_${index}_accommodationOptions`,
        JSON.stringify(day.accommodationOptions ?? [])
      );
    });

    formData.set("mealOptions", JSON.stringify(mealOptions));
    formData.set("transportOptions", JSON.stringify(transportOptions));
    formData.set("customOptions", JSON.stringify(customOptions));

    const result = await onSubmit(formData);
    if (result && "error" in result && result.error) {
      setError(result.error);
    }
  }

  function updateDay(index: number, patch: Partial<ItineraryDay>) {
    setItinerary((prev) =>
      prev.map((day, dayIndex) =>
        dayIndex === index ? { ...day, ...patch } : day
      )
    );
  }

  function addDay() {
    setItinerary((prev) => [
      ...prev,
      {
        day: prev.length + 1,
        title: "",
        description: "",
        accommodation: "",
        accommodationOptions: [],
      },
    ]);
  }

  function removeDay(index: number) {
    setItinerary((prev) => prev.filter((_, dayIndex) => dayIndex !== index));
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {error ? (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <SectionCard
            icon={Sparkles}
            step="Step 1"
            title="Package Basics"
            description="Set the client-facing identity, duration, and sell price for the package."
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-stone-700"
                >
                  Package Name *
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
                  placeholder="Ceylon Heritage & Wildlife"
                />
              </div>
              <div>
                <label
                  htmlFor="destination"
                  className="block text-sm font-medium text-stone-700"
                >
                  Destination *
                </label>
                <input
                  id="destination"
                  name="destination"
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
                  placeholder="Sri Lanka"
                />
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="region"
                  className="block text-sm font-medium text-stone-700"
                >
                  Region
                </label>
                <select
                  id="region"
                  name="region"
                  defaultValue={pkg?.region ?? ""}
                  className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
                >
                  <option value="">— All Sri Lanka —</option>
                  <option value="Colombo">Colombo</option>
                  <option value="Kandy">Kandy</option>
                  <option value="Galle">Galle</option>
                  <option value="Ella">Ella</option>
                  <option value="Sigiriya">Sigiriya</option>
                  <option value="Yala">Yala</option>
                  <option value="Nuwara Eliya">Nuwara Eliya</option>
                  <option value="Southern Coast">Southern Coast</option>
                  <option value="Cultural Triangle">Cultural Triangle</option>
                  <option value="Tea Country">Tea Country</option>
                </select>
                <p className="mt-1 text-xs text-stone-500">
                  Used for client-side filtering.
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="duration"
                    className="block text-sm font-medium text-stone-700"
                  >
                    Duration
                  </label>
                  <button
                    type="button"
                    onClick={() => setDuration(recommendedDuration)}
                    className="text-xs font-medium text-teal-700 hover:text-teal-800"
                  >
                    Use itinerary length
                  </button>
                </div>
                <input
                  id="duration"
                  name="duration"
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
                  placeholder="8 Days / 7 Nights"
                />
                <p className="mt-1 text-xs text-stone-500">
                  Recommended from itinerary: {recommendedDuration}
                </p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label
                  htmlFor="rating"
                  className="block text-sm font-medium text-stone-700"
                >
                  Rating (0–5)
                </label>
                <input
                  id="rating"
                  name="rating"
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  defaultValue={pkg?.rating ?? ""}
                  className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
                  placeholder="4.9"
                />
              </div>
              <div>
                <label
                  htmlFor="reviewCount"
                  className="block text-sm font-medium text-stone-700"
                >
                  Review count
                </label>
                <input
                  id="reviewCount"
                  name="reviewCount"
                  type="number"
                  min={0}
                  defaultValue={pkg?.reviewCount ?? ""}
                  className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
                  placeholder="127"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/50 px-4 py-3 text-sm font-medium text-stone-700">
                  <input
                    type="checkbox"
                    name="featured"
                    defaultChecked={pkg?.featured ?? false}
                    className="rounded border-stone-300 text-teal-600 focus:ring-teal-400"
                  />
                  Featured on homepage
                </label>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/50 px-4 py-3 text-sm font-medium text-stone-700">
                  <input
                    type="checkbox"
                    name="published"
                    defaultChecked={pkg?.published ?? true}
                    className="rounded border-stone-300 text-teal-600 focus:ring-teal-400"
                  />
                  Visible to clients
                </label>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="cancellationPolicy"
                  className="block text-sm font-medium text-stone-700"
                >
                  Cancellation policy (optional)
                </label>
                <input
                  id="cancellationPolicy"
                  name="cancellationPolicy"
                  type="text"
                  defaultValue={pkg?.cancellationPolicy ?? ""}
                  className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
                  placeholder="Free cancellation up to 24 hours before"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="imageUrl"
                  className="block text-sm font-medium text-stone-700"
                >
                  Image URL
                </label>
                <input
                  id="imageUrl"
                  name="imageUrl"
                  type="url"
                  defaultValue={pkg?.imageUrl ?? ""}
                  className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
                  placeholder="https://images.unsplash.com/photo-xxx"
                />
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="price"
                  className="block text-sm font-medium text-stone-700"
                >
                  Base package price *
                </label>
                <input
                  id="price"
                  name="price"
                  type="number"
                  min={0}
                  step={0.01}
                  required
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 text-lg font-semibold backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
                />
                <p className="mt-1 text-xs text-stone-500">
                  This is the per-traveller base before selected options are added.
                </p>
              </div>
              <div>
                <label
                  htmlFor="currency"
                  className="block text-sm font-medium text-stone-700"
                >
                  Currency
                </label>
                <select
                  id="currency"
                  name="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="LKR">LKR</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-stone-700"
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={pkg?.description}
                className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
                placeholder="Package overview..."
              />
            </div>
          </SectionCard>

          <SectionCard
            icon={Map}
            step="Step 2"
            title="Map The Journey"
            description="Build the day-by-day route first. Hotel choices are only configured for actual overnight stays."
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-stone-700">Itinerary days</p>
                <p className="text-xs text-stone-500">
                  {itineraryDays} day plan, {itineraryNights} overnight stay
                  {itineraryNights === 1 ? "" : "s"}.
                </p>
              </div>
              <button
                type="button"
                onClick={addDay}
                className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700 transition hover:bg-teal-100"
              >
                <Plus className="h-4 w-4" />
                Add Day
              </button>
            </div>

            <div className="space-y-4">
              {itinerary.map((day, index) => {
                const isStayNight = index < itineraryNights;

                return (
                  <div
                    key={index}
                    className="rounded-2xl border border-white/30 bg-white/55 p-4"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-sm font-semibold text-stone-700">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-stone-900">
                            Day {index + 1}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            {isStayNight
                              ? `Night ${index + 1} accommodation applies to this day`
                              : "Final day or transit day, no overnight stay expected"}
                          </p>
                        </div>
                      </div>
                      {itinerary.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeDay(index)}
                          className="rounded-xl p-2 text-red-500 transition hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      <input
                        type="text"
                        value={day.title}
                        onChange={(e) =>
                          updateDay(index, { title: e.target.value })
                        }
                        placeholder="Title"
                        className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2.5 text-sm"
                      />
                      <textarea
                        value={day.description}
                        onChange={(e) =>
                          updateDay(index, { description: e.target.value })
                        }
                        rows={2}
                        placeholder="Description"
                        className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2.5 text-sm"
                      />

                      {isStayNight ? (
                        <OptionsEditor
                          title={`Night ${index + 1} accommodation choices`}
                          options={day.accommodationOptions ?? []}
                          onChange={(options) =>
                            updateDay(index, { accommodationOptions: options })
                          }
                          hotels={hotels}
                          showSupplier
                          supplierType="hotel"
                          allowCustom={false}
                          packageCurrency={currency}
                        />
                      ) : (
                        <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/70 px-4 py-3 text-sm text-stone-500">
                          No hotel selector shown here because this day is outside the overnight stay count.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            icon={Package}
            step="Step 3"
            title="Price The Experience"
            description="Link transport, meals, and add-ons to suppliers. Their saved rates are copied in as your starting point."
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <OptionsEditor
                title="Meal plans"
                options={mealOptions}
                onChange={setMealOptions}
                hotels={hotels}
                showSupplier
                supplierType="meal"
                packageCurrency={currency}
              />
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

          <SectionCard
            icon={ListChecks}
            step="Step 4"
            title="What’s Included"
            description="Document what the client gets and what stays outside the package."
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="inclusions"
                  className="block text-sm font-medium text-stone-700"
                >
                  Inclusions
                </label>
                <textarea
                  id="inclusions"
                  name="inclusions"
                  rows={5}
                  defaultValue={pkg?.inclusions?.join("\n")}
                  className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
                  placeholder={"One per line\nAll accommodation\nMeals as specified"}
                />
              </div>
              <div>
                <label
                  htmlFor="exclusions"
                  className="block text-sm font-medium text-stone-700"
                >
                  Exclusions
                </label>
                <textarea
                  id="exclusions"
                  name="exclusions"
                  rows={5}
                  defaultValue={pkg?.exclusions?.join("\n")}
                  className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
                  placeholder={"One per line\nInternational flights\nTravel insurance"}
                />
              </div>
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="overflow-hidden rounded-3xl border border-teal-200/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(237,255,252,0.96))] shadow-lg backdrop-blur-sm">
            <div className="border-b border-teal-100 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
                Tour Composer
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-stone-900">
                {packageName.trim() || "Untitled Package"}
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                {destination.trim() || "Choose destination"} · {currency}
              </p>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <ComposerStat
                  label="Planned Duration"
                  value={`${itineraryDays}D / ${itineraryNights}N`}
                  accent="text-teal-700"
                />
                <ComposerStat
                  label="Hotel Nights Ready"
                  value={`${preview.configuredAccommodationNights}/${itineraryNights}`}
                  accent={
                    missingAccommodationNights.length > 0
                      ? "text-amber-600"
                      : "text-emerald-600"
                  }
                />
                <ComposerStat
                  label="Linked Suppliers"
                  value={String(linkedSupplierIds.size)}
                />
                <ComposerStat
                  label="Base Price"
                  value={formatMoney(basePrice, currency)}
                  accent="text-stone-900"
                />
              </div>

              <div className="rounded-2xl border border-white/40 bg-white/65 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                  <DollarSign className="h-4 w-4 text-teal-700" />
                  Live pricing preview
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  Based on 1 traveller and the default or first option in each group.
                </p>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3 text-stone-700">
                    <span>Base package</span>
                    <span className="font-medium">
                      {formatMoney(basePrice, currency)}
                    </span>
                  </div>
                  {preview.lines.map((line) => (
                    <div
                      key={line.label}
                      className="flex items-center justify-between gap-3 text-stone-600"
                    >
                      <span className="max-w-[70%] truncate">{line.label}</span>
                      <span>{formatMoney(line.sellAmount, currency)}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2 border-t border-stone-200/70 pt-4">
                  <div className="flex items-center justify-between gap-3 text-sm font-semibold text-stone-900">
                    <span>Default guest total</span>
                    <span>{formatMoney(preview.sellTotal, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm text-stone-600">
                    <span>Tracked supplier cost</span>
                    <span>{formatMoney(preview.trackedCostTotal, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm font-semibold text-emerald-700">
                    <span>Tracked spread</span>
                    <span>{formatMoney(preview.trackedSpread, currency)}</span>
                  </div>
                </div>

                <p className="mt-3 text-xs text-stone-500">
                  Tracked spread uses linked supplier costs only. Fixed internal costs are not included yet.
                </p>
              </div>

              <div className="rounded-2xl border border-white/40 bg-white/60 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                  <Clock3 className="h-4 w-4 text-teal-700" />
                  Builder health
                </div>
                <div className="mt-3 space-y-2 text-sm text-stone-600">
                  <div className="flex items-center justify-between">
                    <span>Accommodation option rows</span>
                    <span>
                      {itinerary.reduce(
                        (total, day) =>
                          total + (day.accommodationOptions?.length ?? 0),
                        0
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Transport options</span>
                    <span>{transportOptions.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Meal options</span>
                    <span>{mealOptions.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Included add-ons</span>
                    <span>
                      {customOptions.filter((option) => option.isDefault).length}
                    </span>
                  </div>
                </div>
              </div>

              {durationMismatch ||
              missingAccommodationNights.length > 0 ||
              transportOptions.length === 0 ||
              mealOptions.length === 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                    <TriangleAlert className="h-4 w-4" />
                    Needs attention
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-amber-900">
                    {durationMismatch ? (
                      <li>
                        Duration text says {duration}, but the itinerary currently maps to{" "}
                        {recommendedDuration}.
                      </li>
                    ) : null}
                    {missingAccommodationNights.length > 0 ? (
                      <li>
                        Hotel choices are missing for night
                        {missingAccommodationNights.length === 1 ? "" : "s"}{" "}
                        {missingAccommodationNights.join(", ")}.
                      </li>
                    ) : null}
                    {transportOptions.length === 0 ? (
                      <li>No transport option is configured yet.</li>
                    ) : null}
                    {mealOptions.length === 0 ? (
                      <li>No meal option is configured yet.</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-2xl border border-stone-200/70 bg-white/60 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                  <BedDouble className="h-4 w-4 text-teal-700" />
                  Best way to craft a tour
                </div>
                <div className="mt-3 space-y-2 text-sm text-stone-600">
                  <p>1. Build the route and nights first.</p>
                  <p>2. Pick supplier-backed hotels, transport, and meals.</p>
                  <p>3. Let supplier rates fill the starting numbers.</p>
                  <p>4. Adjust sell price and cost only where the package needs it.</p>
                </div>
              </div>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-teal-700"
              >
                <Package className="h-4 w-4" />
                {pkg ? "Update Package" : "Create Package"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
