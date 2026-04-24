"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
import type { TourPackage, PackageOption, HotelSupplier, HotelMealPlan } from "@/lib/types";
import { calcOptionPrice, getFlatMealPlanOptions } from "@/lib/package-price";
import { createClientBookingAction } from "@/app/actions/client-booking";
import { debugClient } from "@/lib/debug";
import { useBookingDraft } from "@/stores/booking-draft.store";

/** Sentinel meal-plan choice: "no meal plan selected — room only / arranged
 *  directly with the hotel". Rendered as a zero-cost option so guests can
 *  always opt out without being forced into a paid plan. */
const NO_MEAL_PLAN = "__no_meal_plan__";

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

export function ClientBookingForm({
  pkg,
  hotels = [],
  mealPlansByHotelId = {},
}: {
  pkg: TourPackage;
  hotels?: HotelSupplier[];
  /** Hospitality-style per-hotel meal plans (RO/BB/HB/FB/AI …) keyed by
   *  hotel (supplier) id. When a night's accommodation option resolves to
   *  a hotel that has plans configured, the form renders them inline with
   *  the room choice — there's no separate meal-plan step. */
  mealPlansByHotelId?: Record<string, HotelMealPlan[]>;
}) {
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

  // Per-night meal plan selections (hotel-attached plans). Keyed by night
  // index. Missing entry / NO_MEAL_PLAN sentinel → no meal plan charge
  // for that night (Room Only / guest arranges separately).
  const [mealPlanByNight, setMealPlanByNight] = useState<Record<number, string>>({});

  /**
   * For a given night, return the meal plans offered by the currently
   * selected accommodation option's hotel (if any). Drives the inline
   * picker rendered next to the accommodation choice.
   */
  const mealPlansForNight = (nightIndex: number): HotelMealPlan[] => {
    const accId = accommodationByNight[nightIndex];
    if (!accId) return [];
    const opt = perNightAccommodation
      .find((slot) => slot.nightIndex === nightIndex)
      ?.options.find((o) => o.id === accId);
    const hotelId = opt?.supplierId;
    if (!hotelId) return [];
    return mealPlansByHotelId[hotelId] ?? [];
  };

  /** Same for the legacy single-option accommodation branch. */
  const legacyMealPlans = useMemo((): HotelMealPlan[] => {
    if (!legacyAccommodation) return [];
    if (accommodationId === BOOK_MY_OWN || !accommodationId) return [];
    const opt = legacyAccommodationOptions.find((o) => o.id === accommodationId);
    const hotelId = opt?.supplierId;
    if (!hotelId) return [];
    return mealPlansByHotelId[hotelId] ?? [];
  }, [
    legacyAccommodation,
    accommodationId,
    legacyAccommodationOptions,
    mealPlansByHotelId,
  ]);

  /** True when any hotel attached to this package has configured meal
   *  plans. When true we show the inline picker and HIDE the legacy
   *  package-level meal-plan step — plans are charged with the room. */
  const hasHotelMealPlans = useMemo(() => {
    if (legacyAccommodation) return legacyMealPlans.length > 0;
    return perNightAccommodation.some((slot) =>
      slot.options.some(
        (opt) => opt.supplierId && (mealPlansByHotelId[opt.supplierId]?.length ?? 0) > 0
      )
    );
  }, [
    legacyAccommodation,
    legacyMealPlans.length,
    perNightAccommodation,
    mealPlansByHotelId,
  ]);

  const totalPrice = useMemo(() => {
    let total = pkg.price * pax;
    const opt = (opts: PackageOption[], id: string) => opts.find((o) => o.id === id);

    const tr = opt(transportOptions, transportId);
    if (tr) total += calcOptionPrice(tr, pax, nights);

    if (legacyAccommodation) {
      if (accommodationId !== BOOK_MY_OWN) {
        const acc = opt(legacyAccommodationOptions, accommodationId);
        if (acc) total += calcOptionPrice(acc, pax, nights);
        // Hotel-attached meal plan (charged per person per night).
        const mpId = mealPlanByNight[0];
        if (mpId && mpId !== NO_MEAL_PLAN) {
          const mp = legacyMealPlans.find((m) => m.id === mpId);
          if (mp) total += mp.pricePerPerson * pax * nights;
        }
      }
    } else {
      perNightAccommodation.forEach(({ nightIndex, options }) => {
        if (bookMyOwnNights[nightIndex]) return;
        const id = accommodationByNight[nightIndex];
        const acc = opt(options, id);
        if (acc) total += calcOptionPrice(acc, pax, 1);
        // Hotel-attached meal plan for this night. Inline the lookup (instead
        // of calling the mealPlansForNight helper) so React Compiler can
        // preserve the memo — a helper closure invoked here trips
        // preserve-manual-memoization.
        const mpId = mealPlanByNight[nightIndex];
        if (mpId && mpId !== NO_MEAL_PLAN && acc?.supplierId) {
          const hotelPlans = mealPlansByHotelId[acc.supplierId] ?? [];
          const mp = hotelPlans.find((m) => m.id === mpId);
          if (mp) total += mp.pricePerPerson * pax;
        }
      });
    }

    // Legacy package-level meal-plan charge ONLY if the package has no
    // hotel-attached meal plans. Once hotels carry their own plans the
    // standalone step disappears and the charge is already rolled in
    // above with the room.
    if (!hasHotelMealPlans) {
      const me = opt(mealOptions, mealId);
      if (me) total += calcOptionPrice(me, pax, nights);
    }

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
    mealPlanByNight,
    legacyAccommodation,
    legacyAccommodationOptions,
    legacyMealPlans,
    perNightAccommodation,
    transportOptions,
    mealOptions,
    hasHotelMealPlans,
    mealPlansByHotelId,
  ]);

  const hasAnyAccommodation = legacyAccommodation ? legacyAccommodationOptions.length > 0 : perNightAccommodation.length > 0;

  // Step progression logic — computed before any early return so React's
  // rules-of-hooks aren't violated when the "no accommodation configured"
  // branch short-circuits.
  const steps = useMemo(() => {
    const list: { n: Step; label: string; icon: React.ElementType }[] = [
      { n: 1, label: "Your details", icon: Users },
      { n: 2, label: "Stay & meals", icon: Building2 },
    ];
    // Standalone meal-plan step only when the package has no hotel-attached
    // plans. With hotel plans the choice is inline in Step 2 and there's
    // no separate charge.
    if (mealOptions.length > 0 && !hasHotelMealPlans) {
      list.push({ n: 3, label: "Meal plan", icon: UtensilsCrossed });
    }
    if (transportOptions.length > 0) list.push({ n: 4, label: "Transport", icon: Car });
    list.push({ n: 5, label: "Review", icon: Check });
    return list;
  }, [mealOptions.length, transportOptions.length, hasHotelMealPlans]);

  // ── Draft persistence ─────────────────────────────────────────────────
  // The Zustand `wizard` draft (localStorage-backed) lets a guest leave the
  // page and resume later without losing their selections. We use a
  // ref-guarded two-phase hydration so the first SSR paint matches the
  // first client paint (no hydration mismatch), then pull persisted values
  // on mount and write every subsequent change back to the store.
  //
  // `react-hooks/set-state-in-effect` is disabled for the hydration effect
  // because bridging an external persisted store into local React state on
  // mount is the canonical exception to that rule — the cascading render
  // it warns about is exactly the desired behavior here (one re-render to
  // apply the persisted draft, then steady-state).
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    // Reset the draft if the guest jumped to a different package, otherwise
    // keep whatever was persisted for this package.
    useBookingDraft.getState().loadWizardForPackage(pkg.id);
    const draft = useBookingDraft.getState().wizard;

    if (draft.packageId === pkg.id) {
      /* eslint-disable react-hooks/set-state-in-effect */
      if (draft.name) setName(draft.name);
      if (draft.email) setEmail(draft.email);
      if (draft.phone) setPhone(draft.phone);
      if (draft.travelDate) setTravelDate(draft.travelDate);
      if (draft.notes) setNotes(draft.notes);
      if (draft.pax && draft.pax >= 1) {
        setPax(draft.pax);
        const extras = Math.max(0, draft.pax - 1);
        setGuestNames(() => {
          const base =
            draft.guestNames && draft.guestNames.length > 0
              ? [...draft.guestNames]
              : [""];
          while (base.length < extras) base.push("");
          while (base.length > extras) base.pop();
          return base.length === 0 ? [""] : base;
        });
      }
      if (draft.transportId) setTransportId(draft.transportId);
      if (draft.mealId) setMealId(draft.mealId);
      if (draft.accommodationId) setAccommodationId(draft.accommodationId);
      if (
        draft.accommodationByNight &&
        Object.keys(draft.accommodationByNight).length > 0
      ) {
        setAccommodationByNight(draft.accommodationByNight);
      }
      if (
        draft.bookMyOwnNights &&
        Object.keys(draft.bookMyOwnNights).length > 0
      ) {
        setBookMyOwnNights(draft.bookMyOwnNights);
      }
      if (
        draft.mealPlanByNight &&
        Object.keys(draft.mealPlanByNight).length > 0
      ) {
        setMealPlanByNight(draft.mealPlanByNight);
      }
      if (draft.bookMyOwnNotes) setBookMyOwnNotes(draft.bookMyOwnNotes);
      if (draft.step && draft.step >= 1 && draft.step <= 5) {
        setStep(draft.step as Step);
      }
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    hasHydratedRef.current = true;
  }, [pkg.id]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    useBookingDraft.getState().patchWizard({
      step,
      name,
      email,
      phone,
      travelDate,
      notes,
      pax,
      guestNames,
      transportId,
      mealId,
      accommodationId,
      accommodationByNight,
      mealPlanByNight,
      bookMyOwnNights,
      bookMyOwnNotes,
      packageId: pkg.id,
    });
  }, [
    step,
    name,
    email,
    phone,
    travelDate,
    notes,
    pax,
    guestNames,
    transportId,
    mealId,
    accommodationId,
    accommodationByNight,
    mealPlanByNight,
    bookMyOwnNights,
    bookMyOwnNotes,
    pkg.id,
  ]);

  if (!hasAnyAccommodation) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-amber-800">
          This package does not have accommodation configured yet. Please contact us for a quote.
        </p>
      </div>
    );
  }

  const visibleStepNums = steps.map((s) => s.n);
  const currentIndex = visibleStepNums.indexOf(step);

  // Per-step validation
  const step1Valid = !!name.trim() && !!email.trim() && pax >= 1;
  const step2Valid = legacyAccommodation
    ? accommodationId === BOOK_MY_OWN || !!accommodationId
    : perNightAccommodation.every(
        ({ nightIndex }) => bookMyOwnNights[nightIndex] || !!accommodationByNight[nightIndex]
      );
  // Step 3 (standalone meal-plan step) is only in play for legacy packages
  // without hotel-attached plans. When hotel plans are used, meals are
  // handled inline in Step 2 and this check trivially passes.
  const step3Valid = hasHotelMealPlans || mealOptions.length === 0 || !!mealId;
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

    // Hotel-attached meal plans (room-priced). Drop the NO_MEAL_PLAN
    // sentinel entries so the server sees only real selections.
    if (hasHotelMealPlans) {
      const planPayload: Record<string, string> = {};
      for (const [k, v] of Object.entries(mealPlanByNight)) {
        if (v && v !== NO_MEAL_PLAN) planPayload[k] = v;
      }
      if (Object.keys(planPayload).length > 0) {
        formData.set("selectedMealPlanByNight", JSON.stringify(planPayload));
      }
    }

    debugClient("ClientBooking: submit", { packageId: pkg.id, pax, totalPrice });
    const result = await createClientBookingAction(pkg.id, formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    // Clear the persisted draft so the next booking starts clean.
    useBookingDraft.getState().resetWizard();
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
    <div className="has-sticky-bottom-bar pb-36 sm:pb-32">
      {/* Mobile progress indicator: compact "Step N of M" + current step label */}
      <div className="sm:hidden mb-4 rounded-2xl border border-[#e5d7c4] bg-[#fbf7f1] px-4 py-3">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-[#8c6a38]">
          <span>Step {currentIndex + 1} of {steps.length}</span>
          <span className="text-[#11272b]">
            {steps[currentIndex]?.label}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#f4ecdd]">
          <div
            className="h-full bg-[#12343b] transition-all"
            style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Desktop/tablet step indicator (horizontal, scrollable if tight) */}
      <ol className="hidden sm:flex mb-6 flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#8c6a38]">
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
              {hasHotelMealPlans ? "Choose your stay & meals" : "Choose accommodation"}
            </h2>
            <p className="mb-4 text-sm text-[#5e7279]">
              {hasHotelMealPlans
                ? "Pick a hotel per night, then the meal plan (Room Only / Bed & Breakfast / Half Board / Full Board / All Inclusive) straight from that hotel. Meals are charged with the stay — no separate step."
                : "Pick from our curated hotels below, or select "}
              {!hasHotelMealPlans && (
                <>
                  <b>Book my own</b> if you prefer to arrange your own stay.
                </>
              )}
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

                {/* Hotel-attached meal plans for the picked room. We reuse
                    the night-0 key so one picker drives the whole stay. */}
                {accommodationId !== BOOK_MY_OWN && legacyMealPlans.length > 0 && (
                  <div className="mt-3 rounded-[1.15rem] border border-[#e5d7c4] bg-[#fbf7f1] p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[#8c6a38]">
                      <UtensilsCrossed className="h-3.5 w-3.5" />
                      Meal plan (per person, per night)
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label
                        className={`flex cursor-pointer items-center justify-between gap-2 rounded-[0.95rem] border p-2.5 text-sm transition ${
                          (mealPlanByNight[0] ?? NO_MEAL_PLAN) === NO_MEAL_PLAN
                            ? "border-[#12343b] bg-white"
                            : "border-[#ddc8b0] bg-white hover:border-[#b78c54]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="legacy_meal_plan"
                          value={NO_MEAL_PLAN}
                          checked={(mealPlanByNight[0] ?? NO_MEAL_PLAN) === NO_MEAL_PLAN}
                          onChange={() =>
                            setMealPlanByNight((prev) => ({ ...prev, 0: NO_MEAL_PLAN }))
                          }
                          className="sr-only"
                        />
                        <span className="font-medium text-[#11272b]">Room only</span>
                        <span className="text-xs text-[#8c6a38]">No meals</span>
                      </label>
                      {legacyMealPlans.map((mp) => (
                        <label
                          key={mp.id}
                          className={`flex cursor-pointer items-center justify-between gap-2 rounded-[0.95rem] border p-2.5 text-sm transition ${
                            mealPlanByNight[0] === mp.id
                              ? "border-[#12343b] bg-[#f3e3c7]"
                              : "border-[#ddc8b0] bg-white hover:border-[#b78c54]"
                          }`}
                        >
                          <input
                            type="radio"
                            name="legacy_meal_plan"
                            value={mp.id}
                            checked={mealPlanByNight[0] === mp.id}
                            onChange={() =>
                              setMealPlanByNight((prev) => ({ ...prev, 0: mp.id }))
                            }
                            className="sr-only"
                          />
                          <span className="font-medium text-[#11272b]">{mp.label}</span>
                          <span className="text-xs font-medium text-[#12343b]">
                            {mp.pricePerPerson > 0
                              ? `+${(mp.pricePerPerson * pax * nights).toLocaleString()} ${mp.currency}`
                              : "Included"}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
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
                        <>
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
                          {/* Hotel-attached meal plans for the picked room —
                              same page, charged together with the stay. */}
                          {(() => {
                            const plans = mealPlansForNight(nightIndex);
                            if (plans.length === 0) return null;
                            const selected =
                              mealPlanByNight[nightIndex] ?? NO_MEAL_PLAN;
                            return (
                              <div className="mt-3 rounded-[1.15rem] border border-[#e5d7c4] bg-[#fbf7f1] p-3">
                                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[#8c6a38]">
                                  <UtensilsCrossed className="h-3.5 w-3.5" />
                                  Meal plan for this night
                                </p>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <label
                                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-[0.95rem] border p-2.5 text-sm transition ${
                                      selected === NO_MEAL_PLAN
                                        ? "border-[#12343b] bg-white"
                                        : "border-[#ddc8b0] bg-white hover:border-[#b78c54]"
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`meal_plan_night_${nightIndex}`}
                                      value={NO_MEAL_PLAN}
                                      checked={selected === NO_MEAL_PLAN}
                                      onChange={() =>
                                        setMealPlanByNight((prev) => ({
                                          ...prev,
                                          [nightIndex]: NO_MEAL_PLAN,
                                        }))
                                      }
                                      className="sr-only"
                                    />
                                    <span className="font-medium text-[#11272b]">
                                      Room only
                                    </span>
                                    <span className="text-xs text-[#8c6a38]">
                                      No meals
                                    </span>
                                  </label>
                                  {plans.map((mp) => (
                                    <label
                                      key={mp.id}
                                      className={`flex cursor-pointer items-center justify-between gap-2 rounded-[0.95rem] border p-2.5 text-sm transition ${
                                        selected === mp.id
                                          ? "border-[#12343b] bg-[#f3e3c7]"
                                          : "border-[#ddc8b0] bg-white hover:border-[#b78c54]"
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name={`meal_plan_night_${nightIndex}`}
                                        value={mp.id}
                                        checked={selected === mp.id}
                                        onChange={() =>
                                          setMealPlanByNight((prev) => ({
                                            ...prev,
                                            [nightIndex]: mp.id,
                                          }))
                                        }
                                        className="sr-only"
                                      />
                                      <span className="font-medium text-[#11272b]">
                                        {mp.label}
                                      </span>
                                      <span className="text-xs font-medium text-[#12343b]">
                                        {mp.pricePerPerson > 0
                                          ? `+${(mp.pricePerPerson * pax).toLocaleString()} ${mp.currency}`
                                          : "Included"}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </>
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

        {step === 3 && mealOptions.length > 0 && !hasHotelMealPlans && (
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
                {hasHotelMealPlans ? (
                  <ReviewRow
                    label="Meal plan"
                    value={(() => {
                      if (legacyAccommodation) {
                        if (accommodationId === BOOK_MY_OWN) return "—";
                        const id = mealPlanByNight[0];
                        if (!id || id === NO_MEAL_PLAN) return "Room Only";
                        return legacyMealPlans.find((m) => m.id === id)?.label ?? "Room Only";
                      }
                      const bits = perNightAccommodation.map(({ nightIndex }) => {
                        if (bookMyOwnNights[nightIndex]) return `N${nightIndex + 1}: own`;
                        const id = mealPlanByNight[nightIndex];
                        if (!id || id === NO_MEAL_PLAN) return `N${nightIndex + 1}: Room Only`;
                        const plans = mealPlansForNight(nightIndex);
                        const label = plans.find((m) => m.id === id)?.label ?? "Room Only";
                        return `N${nightIndex + 1}: ${label}`;
                      });
                      return bits.join(" · ");
                    })()}
                  />
                ) : (
                  mealOptions.length > 0 && (
                    <ReviewRow
                      label="Meal plan"
                      value={mealOptions.find((o) => o.id === mealId)?.label ?? "—"}
                    />
                  )
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

      {/* Persistent bottom price bar — mobile compacts into a two-row layout */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#d7c2a4] bg-[#fdf7eb]/95 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md shadow-[0_-10px_40px_-20px_rgba(43,32,15,0.35)] sm:px-4 sm:pb-4 sm:pt-4"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <div className="flex items-baseline justify-between gap-2 sm:flex-col sm:min-w-0 sm:items-start sm:gap-0.5">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[#8c6a38] sm:text-xs">
              Running total
            </span>
            <span className="text-lg font-semibold text-[#12343b] sm:truncate sm:text-xl">
              {totalPrice.toLocaleString()} {pkg.currency}
            </span>
            <span className="hidden text-xs text-[#5e7279] sm:inline">
              {pax} traveler{pax !== 1 ? "s" : ""} · {nights} nights
            </span>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2">
            <button
              type="button"
              onClick={goBack}
              disabled={currentIndex === 0}
              aria-label="Back"
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-[#ddc8b0] bg-white px-4 text-sm font-medium text-[#5e7279] transition hover:bg-[#fbf7f1] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hide-tiny">Back</span>
            </button>
            {step !== 5 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!canAdvance}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#12343b] px-5 text-sm font-semibold text-[#f6ead6] transition hover:bg-[#0f2b31] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submitBooking}
                disabled={loading || !canSubmit}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#c9922f] px-5 text-sm font-semibold text-white transition hover:bg-[#a87a22] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
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
