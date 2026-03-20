"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Building2, Car, UtensilsCrossed } from "lucide-react";
import type { TourPackage, PackageOption, HotelSupplier } from "@/lib/types";
import { calcOptionPrice } from "@/lib/package-price";
import { createClientBookingAction } from "@/app/actions/client-booking";
import { debugClient } from "@/lib/debug";

function parseNights(duration: string): number {
  const m = duration.match(/(\d+)\s*[Nn]ight/);
  return m ? parseInt(m[1], 10) : 0;
}

function getAccommodationOptionsForNight(pkg: TourPackage, nightIndex: number): PackageOption[] {
  const day = pkg.itinerary?.[nightIndex];
  if (day?.accommodationOptions?.length) return day.accommodationOptions;
  return pkg.accommodationOptions ?? [];
}

/**
 * Get accommodation options for each night. Uses night-specific options,
 * then falls back to first night's options, then package-level (legacy).
 * Always returns one entry per night so Nights 1–4 all show selectors.
 */
function getAllAccommodationNightOptions(pkg: TourPackage): { nightIndex: number; options: PackageOption[] }[] {
  const nights = parseNights(pkg.duration) || 1;
  const result: { nightIndex: number; options: PackageOption[] }[] = [];
  const packageLevel = pkg.accommodationOptions ?? [];

  // Precompute fallback: night 0 options, or package-level, or first itinerary day with options
  let fallbackOptions: PackageOption[] =
    getAccommodationOptionsForNight(pkg, 0).length > 0
      ? getAccommodationOptionsForNight(pkg, 0)
      : packageLevel;
  if (fallbackOptions.length === 0) {
    const firstWithOptions = pkg.itinerary?.find((d) => d.accommodationOptions?.length);
    if (firstWithOptions?.accommodationOptions?.length)
      fallbackOptions = firstWithOptions.accommodationOptions;
  }
  if (fallbackOptions.length === 0 && packageLevel.length > 0) fallbackOptions = packageLevel;

  for (let i = 0; i < nights; i++) {
    let opts = getAccommodationOptionsForNight(pkg, i);
    if (opts.length === 0) opts = fallbackOptions;
    if (opts.length === 0 && i > 0) opts = getAccommodationOptionsForNight(pkg, 0) || packageLevel;
    if (fallbackOptions.length === 0 && opts.length > 0) fallbackOptions = opts;
    // Always add every night when we have any options (ensures all 4 nights show for 4-night packages)
    if (opts.length > 0) result.push({ nightIndex: i, options: opts });
  }
  return result;
}

/** Legacy: single accommodation for whole stay. Only for 1-night packages. */
function hasLegacyAccommodation(pkg: TourPackage): boolean {
  const nights = parseNights(pkg.duration) || 1;
  if (nights > 1) return false; // Multi-night: always show per-night selectors
  return (pkg.accommodationOptions?.length ?? 0) > 0 && !pkg.itinerary?.some((d) => d.accommodationOptions?.length);
}

function StarRating({ stars }: { stars: number }) {
  const filled = "★".repeat(Math.min(5, Math.max(0, stars)));
  const empty = "☆".repeat(5 - filled.length);
  return (
    <span className="block text-xs font-medium text-amber-600" title={`${stars} star${stars !== 1 ? "s" : ""}`}>
      {filled}{empty}
    </span>
  );
}

export function ClientBookingForm({ pkg, hotels = [] }: { pkg: TourPackage; hotels?: HotelSupplier[] }) {
  const getStarRating = (supplierId?: string) =>
    supplierId ? hotels.find((h) => h.id === supplierId)?.starRating : undefined;
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nights = parseNights(pkg.duration) || 7;

  const transportOptions = useMemo(() => pkg.transportOptions ?? [], [pkg.transportOptions]);
  const mealOptions = useMemo(() => pkg.mealOptions ?? [], [pkg.mealOptions]);
  const legacyAccommodation = useMemo(() => hasLegacyAccommodation(pkg), [pkg]);
  const legacyAccommodationOptions = useMemo(
    () => pkg.accommodationOptions ?? [],
    [pkg.accommodationOptions]
  );
  const perNightAccommodation = useMemo(() => getAllAccommodationNightOptions(pkg), [pkg]);

  const getDefault = (opts: PackageOption[]) =>
    opts.find((o) => o.isDefault)?.id ?? opts[0]?.id ?? "";

  const defaultAccommodationByNight = useMemo(
    () =>
      Object.fromEntries(
        perNightAccommodation.map(({ nightIndex, options }) => [
          nightIndex,
          getDefault(options),
        ])
      ) as Record<number, string>,
    [perNightAccommodation]
  );

  const [transportId, setTransportId] = useState(() =>
    transportOptions.length ? getDefault(transportOptions) : ""
  );
  const [mealId, setMealId] = useState(() =>
    mealOptions.length ? getDefault(mealOptions) : ""
  );
  const [pax, setPax] = useState(2);
  // Legacy: single accommodation id. Per-night: { nightIndex: optionId }
  const [accommodationId, setAccommodationId] = useState(() =>
    legacyAccommodation && legacyAccommodationOptions.length
      ? getDefault(legacyAccommodationOptions)
      : ""
  );
  const [accommodationByNight, setAccommodationByNight] = useState<Record<number, string>>(
    defaultAccommodationByNight
  );

  const totalPrice = useMemo(() => {
    let total = pkg.price * pax;
    const opt = (opts: PackageOption[], id: string) => opts.find((o) => o.id === id);

    const tr = opt(transportOptions, transportId);
    if (tr) total += calcOptionPrice(tr, pax, nights);

    if (legacyAccommodation) {
      const acc = opt(legacyAccommodationOptions, accommodationId);
      if (acc) total += calcOptionPrice(acc, pax, nights);
    } else {
      perNightAccommodation.forEach(({ nightIndex, options }) => {
        const id = accommodationByNight[nightIndex];
        const acc = opt(options, id);
        if (acc) total += calcOptionPrice(acc, pax, 1);
      });
    }

    const me = opt(mealOptions, mealId);
    if (me) total += calcOptionPrice(me, pax, nights);

    return total;
  }, [
    pkg.price,
    pax,
    nights,
    transportId,
    mealId,
    accommodationId,
    accommodationByNight,
    legacyAccommodation,
    legacyAccommodationOptions,
    perNightAccommodation,
    transportOptions,
    mealOptions,
  ]);

  const hasAccommodation =
    legacyAccommodation
      ? accommodationId && legacyAccommodationOptions.length
      : perNightAccommodation.length > 0 &&
        perNightAccommodation.every(({ nightIndex }) => accommodationByNight[nightIndex]);

  const canSubmit =
    transportOptions.length > 0 &&
    mealOptions.length > 0 &&
    hasAccommodation &&
    transportId &&
    mealId;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("packageId", pkg.id);
    formData.set("pax", String(pax));
    formData.set("selectedTransportOptionId", transportId);
    formData.set("selectedMealOptionId", mealId);
    formData.set("totalPrice", String(totalPrice));
    if (legacyAccommodation) {
      formData.set("selectedAccommodationOptionId", accommodationId);
    } else {
      formData.set("selectedAccommodationByNight", JSON.stringify(accommodationByNight));
    }

    debugClient("ClientBooking: submit", { packageId: pkg.id, pax, totalPrice });
    const result = await createClientBookingAction(pkg.id, formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push(
      result.reference
        ? `/booking-confirmed?ref=${encodeURIComponent(result.reference)}`
        : "/booking-confirmed"
    );
    router.refresh();
  }

  const hasAnyAccommodation = legacyAccommodation ? legacyAccommodationOptions.length > 0 : perNightAccommodation.length > 0;

  if (
    !hasAnyAccommodation ||
    transportOptions.length === 0 ||
    mealOptions.length === 0
  ) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-amber-800">
          This package does not have options configured yet. Please contact us for a quote.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
          Configure this route
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-stone-900">
          Choose the stay style and traveller details
        </h2>
      </div>

      <div className="sticky top-24 z-10 rounded-[1.6rem] border border-[#d7c2a4] bg-[#f3e3c7]/92 p-5 shadow-[0_18px_44px_-30px_rgba(43,32,15,0.55)] backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium uppercase tracking-[0.18em] text-[#8c6a38]">
            Estimated total
          </span>
          <span className="text-2xl font-semibold text-[#12343b]">
            {totalPrice.toLocaleString()} {pkg.currency}
          </span>
        </div>
        <p className="mt-2 text-sm text-stone-700">
          For {pax} traveller{pax !== 1 ? "s" : ""} × {nights} nights
        </p>
      </div>

      <div className="space-y-6">
        <section className="rounded-[1.75rem] border border-[#e5d7c4] bg-[#fbf7f1] p-5 sm:p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-stone-900">
            <Car className="h-5 w-5 text-[#12343b]" />
            1. Choose transportation
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {transportOptions.map((opt) => (
              <label
                key={opt.id}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-[1.25rem] border p-4 transition ${
                  transportId === opt.id
                    ? "border-[#12343b] bg-[#f3e3c7]"
                    : "border-[#ddc8b0] bg-white hover:border-[#b78c54]"
                }`}
              >
                <input
                  type="radio"
                  name="transport"
                  value={opt.id}
                  checked={transportId === opt.id}
                  onChange={() => setTransportId(opt.id)}
                  className="sr-only"
                />
                <span className="font-medium text-stone-900">{opt.label}</span>
                <span className="text-sm font-medium text-[#12343b]">
                  +{calcOptionPrice(opt, pax, nights).toLocaleString()} {pkg.currency}
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-[#e5d7c4] bg-[#fbf7f1] p-5 sm:p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-stone-900">
            <Building2 className="h-5 w-5 text-[#12343b]" />
            2. Choose accommodation
          </h3>
          {legacyAccommodation ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {legacyAccommodationOptions.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-[1.25rem] border p-4 transition ${
                    accommodationId === opt.id
                      ? "border-[#12343b] bg-[#f3e3c7]"
                      : "border-[#ddc8b0] bg-white hover:border-[#b78c54]"
                  }`}
                >
                  <input
                    type="radio"
                    name="accommodation"
                    value={opt.id}
                    checked={accommodationId === opt.id}
                    onChange={() => setAccommodationId(opt.id)}
                    className="sr-only"
                  />
                  <div className="flex flex-col">
                    <span className="font-medium text-stone-900">{opt.label}</span>
                    {getStarRating(opt.supplierId) != null && (
                      <StarRating stars={getStarRating(opt.supplierId)!} />
                    )}
                  </div>
                  <span className="text-sm font-medium text-[#12343b]">
                    +{calcOptionPrice(opt, pax, nights).toLocaleString()} {pkg.currency}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {perNightAccommodation.map(({ nightIndex, options }) => (
                <div
                  key={nightIndex}
                  className="rounded-[1.35rem] border border-[#ddc8b0] bg-white p-4"
                >
                  <p className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-stone-500">
                    Night {nightIndex + 1}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {options.map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-[1.15rem] border p-3 transition ${
                          accommodationByNight[nightIndex] === opt.id
                            ? "border-[#12343b] bg-[#f3e3c7]"
                            : "border-[#ddc8b0] hover:border-[#b78c54]"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`accommodation_night_${nightIndex}`}
                          value={opt.id}
                          checked={accommodationByNight[nightIndex] === opt.id}
                          onChange={() =>
                            setAccommodationByNight((prev) => ({
                              ...prev,
                              [nightIndex]: opt.id,
                            }))
                          }
                          className="sr-only"
                        />
                        <div className="flex flex-col">
                          <span className="font-medium text-stone-900">{opt.label}</span>
                          {getStarRating(opt.supplierId) != null && (
                            <StarRating stars={getStarRating(opt.supplierId)!} />
                          )}
                        </div>
                        <span className="text-sm font-medium text-[#12343b]">
                          +{calcOptionPrice(opt, pax, 1).toLocaleString()} {pkg.currency}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[1.75rem] border border-[#e5d7c4] bg-[#fbf7f1] p-5 sm:p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-stone-900">
            <UtensilsCrossed className="h-5 w-5 text-[#12343b]" />
            3. Choose meal plan
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {mealOptions.map((opt) => (
              <label
                key={opt.id}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-[1.25rem] border p-4 transition ${
                  mealId === opt.id
                    ? "border-[#12343b] bg-[#f3e3c7]"
                    : "border-[#ddc8b0] bg-white hover:border-[#b78c54]"
                }`}
              >
                <input
                  type="radio"
                  name="meal"
                  value={opt.id}
                  checked={mealId === opt.id}
                  onChange={() => setMealId(opt.id)}
                  className="sr-only"
                />
                <span className="font-medium text-stone-900">{opt.label}</span>
                <span className="text-sm font-medium text-[#12343b]">
                  +{calcOptionPrice(opt, pax, nights).toLocaleString()} {pkg.currency}
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-[#e5d7c4] bg-[#fbf7f1] p-5 sm:p-6">
          <label className="block text-lg font-semibold text-stone-900">
            4. Number of travellers
          </label>
          <input
            type="number"
            min={1}
            value={pax}
            onChange={(e) => setPax(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="mt-3 w-28 rounded-[1rem] border border-[#ddc8b0] bg-white px-4 py-3 focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
          />
        </section>
      </div>

      <div className="h-px bg-[#ddc8b0]" />

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
          Traveller details
        </p>
        <h3 className="text-2xl font-semibold tracking-tight text-stone-900">
          Tell us how to reach you
        </h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-stone-700">
            Full Name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="mt-1 w-full rounded-[1rem] border border-[#ddc8b0] bg-white px-4 py-3 focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
            placeholder="John & Sarah"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-stone-700">
            Email *
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-[1rem] border border-[#ddc8b0] bg-white px-4 py-3 focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
            placeholder="your@email.com"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-stone-700">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            className="mt-1 w-full rounded-[1rem] border border-[#ddc8b0] bg-white px-4 py-3 focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
            placeholder="+1 234 567 8900"
          />
        </div>
        <div>
          <label htmlFor="travelDate" className="block text-sm font-medium text-stone-700">
            Preferred travel date
          </label>
          <input
            id="travelDate"
            name="travelDate"
            type="date"
            className="mt-1 w-full rounded-[1rem] border border-[#ddc8b0] bg-white px-4 py-3 focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
          />
        </div>
      </div>
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-stone-700">
          Special requests
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="mt-1 w-full rounded-[1rem] border border-[#ddc8b0] bg-white px-4 py-3 focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
          placeholder="Dietary needs, accessibility..."
        />
      </div>

      {error && (
        <div className="rounded-[1rem] bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !canSubmit}
        className="w-full rounded-full bg-[#12343b] py-3.5 font-semibold text-[#f6ead6] shadow-[0_16px_40px_-26px_rgba(18,52,59,0.95)] transition hover:bg-[#0f2b31] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Submitting…" : "Submit booking request"}
      </button>
    </form>
  );
}
