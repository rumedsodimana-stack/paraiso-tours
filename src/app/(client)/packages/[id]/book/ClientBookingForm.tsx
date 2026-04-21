"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed,
  Users,
  Calendar,
  MessageSquare,
} from "lucide-react";
import type { TourPackage, PackageOption, HotelSupplier } from "@/lib/types";
import { calcOptionPrice, getFlatMealPlanOptions } from "@/lib/package-price";
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

function getAllAccommodationNightOptions(pkg: TourPackage): { nightIndex: number; options: PackageOption[] }[] {
  const nights = parseNights(pkg.duration) || 1;
  const result: { nightIndex: number; options: PackageOption[] }[] = [];
  const packageLevel = pkg.accommodationOptions ?? [];
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
    if (opts.length > 0) result.push({ nightIndex: i, options: opts });
  }
  return result;
}

function hasLegacyAccommodation(pkg: TourPackage): boolean {
  const nights = parseNights(pkg.duration) || 1;
  if (nights > 1) return false;
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

const BOOK_MY_OWN = "__book_my_own__";

type Step = 1 | 2 | 3 | 4 | 5;

export function ClientBookingForm({ pkg, hotels = [] }: { pkg: TourPackage; hotels?: HotelSupplier[] }) {
  const getStarRating = (supplierId?: string) =>
    supplierId ? hotels.find((h) => h.id === supplierId)?.starRating : undefined;
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nights = parseNights(pkg.duration) || 7;

  const transportOptions = useMemo(() => pkg.transportOptions ?? [], [pkg.transportOptions]);
  const mealOptions = useMemo(() => getFlatMealPlanOptions(pkg), [pkg]);
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

  // Step state
  const [step, setStep] = useState<Step>(1);

  // Guest details
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [notes, setNotes] = useState("");
  const [pax, setPax] = useState(2);
  const [guestNames, setGuestNames] = useState<string[]>([""]);

  // Accommodation (with Book My Own support)
  const [transportId, setTransportId] = useState(() =>
    transportOptions.length ? getDefault(transportOptions) : ""
  );
  const [mealId, setMealId] = useState(() =>
    mealOptions.length ? getDefault(mealOptions) : ""
  );
  const [accommodationId, setAccommodationId] = useState(() =>
    legacyAccommodation && legacyAccommodationOptions.length
      ? getDefault(legacyAccommodationOptions)
      : ""
  );
  const [accommodationByNight, setAccommodationByNight] = useState<Record<number, string>>(
    defaultAccommodationByNight
  );
  const [bookMyOwnNights, setBookMyOwnNights] = useState<Record<number, boolean>>({});
  const [bookMyOwnNotes, setBookMyOwnNotes] = useState("");

  const totalPrice = useMemo(() => {
    let total = pkg.price * pax;
    const opt = (opts: PackageOption[], id: string) => opts.find((o) => o.id === id);

    const tr = opt(transportOptions, transportId);
    if (tr) total += calcOptionPrice(tr, pax, nights);

    if (legacyAccommodation) {
      if (accommodationId !== BOOK_MY_OWN) {
        const acc = opt(legacyAccommodationOptions, accommodationId);
        if (acc) total += calcOptionPrice(acc, pax, nights);
      }
    } else {
      perNightAccommodation.forEach(({ nightIndex, options }) => {
        if (bookMyOwnNights[nightIndex]) return;
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
    bookMyOwnNights,
    legacyAccommodation,
    legacyAccommodationOptions,
    perNightAccommodation,
    transportOptions,
    mealOptions,
  ]);

  const hasAnyAccommodation = legacyAccommodation ? legacyAccommodationOptions.length > 0 : perNightAccommodation.length > 0;

  if (!hasAnyAccommodation) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-amber-800">
          This package does not have accommodation configured yet. Please contact us for a quote.
        </p>
      </div>
    );
  }

  // Step progression logic
  const steps = useMemo(() => {
    const list: { n: Step; label: string; icon: React.ElementType }[] = [
      { n: 1, label: "Your details", icon: Users },
      { n: 2, label: "Accommodation", icon: Building2 },
    ];
    if (mealOptions.length > 0) list.push({ n: 3, label: "Meal plan", icon: UtensilsCrossed });
    if (transportOptions.length > 0) list.push({ n: 4, label: "Transport", icon: Car });
    list.push({ n: 5, label: "Review", icon: Check });
    return list;
  }, [mealOptions.length, transportOptions.length]);

  const visibleStepNums = steps.map((s) => s.n);
  const currentIndex = visibleStepNums.indexOf(step);

  // Per-step validation
  const step1Valid = !!name.trim() && !!email.trim() && pax >= 1;
  const step2Valid = legacyAccommodation
    ? accommodationId === BOOK_MY_OWN || !!accommodationId
    : perNightAccommodation.every(
        ({ nightIndex }) => bookMyOwnNights[nightIndex] || !!accommodationByNight[nightIndex]
      );
  const step3Valid = mealOptions.length === 0 || !!mealId;
  const step4Valid = transportOptions.length === 0 || !!transportId;

  const canAdvance = (() => {
    switch (step) {
      case 1: return step1Valid;
      case 2: return step2Valid;
      case 3: return step3Valid;
      case 4: return step4Valid;
      default: return true;
    }
  })();

  const canSubmit = step1Valid && step2Valid && step3Valid && step4Valid;

  function goBack() {
    const idx = visibleStepNums.indexOf(step);
    if (idx > 0) setStep(visibleStepNums[idx - 1]);
  }

  function goNext() {
    if (!canAdvance) return;
    const idx = visibleStepNums.indexOf(step);
    if (idx < visibleStepNums.length - 1) setStep(visibleStepNums[idx + 1]);
  }

  async function submitBooking() {
    if (!canSubmit) return;
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.set("packageId", pkg.id);
    formData.set("name", name);
    formData.set("email", email);
    formData.set("phone", phone);
    formData.set("travelDate", travelDate);
    formData.set("pax", String(pax));
    formData.set("selectedTransportOptionId", transportId);
    formData.set("selectedMealOptionId", mealId);
    formData.set("totalPrice", String(totalPrice));

    const filledGuestNames = guestNames.map((g) => g.trim()).filter(Boolean);
    const notesBits = [notes.trim()];
    if (filledGuestNames.length > 0) {
      notesBits.push(`Additional travelers: ${filledGuestNames.join(", ")}`);
    }
    if (bookMyOwnNotes.trim()) {
      notesBits.push(`Guest-arranged accommodation: ${bookMyOwnNotes.trim()}`);
    }
    const bookMyOwnNightList = Object.entries(bookMyOwnNights)
      .filter(([, v]) => v)
      .map(([k]) => `Night ${Number(k) + 1}`);
    if (bookMyOwnNightList.length > 0) {
      notesBits.push(`Guest will arrange accommodation for: ${bookMyOwnNightList.join(", ")}`);
    }
    if (accommodationId === BOOK_MY_OWN) {
      notesBits.push(`Guest arranges all accommodation`);
    }
    formData.set("notes", notesBits.filter(Boolean).join(" | "));

    if (legacyAccommodation) {
      if (accommodationId !== BOOK_MY_OWN) {
        formData.set("selectedAccommodationOptionId", accommodationId);
      }
    } else {
      const selected: Record<number, string> = {};
      for (const { nightIndex } of perNightAccommodation) {
        if (!bookMyOwnNights[nightIndex]) {
          selected[nightIndex] = accommodationByNight[nightIndex];
        }
      }
      if (Object.keys(selected).length > 0) {
        formData.set("selectedAccommodationByNight", JSON.stringify(selected));
      }
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

  // Sync guestNames length with pax — pax-1 additional travelers max
  function syncGuestNames(newPax: number) {
    setPax(newPax);
    const extras = Math.max(0, newPax - 1);
    setGuestNames((prev) => {
      const copy = [...prev];
      while (copy.length < extras) copy.push("");
      while (copy.length > extras) copy.pop();
      return copy.length === 0 ? [""] : copy;
    });
  }

  return (
    <div className="pb-32">
      {/* Step indicator */}
      <ol className="mb-6 flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#8c6a38]">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const active = s.n === step;
          const done = currentIndex > i;
          return (
            <li key={s.n} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  // Only allow jumping backward or to already-valid steps
                  if (i <= currentIndex) setStep(s.n);
                }}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition ${
                  active
                    ? "bg-[#12343b] text-[#f6ead6]"
                    : done
                      ? "bg-[#dce8dc] text-[#375a3f]"
                      : "bg-[#f4ecdd] text-[#8c6a38]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
              {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-[#b78c54]" />}
            </li>
          );
        })}
      </ol>

      {/* Step content */}
      <div className="space-y-6">
        {step === 1 && (
          <section className="rounded-[1.75rem] border border-[#e5d7c4] bg-[#fbf7f1] p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#11272b]">
              <Users className="h-5 w-5 text-[#12343b]" />
              Your details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-[#11272b]">Primary guest name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-[1rem] border border-[#ddc8b0] bg-white px-4 py-3 focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#11272b]">Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-[1rem] border border-[#ddc8b0] bg-white px-4 py-3 focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#11272b]">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-[1rem] border border-[#ddc8b0] bg-white px-4 py-3 focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
                  placeholder="+1 234 567 8900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#11272b]">
                  <Calendar className="inline h-3.5 w-3.5 mr-1" />
                  Preferred travel date
                </label>
                <input
                  type="date"
                  value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)}
                  className="mt-1 w-full rounded-[1rem] border border-[#ddc8b0] bg-white px-4 py-3 focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#11272b]">Number of travelers *</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={pax}
                  onChange={(e) => syncGuestNames(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="mt-1 w-28 rounded-[1rem] border border-[#ddc8b0] bg-white px-4 py-3 focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
                />
              </div>
            </div>

            {pax > 1 && (
              <div className="mt-5 space-y-2">
                <p className="text-sm font-medium text-[#11272b]">
                  Additional traveler names{" "}
                  <span className="font-normal text-[#8c6a38]">(optional)</span>
                </p>
                <p className="text-xs text-[#5e7279]">
                  Leave blank if you prefer to confirm names later.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {guestNames.map((gn, i) => (
                    <input
                      key={i}
                      type="text"
                      value={gn}
                      onChange={(e) => {
                        const next = [...guestNames];
                        next[i] = e.target.value;
                        setGuestNames(next);
                      }}
                      placeholder={`Traveler ${i + 2} name`}
                      className="w-full rounded-[1rem] border border-[#ddc8b0] bg-white px-4 py-3 text-sm focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5">
              <label className="block text-sm font-medium text-[#11272b]">
                <MessageSquare className="inline h-3.5 w-3.5 mr-1" />
                Special requests
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-[1rem] border border-[#ddc8b0] bg-white px-4 py-3 text-sm focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
                placeholder="Dietary needs, accessibility, celebrations…"
              />
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="rounded-[1.75rem] border border-[#e5d7c4] bg-[#fbf7f1] p-5 sm:p-6">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-[#11272b]">
              <Building2 className="h-5 w-5 text-[#12343b]" />
              Choose accommodation
            </h2>
            <p className="mb-4 text-sm text-[#5e7279]">
              Pick from our curated hotels below, or select <b>Book my own</b> if you prefer to arrange your own stay.
            </p>

            {legacyAccommodation ? (
              <div className="space-y-2">
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
                        checked={accommodationId === opt.id}
                        onChange={() => setAccommodationId(opt.id)}
                        className="sr-only"
                      />
                      <div className="flex flex-col">
                        <span className="font-medium text-[#11272b]">{opt.label}</span>
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
                <label
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-[1.25rem] border p-4 transition ${
                    accommodationId === BOOK_MY_OWN
                      ? "border-[#c9922f] bg-[#fffbf4]"
                      : "border-dashed border-[#ddc8b0] bg-white hover:border-[#c9922f]"
                  }`}
                >
                  <input
                    type="radio"
                    checked={accommodationId === BOOK_MY_OWN}
                    onChange={() => setAccommodationId(BOOK_MY_OWN)}
                    className="sr-only"
                  />
                  <span className="font-medium text-[#11272b]">
                    Book my own accommodation
                  </span>
                  <span className="text-xs text-[#8c6a38]">Subtracted from total</span>
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                {perNightAccommodation.map(({ nightIndex, options }) => {
                  const nightBookOwn = !!bookMyOwnNights[nightIndex];
                  return (
                    <div
                      key={nightIndex}
                      className="rounded-[1.35rem] border border-[#ddc8b0] bg-white p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-medium uppercase tracking-[0.14em] text-[#8c6a38]">
                          Night {nightIndex + 1}
                        </p>
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#5e7279]">
                          <input
                            type="checkbox"
                            checked={nightBookOwn}
                            onChange={(e) =>
                              setBookMyOwnNights((prev) => ({
                                ...prev,
                                [nightIndex]: e.target.checked,
                              }))
                            }
                            className="h-3.5 w-3.5 rounded border-[#ddc8b0] text-[#12343b] focus:ring-[#c9922f]"
                          />
                          I&apos;ll book my own
                        </label>
                      </div>
                      {!nightBookOwn ? (
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
                                <span className="font-medium text-[#11272b]">{opt.label}</span>
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
                      ) : (
                        <p className="rounded-xl bg-[#fffbf4] px-3 py-2 text-sm text-[#5e7279]">
                          You&apos;ll arrange this night yourself. Let us know the hotel in the notes so we can plan transfers.
                        </p>
                      )}
                    </div>
                  );
                })}
                {Object.values(bookMyOwnNights).some(Boolean) && (
                  <div>
                    <label className="block text-sm font-medium text-[#11272b]">
                      Tell us which hotel(s) you&apos;re arranging (optional)
                    </label>
                    <input
                      type="text"
                      value={bookMyOwnNotes}
                      onChange={(e) => setBookMyOwnNotes(e.target.value)}
                      placeholder="e.g. Cinnamon Grand Colombo (Night 1), Own villa (Nights 2-3)"
                      className="mt-1 w-full rounded-[1rem] border border-[#ddc8b0] bg-white px-4 py-3 text-sm focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
                    />
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {step === 3 && mealOptions.length > 0 && (
          <section className="rounded-[1.75rem] border border-[#e5d7c4] bg-[#fbf7f1] p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#11272b]">
              <UtensilsCrossed className="h-5 w-5 text-[#12343b]" />
              Choose meal plan
            </h2>
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
                  <span className="font-medium text-[#11272b]">{opt.label}</span>
                  <span className="text-sm font-medium text-[#12343b]">
                    +{calcOptionPrice(opt, pax, nights).toLocaleString()} {pkg.currency}
                  </span>
                </label>
              ))}
            </div>
          </section>
        )}

        {step === 4 && transportOptions.length > 0 && (
          <section className="rounded-[1.75rem] border border-[#e5d7c4] bg-[#fbf7f1] p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#11272b]">
              <Car className="h-5 w-5 text-[#12343b]" />
              Choose transportation
            </h2>
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
                  <span className="font-medium text-[#11272b]">{opt.label}</span>
                  <span className="text-sm font-medium text-[#12343b]">
                    +{calcOptionPrice(opt, pax, nights).toLocaleString()} {pkg.currency}
                  </span>
                </label>
              ))}
            </div>
          </section>
        )}

        {step === 5 && (
          <section className="space-y-4">
            <div className="rounded-[1.75rem] border border-[#e5d7c4] bg-[#fbf7f1] p-5 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#11272b]">
                <Check className="h-5 w-5 text-[#12343b]" />
                Review &amp; confirm
              </h2>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <ReviewRow label="Package" value={pkg.name} />
                <ReviewRow label="Duration" value={pkg.duration} />
                <ReviewRow label="Primary guest" value={name || "—"} />
                <ReviewRow label="Email" value={email || "—"} />
                {phone && <ReviewRow label="Phone" value={phone} />}
                <ReviewRow label="Travelers" value={`${pax}`} />
                {travelDate && <ReviewRow label="Travel date" value={travelDate} />}
                {guestNames.filter((g) => g.trim()).length > 0 && (
                  <ReviewRow
                    label="Additional travelers"
                    value={guestNames.filter((g) => g.trim()).join(", ")}
                  />
                )}
                <ReviewRow
                  label="Accommodation"
                  value={(() => {
                    if (legacyAccommodation) {
                      if (accommodationId === BOOK_MY_OWN) return "Guest-arranged";
                      return legacyAccommodationOptions.find((o) => o.id === accommodationId)?.label ?? "—";
                    }
                    const labels = perNightAccommodation.map(({ nightIndex, options }) => {
                      if (bookMyOwnNights[nightIndex]) return `N${nightIndex + 1}: own`;
                      const id = accommodationByNight[nightIndex];
                      return `N${nightIndex + 1}: ${options.find((o) => o.id === id)?.label ?? "—"}`;
                    });
                    return labels.join(" · ");
                  })()}
                />
                {mealOptions.length > 0 && (
                  <ReviewRow
                    label="Meal plan"
                    value={mealOptions.find((o) => o.id === mealId)?.label ?? "—"}
                  />
                )}
                {transportOptions.length > 0 && (
                  <ReviewRow
                    label="Transport"
                    value={transportOptions.find((o) => o.id === transportId)?.label ?? "—"}
                  />
                )}
                {notes.trim() && <ReviewRow label="Notes" value={notes.trim()} />}
              </dl>
            </div>
            {error && (
              <div className="rounded-[1rem] bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Persistent bottom price bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#d7c2a4] bg-[#fdf7eb]/95 px-4 py-4 backdrop-blur-md shadow-[0_-10px_40px_-20px_rgba(43,32,15,0.35)]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-xs uppercase tracking-[0.18em] text-[#8c6a38]">
              Running total
            </span>
            <span className="truncate text-xl font-semibold text-[#12343b]">
              {totalPrice.toLocaleString()} {pkg.currency}
            </span>
            <span className="text-xs text-[#5e7279]">
              {pax} traveler{pax !== 1 ? "s" : ""} · {nights} nights
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={goBack}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#ddc8b0] bg-white px-4 py-2.5 text-sm font-medium text-[#5e7279] transition hover:bg-[#fbf7f1] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            {step !== 5 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!canAdvance}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#12343b] px-5 py-2.5 text-sm font-semibold text-[#f6ead6] transition hover:bg-[#0f2b31] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submitBooking}
                disabled={loading || !canSubmit}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#c9922f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#a87a22] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Submitting…" : "Submit booking"}
                <Check className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-[#8c6a38]">{label}</dt>
      <dd className="font-medium text-[#11272b]">{value}</dd>
    </>
  );
}
