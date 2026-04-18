"use client";

import { useState } from "react";
import type { Lead } from "@/lib/types";

const SOURCES = ["Client Portal", "Manual", "Website", "Referral", "Instagram", "Facebook", "Google", "Email", "Phone", "Walk-in", "Other"];
const STATUSES = ["new", "contacted", "quoted", "negotiating", "won", "lost"] as const;

export function LeadForm({
  lead,
  packages = [],
  onSubmit,
}: {
  lead?: Lead;
  packages?: { id: string; name: string; destination?: string }[];
  onSubmit: (formData: FormData) => Promise<{ error?: string } | void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      const result = await onSubmit(formData);
      if (result && typeof result === "object" && "error" in result && result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-[#11272b]">
            Client Name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={lead?.name}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
            placeholder="John & Sarah Mitchell"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[#11272b]">
            Email *
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={lead?.email}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
            placeholder="john@email.com"
          />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-[#11272b]">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={lead?.phone}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
            placeholder="+94 77 123 4567"
          />
        </div>
        <div>
          <label htmlFor="source" className="block text-sm font-medium text-[#11272b]">
            Source
          </label>
          <select
            id="source"
            name="source"
            defaultValue={lead?.source ?? "Manual"}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-[#11272b]">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={lead?.status ?? "new"}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="destination" className="block text-sm font-medium text-[#11272b]">
            Destination
          </label>
          <input
            id="destination"
            name="destination"
            type="text"
            defaultValue={lead?.destination}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
            placeholder="Sri Lanka"
          />
        </div>
      </div>
      {packages.length > 0 && (
        <div>
          <label htmlFor="packageId" className="block text-sm font-medium text-[#11272b]">
            Tour Package (optional)
          </label>
          <select
            id="packageId"
            name="packageId"
            defaultValue={lead?.packageId ?? ""}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          >
            <option value="">— None —</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.destination ? `(${p.destination})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="travelDate" className="block text-sm font-medium text-[#11272b]">
            Travel Date
          </label>
          <input
            id="travelDate"
            name="travelDate"
            type="date"
            defaultValue={lead?.travelDate}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>
        <div>
          <label htmlFor="pax" className="block text-sm font-medium text-[#11272b]">
            Number of Travelers
          </label>
          <input
            id="pax"
            name="pax"
            type="number"
            min={1}
            defaultValue={lead?.pax}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
            placeholder="2"
          />
        </div>
        <div>
          <label htmlFor="accompaniedGuestName" className="block text-sm font-medium text-[#11272b]">
            Accompanied Guest Name
          </label>
          <input
            id="accompaniedGuestName"
            name="accompaniedGuestName"
            type="text"
            defaultValue={lead?.accompaniedGuestName}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
            placeholder="When 2+ travelers"
          />
          <p className="mt-1 text-xs text-[#5e7279]">Shown on tour detail when 2+ guests</p>
        </div>
      </div>
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-[#11272b]">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={lead?.notes}
          className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          placeholder="Interests, special requests..."
        />
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-[#12343b] px-6 py-2.5 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving…" : lead ? "Update Booking" : "Add Booking"}
        </button>
      </div>
    </form>
  );
}
