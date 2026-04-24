"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
    <div className="space-y-8">
      <form onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
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
                className="w-full rounded-full border border-[var(--portal-border)] bg-white/90 py-3 pl-11 pr-4 text-sm text-stone-900 placeholder:text-stone-500 focus:border-[var(--portal-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--portal-ink)]/15"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--portal-ink)] px-6 py-3 text-sm font-semibold text-[var(--portal-cream)] shadow-[0_14px_34px_-18px_rgba(18,52,59,0.95)] transition hover:bg-[var(--portal-ink-soft)] disabled:opacity-70"
          >
            {loading ? "Checking…" : "View my bookings"}
          </button>
        </div>
      </form>

      {error ? (
        <div className="rounded-[var(--portal-radius-md)] bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {data && !hasResults ? (
        <div className="flex flex-col items-center gap-4 rounded-[var(--portal-radius-lg)] border border-[var(--portal-border)]/60 bg-white/70 px-6 py-12 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-eyebrow)]">
            Nothing found
          </p>
          <h3 className="portal-display text-2xl font-semibold tracking-tight text-stone-900">
            No bookings match this email yet
          </h3>
          <p className="max-w-md text-sm leading-6 text-stone-600">
            Try another email or start with a new Sri Lanka route.
          </p>
          <Link
            href="/packages"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--portal-ink)] px-5 py-3 text-sm font-semibold text-[var(--portal-cream)] transition hover:bg-[var(--portal-ink-soft)]"
          >
            Browse packages
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}

      {hasResults && data && "requests" in data ? (
        <div className="space-y-10">
          {(data.requests?.length ?? 0) > 0 ? (
            <section>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                  <Clock3 className="h-5 w-5 text-amber-700" />
                </span>
                <div>
                  <h3 className="portal-display text-lg font-semibold tracking-tight text-stone-900">
                    Pending requests
                  </h3>
                  <p className="text-sm text-stone-600">
                    Waiting for the admin team to approve and schedule
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {data.requests.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/booking/${encodeURIComponent(lead.reference ?? lead.id)}?email=${encodeURIComponent(email.trim())}`}
                    className="group rounded-[var(--portal-radius-lg)] border border-[var(--portal-border)]/60 bg-white/85 p-6 shadow-[var(--portal-shadow-md)] transition hover:-translate-y-0.5 hover:shadow-[var(--portal-shadow-lg)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-eyebrow)]">
                          Reference
                        </p>
                        <p className="portal-display mt-2 font-mono text-lg font-semibold text-[var(--portal-ink)]">
                          {lead.reference ?? lead.id}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">
                        Pending
                      </span>
                    </div>

                    <div className="mt-5 space-y-2 text-sm text-stone-600">
                      <p>{lead.destination ?? "Tour request"}</p>
                      {lead.travelDate ? (
                        <p className="inline-flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-[var(--portal-ink)]" />
                          Preferred: {formatDate(lead.travelDate)}
                        </p>
                      ) : null}
                    </div>

                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--portal-ink)]">
                      Open request
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {data.tours.length > 0 ? (
            <section>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                  <MapPin className="h-5 w-5 text-emerald-700" />
                </span>
                <div>
                  <h3 className="portal-display text-lg font-semibold tracking-tight text-stone-900">
                    Confirmed tours
                  </h3>
                  <p className="text-sm text-stone-600">
                    Live trips already linked to the admin operations records
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {data.tours.map(({ tour, package: pkg, invoice, payment }) => {
                  const visual = getClientPackageVisual(pkg);

                  return (
                    <Link
                      key={tour.id}
                      href={`/booking/${encodeURIComponent(tour.id)}?email=${encodeURIComponent(email.trim())}`}
                      className="group relative overflow-hidden rounded-[var(--portal-radius-lg)] border border-white/15 bg-[var(--portal-ink-dark)] text-[var(--portal-sand-warm)] shadow-[var(--portal-shadow-lg)] transition hover:-translate-y-0.5"
                    >
                      <Image
                        src={visual.imageUrl}
                        alt={pkg.name}
                        fill
                        sizes="(min-width: 1024px) 50vw, 100vw"
                        className="object-cover opacity-70 transition duration-700 group-hover:scale-[1.02]"
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(11,33,38,0.92)_10%,rgba(11,33,38,0.62)_48%,rgba(11,33,38,0.24)_100%)]" />
                      <div className="relative p-6">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-gold)]">
                              {visual.eyebrow}
                            </p>
                            <h4 className="portal-display mt-3 text-2xl font-semibold leading-tight tracking-tight text-white">
                              {tour.packageName}
                            </h4>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                              statusColors[tour.status] ??
                              "bg-stone-100 text-stone-700"
                            }`}
                          >
                            {toLabel(tour.status)}
                          </span>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2 text-sm text-[var(--portal-sand-warm)]">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/14 bg-white/10 px-3 py-1.5">
                            <Calendar className="h-4 w-4" />
                            {formatDate(tour.startDate)} → {formatDate(tour.endDate)}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/14 bg-white/10 px-3 py-1.5">
                            <MapPin className="h-4 w-4" />
                            {pkg.region ?? pkg.destination}
                          </span>
                        </div>

                        {invoice || payment ? (
                          <div className="mt-5 flex flex-wrap gap-2">
                            {invoice ? (
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ${
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
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                                  statusColors[payment.status] ??
                                  "bg-stone-100 text-stone-700"
                                }`}
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                                Payment {toLabel(payment.status)}
                              </span>
                            ) : null}
                          </div>
                        ) : null}

                        <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--portal-cream)]">
                          Open itinerary
                          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
