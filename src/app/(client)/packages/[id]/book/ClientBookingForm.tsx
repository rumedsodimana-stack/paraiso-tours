"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Car, UtensilsCrossed, DollarSign } from "lucide-react";
import type { TourPackage, PackageOption } from "@/lib/types";
import { calcOptionPrice } from "@/lib/package-price";
import { createClientBookingAction } from "@/app/actions/client-booking";
import { debugClient } from "@/lib/debug";

function parseNights(duration: string): number {
  const m = duration.match(/(\d+)\s*[Nn]ight/);
  return m ? parseInt(m[1], 10) : 0;
}

export function ClientBookingForm({ pkg }: { pkg: TourPackage }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const accommodationOptions = pkg.accommodationOptions ?? [];
  const transportOptions = pkg.transportOptions ?? [];
  const mealOptions = pkg.mealOptions ?? [];
  const getDefault = (opts: PackageOption[]) =>
    opts.find((o) => o.isDefault)?.id ?? opts[0]?.id ?? "";
  const [accommodationId, setAccommodationId] = useState("");
  const [transportId, setTransportId] = useState("");
  const [mealId, setMealId] = useState("");
  const [pax, setPax] = useState(2);
  const nights = parseNights(pkg.duration) || 7;

  useEffect(() => {
    if (accommodationOptions.length) setAccommodationId(getDefault(accommodationOptions));
    if (transportOptions.length) setTransportId(getDefault(transportOptions));
    if (mealOptions.length) setMealId(getDefault(mealOptions));
  }, [pkg.id]);

  const totalPrice = useMemo(() => {
    let total = pkg.price * pax;
    const opt = (opts: PackageOption[], id: string) => opts.find((o) => o.id === id);
    const acc = opt(accommodationOptions, accommodationId);
    const tr = opt(transportOptions, transportId);
    const me = opt(mealOptions, mealId);
    if (acc) total += calcOptionPrice(acc, pax, nights);
    if (tr) total += calcOptionPrice(tr, pax, nights);
    if (me) total += calcOptionPrice(me, pax, nights);
    return total;
  }, [
    pkg.price,
    pax,
    nights,
    accommodationId,
    transportId,
    mealId,
    accommodationOptions,
    transportOptions,
    mealOptions,
  ]);

  const canSubmit =
    accommodationOptions.length > 0 &&
    transportOptions.length > 0 &&
    mealOptions.length > 0 &&
    accommodationId &&
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
    formData.set("selectedAccommodationOptionId", accommodationId);
    formData.set("selectedTransportOptionId", transportId);
    formData.set("selectedMealOptionId", mealId);
    formData.set("totalPrice", String(totalPrice));

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

  if (
    accommodationOptions.length === 0 ||
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-lg font-semibold text-stone-900">Choose your options</h2>

      <div className="sticky top-4 z-10 rounded-xl border-2 border-teal-200 bg-teal-50/90 p-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-stone-600">Total price</span>
          <span className="text-2xl font-bold text-teal-700">
            {totalPrice.toLocaleString()} {pkg.currency}
          </span>
        </div>
        <p className="mt-1 text-xs text-stone-500">
          For {pax} traveller{pax !== 1 ? "s" : ""} × {nights} nights
        </p>
      </div>

      <div className="space-y-6">
        <section>
          <h3 className="mb-3 flex items-center gap-2 font-medium text-stone-800">
            <Building2 className="h-5 w-5 text-teal-600" />
            1. Select accommodation
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {accommodationOptions.map((opt) => (
              <label
                key={opt.id}
                className={`flex cursor-pointer items-center justify-between rounded-xl border-2 p-4 transition ${
                  accommodationId === opt.id
                    ? "border-teal-500 bg-teal-50"
                    : "border-stone-200 bg-white hover:border-teal-300"
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
                <span className="font-medium">{opt.label}</span>
                <span className="text-sm text-teal-600">
                  +{calcOptionPrice(opt, pax, nights).toLocaleString()} {pkg.currency}
                </span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 font-medium text-stone-800">
            <Car className="h-5 w-5 text-teal-600" />
            2. Select transportation
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {transportOptions.map((opt) => (
              <label
                key={opt.id}
                className={`flex cursor-pointer items-center justify-between rounded-xl border-2 p-4 transition ${
                  transportId === opt.id
                    ? "border-teal-500 bg-teal-50"
                    : "border-stone-200 bg-white hover:border-teal-300"
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
                <span className="font-medium">{opt.label}</span>
                <span className="text-sm text-teal-600">
                  +{calcOptionPrice(opt, pax, nights).toLocaleString()} {pkg.currency}
                </span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 font-medium text-stone-800">
            <UtensilsCrossed className="h-5 w-5 text-teal-600" />
            3. Select meal plan
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {mealOptions.map((opt) => (
              <label
                key={opt.id}
                className={`flex cursor-pointer items-center justify-between rounded-xl border-2 p-4 transition ${
                  mealId === opt.id
                    ? "border-teal-500 bg-teal-50"
                    : "border-stone-200 bg-white hover:border-teal-300"
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
                <span className="font-medium">{opt.label}</span>
                <span className="text-sm text-teal-600">
                  +{calcOptionPrice(opt, pax, nights).toLocaleString()} {pkg.currency}
                </span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <label className="block font-medium text-stone-800">Number of travellers</label>
          <input
            type="number"
            min={1}
            value={pax}
            onChange={(e) => setPax(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="mt-1 w-24 rounded-xl border border-stone-200 bg-white px-4 py-2.5 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </section>
      </div>

      <hr className="border-stone-200" />

      <h3 className="font-medium text-stone-800">Your details</h3>
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
            className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
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
            className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
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
            className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
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
            className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
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
          className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          placeholder="Dietary needs, accessibility..."
        />
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <button
        type="submit"
        disabled={loading || !canSubmit}
        className="w-full rounded-xl bg-teal-600 py-3 font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Submitting…" : "Submit booking request"}
      </button>
    </form>
  );
}
