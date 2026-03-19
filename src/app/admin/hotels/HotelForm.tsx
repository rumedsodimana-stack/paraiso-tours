"use client";

import { useState } from "react";
import type { HotelSupplier } from "@/lib/types";
import { SaveSuccessBanner } from "../SaveSuccessBanner";

export function HotelForm({
  hotel,
  action,
  defaultType = "hotel",
}: {
  hotel?: HotelSupplier;
  action: (formData: FormData) => Promise<{ error?: string; success?: boolean; id?: string }>;
  defaultType?: "hotel" | "transport" | "meal" | "supplier";
}) {
  const [error, setError] = useState<string>("");
  const [saved, setSaved] = useState(false);
  const [type, setType] = useState<HotelSupplier["type"]>(
    hotel?.type ?? defaultType
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const formData = new FormData(e.currentTarget);
    const result = await action(formData);
    if (result?.error) {
      setError(result.error);
      return;
    }
    if (result?.success && result?.id && !hotel) {
      window.location.href = `/admin/hotels/${result.id}?saved=1`;
      return;
    }
    if (hotel && result && !result.error) {
      setSaved(true);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      {saved && <SaveSuccessBanner message="Saved successfully" />}
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
            value={type}
            onChange={(e) => setType(e.target.value as HotelSupplier["type"])}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
          >
            <option value="hotel">Hotel</option>
            <option value="transport">Transport</option>
            <option value="meal">Meal Provider</option>
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
          <label htmlFor="email" className="block text-sm font-medium text-stone-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={hotel?.email}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            placeholder="reservations@hotel.com"
          />
        </div>
        <div>
          <label htmlFor="contact" className="block text-sm font-medium text-stone-700">
            Phone / Contact
          </label>
          <input
            id="contact"
            name="contact"
            type="text"
            defaultValue={hotel?.contact}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            placeholder="+94 11 234 5678"
          />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="defaultPricePerNight" className="block text-sm font-medium text-stone-700">
            {type === "meal"
              ? "Default price per person / day"
              : type === "transport"
                ? "Default vehicle rate / day"
                : "Default rate"}
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
        {type === "hotel" && (
          <div>
            <label htmlFor="starRating" className="block text-sm font-medium text-stone-700">
              Star rating (1–5)
            </label>
            <select
              id="starRating"
              name="starRating"
              defaultValue={hotel?.starRating ?? ""}
              className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            >
              <option value="">— Select —</option>
              <option value="5">5 Star</option>
              <option value="4">4 Star</option>
              <option value="3">3 Star</option>
              <option value="2">2 Star</option>
              <option value="1">1 Star</option>
            </select>
          </div>
        )}
        <div>
          <label htmlFor="maxConcurrentBookings" className="block text-sm font-medium text-stone-700">
            {type === "hotel"
              ? "Max concurrent bookings"
              : type === "transport"
                ? "Vehicles available at once"
                : "Capacity cap"}
          </label>
          <input
            id="maxConcurrentBookings"
            name="maxConcurrentBookings"
            type="number"
            min={1}
            step={1}
            defaultValue={hotel?.maxConcurrentBookings}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            placeholder="Leave empty for unlimited"
          />
          <p className="mt-1 text-xs text-stone-500">
            Used by scheduling to flag overlapping tours that exceed this supplier&apos;s capacity.
          </p>
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

      <div className="rounded-xl border border-stone-200/60 bg-white/40 p-4">
        <h3 className="mb-3 text-sm font-medium text-stone-700">Banking Details</h3>
        <p className="mb-4 text-xs text-stone-500">For bank transfers and payables reporting</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="bankName" className="block text-sm font-medium text-stone-700">
              Bank name
            </label>
            <input
              id="bankName"
              name="bankName"
              type="text"
              defaultValue={hotel?.bankName}
              className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
              placeholder="Commercial Bank of Ceylon"
            />
          </div>
          <div>
            <label htmlFor="bankBranch" className="block text-sm font-medium text-stone-700">
              Branch
            </label>
            <input
              id="bankBranch"
              name="bankBranch"
              type="text"
              defaultValue={hotel?.bankBranch}
              className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
              placeholder="Colombo Main"
            />
          </div>
          <div>
            <label htmlFor="accountName" className="block text-sm font-medium text-stone-700">
              Account name
            </label>
            <input
              id="accountName"
              name="accountName"
              type="text"
              defaultValue={hotel?.accountName}
              className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
              placeholder="Jetwing Hotels (Pvt) Ltd"
            />
          </div>
          <div>
            <label htmlFor="accountNumber" className="block text-sm font-medium text-stone-700">
              Account number
            </label>
            <input
              id="accountNumber"
              name="accountNumber"
              type="text"
              defaultValue={hotel?.accountNumber}
              className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
              placeholder="1234567890"
            />
          </div>
          <div>
            <label htmlFor="swiftCode" className="block text-sm font-medium text-stone-700">
              SWIFT / BIC
            </label>
            <input
              id="swiftCode"
              name="swiftCode"
              type="text"
              defaultValue={hotel?.swiftCode}
              className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
              placeholder="CCEYLKLX"
            />
          </div>
          <div>
            <label htmlFor="bankCurrency" className="block text-sm font-medium text-stone-700">
              Bank currency
            </label>
            <select
              id="bankCurrency"
              name="bankCurrency"
              defaultValue={hotel?.bankCurrency ?? ""}
              className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            >
              <option value="">— Select —</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="LKR">LKR</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="paymentReference" className="block text-sm font-medium text-stone-700">
              Payment reference (for transfers)
            </label>
            <input
              id="paymentReference"
              name="paymentReference"
              type="text"
              defaultValue={hotel?.paymentReference}
              className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
              placeholder="Invoice #123, Booking ref"
            />
          </div>
        </div>
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
