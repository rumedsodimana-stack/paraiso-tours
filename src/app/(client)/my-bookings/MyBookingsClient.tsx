"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Calendar, MapPin, Clock, ChevronRight } from "lucide-react";
import { getClientBookingsAction } from "./actions";

type ClientBookings = Awaited<ReturnType<typeof getClientBookingsAction>>;

export function MyBookingsClient() {
  const searchParams = useSearchParams();
  const urlEmail = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(urlEmail);
  const [data, setData] = useState<ClientBookings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (urlEmail) {
      setEmail(urlEmail);
      fetchBookings(urlEmail.trim());
    }
  }, [urlEmail]);

  async function fetchBookings(emailToUse: string) {
    setError("");
    setLoading(true);
    setData(null);
    try {
      const result = await getClientBookingsAction(emailToUse);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setData(result);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchBookings(email.trim());
  }

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const hasResults =
    data &&
    !("error" in data) &&
    ((data.requests?.length ?? 0) > 0 || (data.tours?.length ?? 0) > 0);

  return (
    <div className="mt-4 space-y-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="email" className="block text-sm font-medium text-stone-700">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="mt-1 w-full rounded-xl border border-stone-200 bg-white py-2.5 px-4 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-teal-600 px-6 py-2.5 font-medium text-white transition hover:bg-teal-700 disabled:opacity-70"
        >
          {loading ? "Loading…" : "View my bookings"}
        </button>
      </form>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {data && !hasResults && (
        <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-6 text-center text-stone-600">
          No bookings found for this email.{" "}
          <Link href="/packages" className="text-teal-600 hover:underline">
            Browse packages
          </Link>{" "}
          to make a request.
        </div>
      )}

      {hasResults && data && "requests" in data && (
        <div className="space-y-8">
          {(data.requests?.length ?? 0) > 0 && (
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-stone-900">
                <Clock className="h-4 w-4 text-amber-500" />
                Pending requests
              </h3>
              <p className="mt-1 text-sm text-stone-600">
                Waiting for service provider approval
              </p>
              <div className="mt-4 space-y-3">
                {data.requests.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/booking/${encodeURIComponent(lead.reference ?? lead.id)}?email=${encodeURIComponent(email.trim())}`}
                    className="block rounded-xl border border-white/50 bg-white/70 p-4 shadow-lg backdrop-blur-xl transition hover:border-teal-200 hover:shadow-xl"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-medium text-teal-700">
                          {lead.reference ?? lead.id}
                        </p>
                        <p className="mt-1 font-medium text-stone-900">
                          {lead.destination ?? "Tour request"}
                        </p>
                        {lead.travelDate && (
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-600">
                            <Calendar className="h-3.5 w-3.5" />
                            Preferred: {formatDate(lead.travelDate)}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                        Pending
                      </span>
                    </div>
                    <p className="mt-3 flex items-center gap-1 text-xs text-teal-600">
                      View details <ChevronRight className="h-3.5 w-3.5" />
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {data.tours.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-stone-900">
                <MapPin className="h-4 w-4 text-emerald-500" />
                Confirmed tours
              </h3>
              <p className="mt-1 text-sm text-stone-600">
                Approved by our team – full itinerary available
              </p>
              <div className="mt-4 space-y-3">
                {data.tours.map(({ tour, package: pkg }) => (
                  <Link
                    key={tour.id}
                    href={`/booking/${encodeURIComponent(tour.id)}?email=${encodeURIComponent(email.trim())}`}
                    className="block rounded-xl border border-white/50 bg-white/70 p-4 shadow-lg backdrop-blur-xl transition hover:border-teal-200 hover:shadow-xl"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-medium text-teal-700">
                          {tour.id}
                        </p>
                        <p className="mt-1 font-medium text-stone-900">{tour.packageName}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-600">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(tour.startDate)} – {formatDate(tour.endDate)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                        {tour.status}
                      </span>
                    </div>
                    <p className="mt-3 flex items-center gap-1 text-xs text-teal-600">
                      View itinerary <ChevronRight className="h-3.5 w-3.5" />
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
