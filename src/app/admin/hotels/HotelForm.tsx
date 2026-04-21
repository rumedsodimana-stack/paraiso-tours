"use client";

import { useState } from "react";
import type { HotelSupplier } from "@/lib/types";
import { SaveSuccessBanner } from "../SaveSuccessBanner";

const DESTINATIONS = [
  { id: "negombo", name: "Negombo" },
  { id: "colombo", name: "Colombo" },
  { id: "kalpitiya", name: "Kalpitiya" },
  { id: "anuradhapura", name: "Anuradhapura" },
  { id: "dambulla", name: "Dambulla" },
  { id: "sigiriya", name: "Sigiriya" },
  { id: "kandy", name: "Kandy" },
  { id: "nuwara-eliya", name: "Nuwara Eliya" },
  { id: "ella", name: "Ella" },
  { id: "trincomalee", name: "Trincomalee" },
  { id: "yala", name: "Yala" },
  { id: "galle", name: "Galle" },
  { id: "bentota", name: "Bentota" },
  { id: "mirissa", name: "Mirissa" },
  { id: "tangalle", name: "Tangalle" },
  { id: "pasikuda", name: "Pasikuda" },
  { id: "arugam-bay", name: "Arugam Bay" },
  { id: "jaffna", name: "Jaffna" },
];

const inputCls =
  "mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-sm text-[#11272b] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20";

const labelCls = "block text-sm font-medium text-[#11272b]";
const helperCls = "mt-1 text-xs text-[#5e7279]";

export function HotelForm({
  hotel,
  action,
  defaultType = "hotel",
  defaultDestinationId,
}: {
  hotel?: HotelSupplier;
  action: (formData: FormData) => Promise<{ error?: string; success?: boolean; id?: string }>;
  defaultType?: "hotel" | "transport" | "meal" | "supplier";
  defaultDestinationId?: string;
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

      {/* Name + Type */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelCls}>
            Name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={hotel?.name}
            className={inputCls}
            placeholder="Jetwing Lagoon"
          />
        </div>
        <div>
          <label htmlFor="type" className={labelCls}>
            Type
          </label>
          <select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as HotelSupplier["type"])}
            className={inputCls}
          >
            <option value="hotel">Hotel</option>
            <option value="transport">Transport</option>
            <option value="supplier">Supplier</option>
            {hotel?.type === "meal" && (
              <option value="meal">Meal Provider (legacy)</option>
            )}
          </select>
        </div>
      </div>

      {/* Location + Destination + Email + Contact */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="location" className={labelCls}>
            Location
          </label>
          <input
            id="location"
            name="location"
            type="text"
            defaultValue={hotel?.location}
            className={inputCls}
            placeholder="Negombo"
          />
        </div>
        {type === "hotel" && (
          <div>
            <label htmlFor="destinationId" className={labelCls}>
              Destination
            </label>
            <select
              id="destinationId"
              name="destinationId"
              defaultValue={hotel?.destinationId ?? defaultDestinationId ?? ""}
              className={inputCls}
            >
              <option value="">— No destination assigned —</option>
              {DESTINATIONS.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <p className={helperCls}>
              Links this hotel to a destination for catalog filtering.
            </p>
          </div>
        )}
        <div>
          <label htmlFor="email" className={labelCls}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={hotel?.email}
            className={inputCls}
            placeholder="reservations@hotel.com"
          />
        </div>
        <div>
          <label htmlFor="contact" className={labelCls}>
            Phone / Contact
          </label>
          <input
            id="contact"
            name="contact"
            type="text"
            defaultValue={hotel?.contact}
            className={inputCls}
            placeholder="+94 11 234 5678"
          />
        </div>
      </div>

      {/* Pricing + Capacity + Star rating */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="defaultPricePerNight" className={labelCls}>
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
            className={inputCls}
            placeholder="120"
          />
        </div>
        {type === "hotel" && (
          <div>
            <label htmlFor="starRating" className={labelCls}>
              Star rating (1–5)
            </label>
            <select
              id="starRating"
              name="starRating"
              defaultValue={hotel?.starRating ?? ""}
              className={inputCls}
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
          <label htmlFor="maxConcurrentBookings" className={labelCls}>
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
            className={inputCls}
            placeholder="Leave empty for unlimited"
          />
          <p className={helperCls}>
            Used by scheduling to flag overlapping tours that exceed this supplier&apos;s capacity.
          </p>
        </div>
        {type === "transport" && (
          <div>
            <label htmlFor="capacity" className={labelCls}>
              Passenger capacity
            </label>
            <input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              step={1}
              defaultValue={hotel?.capacity}
              className={inputCls}
              placeholder="e.g. 3, 6, 18"
            />
            <p className={helperCls}>
              Max passengers this vehicle can carry. Used to filter recommendations in the trip builder.
            </p>
          </div>
        )}
        <div>
          <label htmlFor="currency" className={labelCls}>
            Currency
          </label>
          <select
            id="currency"
            name="currency"
            defaultValue={hotel?.currency ?? "USD"}
            className={inputCls}
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="LKR">LKR</option>
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className={labelCls}>
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={hotel?.notes}
          className={inputCls}
          placeholder="Contract details, special rates..."
        />
      </div>

      {/* Banking Details */}
      <div className="rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] p-5">
        <h3 className="mb-1 text-sm font-semibold text-[#11272b]">Banking Details</h3>
        <p className="mb-4 text-xs text-[#5e7279]">For bank transfers and payables reporting</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="bankName" className={labelCls}>
              Bank name
            </label>
            <input
              id="bankName"
              name="bankName"
              type="text"
              defaultValue={hotel?.bankName}
              className={inputCls}
              placeholder="Commercial Bank of Ceylon"
            />
          </div>
          <div>
            <label htmlFor="bankBranch" className={labelCls}>
              Branch
            </label>
            <input
              id="bankBranch"
              name="bankBranch"
              type="text"
              defaultValue={hotel?.bankBranch}
              className={inputCls}
              placeholder="Colombo Main"
            />
          </div>
          <div>
            <label htmlFor="accountName" className={labelCls}>
              Account name
            </label>
            <input
              id="accountName"
              name="accountName"
              type="text"
              defaultValue={hotel?.accountName}
              className={inputCls}
              placeholder="Jetwing Hotels (Pvt) Ltd"
            />
          </div>
          <div>
            <label htmlFor="accountNumber" className={labelCls}>
              Account number
            </label>
            <input
              id="accountNumber"
              name="accountNumber"
              type="text"
              defaultValue={hotel?.accountNumber}
              className={inputCls}
              placeholder="1234567890"
            />
          </div>
          <div>
            <label htmlFor="swiftCode" className={labelCls}>
              SWIFT / BIC
            </label>
            <input
              id="swiftCode"
              name="swiftCode"
              type="text"
              defaultValue={hotel?.swiftCode}
              className={inputCls}
              placeholder="CCEYLKLX"
            />
          </div>
          <div>
            <label htmlFor="bankCurrency" className={labelCls}>
              Bank currency
            </label>
            <select
              id="bankCurrency"
              name="bankCurrency"
              defaultValue={hotel?.bankCurrency ?? ""}
              className={inputCls}
            >
              <option value="">— Select —</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="LKR">LKR</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="paymentReference" className={labelCls}>
              Payment reference (for transfers)
            </label>
            <input
              id="paymentReference"
              name="paymentReference"
              type="text"
              defaultValue={hotel?.paymentReference}
              className={inputCls}
              placeholder="Invoice #123, Booking ref"
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-3">
        <button
          type="submit"
          className="rounded-xl bg-[#12343b] px-6 py-2.5 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
        >
          {hotel ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}
