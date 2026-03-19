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
          <label htmlFor="name" className="block text-sm font-medium text-stone-700">
            Client Name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={lead?.name}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            placeholder="John & Sarah Mitchell"
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
            defaultValue={lead?.email}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            placeholder="john@email.com"
          />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-stone-700">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={lead?.phone}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            placeholder="+94 77 123 4567"
          />
        </div>
        <div>
          <label htmlFor="source" className="block text-sm font-medium text-stone-700">
            Source
          </label>
          <select
            id="source"
            name="source"
            defaultValue={lead?.source ?? "Manual"}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
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
          <label htmlFor="status" className="block text-sm font-medium text-stone-700">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={lead?.status ?? "new"}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="destination" className="block text-sm font-medium text-stone-700">
            Destination
          </label>
          <input
            id="destination"
            name="destination"
            type="text"
            defaultValue={lead?.destination}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            placeholder="Sri Lanka"
          />
        </div>
      </div>
      {packages.length > 0 && (
        <div>
          <label htmlFor="packageId" className="block text-sm font-medium text-stone-700">
            Tour Package (optional)
          </label>
          <select
            id="packageId"
            name="packageId"
            defaultValue={lead?.packageId ?? ""}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
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
          <label htmlFor="travelDate" className="block text-sm font-medium text-stone-700">
            Travel Date
          </label>
          <input
            id="travelDate"
            name="travelDate"
            type="date"
            defaultValue={lead?.travelDate}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
          />
        </div>
        <div>
          <label htmlFor="pax" className="block text-sm font-medium text-stone-700">
            Number of Travelers
          </label>
          <input
            id="pax"
            name="pax"
            type="number"
            min={1}
            defaultValue={lead?.pax}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            placeholder="2"
          />
        </div>
        <div>
          <label htmlFor="accompaniedGuestName" className="block text-sm font-medium text-stone-700">
            Accompanied Guest Name
          </label>
          <input
            id="accompaniedGuestName"
            name="accompaniedGuestName"
            type="text"
            defaultValue={lead?.accompaniedGuestName}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            placeholder="When 2+ travelers"
          />
          <p className="mt-1 text-xs text-stone-500">Shown on tour detail when 2+ guests</p>
        </div>
      </div>
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-stone-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={lead?.notes}
          className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
          placeholder="Interests, special requests..."
        />
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving…" : lead ? "Update Booking" : "Add Booking"}
        </button>
      </div>
    </form>
  );
}
