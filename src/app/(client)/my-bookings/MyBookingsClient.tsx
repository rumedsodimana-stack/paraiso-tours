"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Clock3,
  CreditCard,
  FileText,
  Mail,
  MapPin,
} from "lucide-react";
import { getClientBookingsAction } from "./actions";
import { getClientPackageVisual } from "../client-visuals";

type ClientBookings = Awaited<ReturnType<typeof getClientBookingsAction>>;

function toLabel(value: string) {
  return value.replace(/_/g, " ").replace(/-/g, " ");
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  scheduled: "bg-sky-100 text-sky-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  "in-progress": "bg-amber-100 text-amber-800",
  completed: "bg-stone-100 text-stone-700",
  cancelled: "bg-rose-100 text-rose-800",
  pending_payment: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
};

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
      void fetchBookings(urlEmail.trim());
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
    await fetchBookings(email.trim());
  }

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("en-US", {
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
      <form
        onSubmit={handleSubmit}
        className="rounded-[1.75rem] border border-[#ddc8b0] bg-[#fbf7f1] p-5 sm:p-6"
      >
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-stone-700"
            >
              Email address
            </label>
            <div className="relative mt-1">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full rounded-[1rem] border border-[#ddc8b0] bg-white py-3 pl-11 pr-4 focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-[#12343b] px-6 py-3 font-semibold text-[#f6ead6] shadow-[0_16px_40px_-26px_rgba(18,52,59,0.95)] transition hover:bg-[#0f2b31] disabled:opacity-70"
          >
            {loading ? "Checking…" : "View my bookings"}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-[1rem] bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && !hasResults && (
        <div className="rounded-[2rem] border border-[#ddc8b0] bg-white/72 p-8 text-center shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
            Nothing found
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">
            No bookings match this email yet
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Try another email or start with a new Sri Lanka route.
          </p>
          <Link
            href="/packages"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#12343b] px-5 py-3 text-sm font-semibold text-[#f6ead6]"
          >
            Browse packages
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {hasResults && data && "requests" in data && (
        <div className="space-y-10">
          {(data.requests?.length ?? 0) > 0 && (
            <section>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100">
                  <Clock3 className="h-5 w-5 text-amber-700" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-stone-900">
                    Pending requests
                  </h3>
                  <p className="text-sm text-stone-600">
                    Waiting for the admin team to approve and schedule
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {data.requests.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/booking/${encodeURIComponent(lead.reference ?? lead.id)}?email=${encodeURIComponent(email.trim())}`}
                    className="rounded-[1.85rem] border border-[#ddc8b0] bg-white/72 p-6 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm transition hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-[#8c6a38]">
                          Reference
                        </p>
                        <p className="mt-2 font-mono text-lg font-semibold text-[#12343b]">
                          {lead.reference ?? lead.id}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
                        Pending
                      </span>
                    </div>

                    <div className="mt-5 space-y-2 text-sm text-stone-600">
                      <p>{lead.destination ?? "Tour request"}</p>
                      {lead.travelDate ? (
                        <p className="inline-flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-[#12343b]" />
                          Preferred: {formatDate(lead.travelDate)}
                        </p>
                      ) : null}
                    </div>

                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#12343b]">
                      Open request
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.tours.length > 0 && (
            <section>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100">
                  <MapPin className="h-5 w-5 text-emerald-700" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-stone-900">
                    Confirmed tours
                  </h3>
                  <p className="text-sm text-stone-600">
                    Live trips already linked to the admin operations records
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {data.tours.map(({ tour, package: pkg, invoice, payment }) => {
                  const visual = getClientPackageVisual(pkg);

                  return (
                    <Link
                      key={tour.id}
                      href={`/booking/${encodeURIComponent(tour.id)}?email=${encodeURIComponent(email.trim())}`}
                      className="group overflow-hidden rounded-[2rem] border border-white/20 bg-[#12343b] text-[#f7ead7] shadow-[0_24px_60px_-34px_rgba(18,52,59,0.95)]"
                      style={{
                        backgroundImage: `linear-gradient(120deg, rgba(11,33,38,0.92) 10%, rgba(11,33,38,0.62) 48%, rgba(11,33,38,0.24) 100%), url(${visual.imageUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-[#e5c48e]">
                              {visual.eyebrow}
                            </p>
                            <h4 className="mt-3 text-2xl font-semibold tracking-tight">
                              {tour.packageName}
                            </h4>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                              statusColors[tour.status] ?? "bg-stone-100 text-stone-700"
                            }`}
                          >
                            {toLabel(tour.status)}
                          </span>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2 text-sm text-[#ece1cf]">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/14 bg-white/10 px-3 py-1.5">
                            <Calendar className="h-4 w-4" />
                            {formatDate(tour.startDate)} to {formatDate(tour.endDate)}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/14 bg-white/10 px-3 py-1.5">
                            <MapPin className="h-4 w-4" />
                            {pkg.region ?? pkg.destination}
                          </span>
                        </div>

                        {(invoice || payment) && (
                          <div className="mt-5 flex flex-wrap gap-2">
                            {invoice ? (
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                                  statusColors[invoice.status] ??
                                  "bg-stone-100 text-stone-700"
                                }`}
                              >
                                <FileText className="h-3.5 w-3.5" />
                                Invoice {toLabel(invoice.status)}
                              </span>
                            ) : null}
                            {payment ? (
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                                  statusColors[payment.status] ??
                                  "bg-stone-100 text-stone-700"
                                }`}
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                                Payment {toLabel(payment.status)}
                              </span>
                            ) : null}
                          </div>
                        )}

                        <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#f6ead6]">
                          Open itinerary
                          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
