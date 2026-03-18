"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TourPackage } from "@/lib/types";
import { createClientBookingAction } from "@/app/actions/client-booking";

export function ClientBookingForm({ pkg }: { pkg: TourPackage }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("packageId", pkg.id);

    const result = await createClientBookingAction(pkg.id, formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push(
      result.reference
        ? `/client/booking-confirmed?ref=${encodeURIComponent(result.reference)}`
        : "/client/booking-confirmed"
    );
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-lg font-semibold text-stone-900">
        Request this tour
      </h2>
      <p className="text-sm text-stone-600">
        Fill in your details and we&apos;ll get back to you within 24 hours
        with a personalised quote.
      </p>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-stone-700"
          >
            Full Name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="mt-1 w-full rounded-xl border border-stone-200 bg-white py-2.5 px-4 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            placeholder="John & Sarah"
          />
        </div>
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-stone-700"
          >
            Email *
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-xl border border-stone-200 bg-white py-2.5 px-4 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            placeholder="your@email.com"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="phone"
          className="block text-sm font-medium text-stone-700"
        >
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          className="mt-1 w-full rounded-xl border border-stone-200 bg-white py-2.5 px-4 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          placeholder="+1 234 567 8900"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="travelDate"
            className="block text-sm font-medium text-stone-700"
          >
            Preferred travel date
          </label>
          <input
            id="travelDate"
            name="travelDate"
            type="date"
            className="mt-1 w-full rounded-xl border border-stone-200 bg-white py-2.5 px-4 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
        <div>
          <label
            htmlFor="pax"
            className="block text-sm font-medium text-stone-700"
          >
            Number of travelers
          </label>
          <input
            id="pax"
            name="pax"
            type="number"
            min={1}
            defaultValue={2}
            className="mt-1 w-full rounded-xl border border-stone-200 bg-white py-2.5 px-4 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-stone-700"
        >
          Special requests or questions
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="mt-1 w-full rounded-xl border border-stone-200 bg-white py-2.5 px-4 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          placeholder="e.g. Vegetarian meals, accessibility needs, specific interests..."
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-teal-600 py-3 font-medium text-white transition hover:bg-teal-700 disabled:opacity-70"
      >
        {loading ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}
