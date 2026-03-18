"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HotelSupplier } from "@/lib/types";

export function HotelForm({
  hotel,
  action,
  defaultType = "hotel",
}: {
  hotel?: HotelSupplier;
  action: (formData: FormData) => Promise<{ error?: string; success?: boolean; id?: string }>;
  defaultType?: "hotel" | "transport";
}) {
  const [error, setError] = useState<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    const result = await action(formData);
    if (result?.error) {
      setError(result.error);
      return;
    }
    if (result?.success && result?.id && !hotel) {
      window.location.href = `/admin/hotels/${result.id}`;
      return;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-stone-700">
            Name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={hotel?.name}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            placeholder="Jetwing Lagoon"
          />
        </div>
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-stone-700">
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={hotel?.type ?? defaultType}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
          >
            <option value="hotel">Hotel</option>
            <option value="transport">Transport</option>
            <option value="supplier">Supplier</option>
          </select>
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-stone-700">
            Location
          </label>
          <input
            id="location"
            name="location"
            type="text"
            defaultValue={hotel?.location}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            placeholder="Negombo"
          />
        </div>
        <div>
          <label htmlFor="contact" className="block text-sm font-medium text-stone-700">
            Contact
          </label>
          <input
            id="contact"
            name="contact"
            type="text"
            defaultValue={hotel?.contact}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            placeholder="Email or phone"
          />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="defaultPricePerNight" className="block text-sm font-medium text-stone-700">
            Default price per night
          </label>
          <input
            id="defaultPricePerNight"
            name="defaultPricePerNight"
            type="number"
            min={0}
            step={0.01}
            defaultValue={hotel?.defaultPricePerNight}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            placeholder="120"
          />
        </div>
        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-stone-700">
            Currency
          </label>
          <select
            id="currency"
            name="currency"
            defaultValue={hotel?.currency ?? "USD"}
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
        <label htmlFor="notes" className="block text-sm font-medium text-stone-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={hotel?.notes}
          className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
          placeholder="Contract details, special rates..."
        />
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          {hotel ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}
