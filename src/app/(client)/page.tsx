import Link from "next/link";
import { Suspense } from "react";
import {
  MapPin,
  Search,
  Headphones,
  Shield,
  Clock,
  BadgeCheck,
  ChevronRight,
  Star,
} from "lucide-react";
import { ClientLookupForm } from "./ClientLookupForm";
import { ThingsToDoSlideshow } from "./ThingsToDoSlideshow";
import { getPackagesForClient } from "@/lib/db";
import { getFromPrice } from "@/lib/package-price";

const TRUST_BADGES = [
  {
    icon: Headphones,
    title: "24/7 support",
    text: "We're here to help, anytime.",
  },
  {
    icon: BadgeCheck,
    title: "Best price guarantee",
    text: "Find a lower price? We'll match it.",
  },
  {
    icon: Star,
    title: "Expert-curated tours",
    text: "Designed by local specialists.",
  },
  {
    icon: Shield,
    title: "Plan your way",
    text: "Free cancellation & reserve now, pay later.",
  },
];

export default async function ClientPortalPage() {
  const allPackages = await getPackagesForClient();
  const featuredPackages = allPackages.filter((p) => p.featured).slice(0, 6);

  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 px-8 py-16 text-center shadow-xl backdrop-blur-xl sm:px-12 sm:py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50/50 via-transparent to-amber-50/30" aria-hidden="true" />
        <h1 className="relative text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
          Do more with Paraíso Ceylon
        </h1>
        <p className="relative mx-auto mt-5 max-w-2xl text-lg text-stone-600">
          Plan better with curated Sri Lanka experiences. Explore ancient cities,
          tea country, wildlife safaris, and pristine beaches.
        </p>
        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/packages"
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-teal-600/25 transition hover:bg-teal-700 hover:shadow-xl"
          >
            Explore tours
            <ChevronRight className="h-5 w-5" />
          </Link>
          <Link
            href="/my-bookings"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-stone-200 bg-white px-8 py-3.5 text-base font-semibold text-stone-800 transition hover:border-teal-300 hover:bg-teal-50/50"
          >
            Manage my bookings
          </Link>
        </div>
      </section>

      {/* Why book with us */}
      <section>
        <h2 className="text-center text-2xl font-bold text-stone-900">
          Why book with us?
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-stone-600">
          Trust, flexibility, and local expertise in every trip
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_BADGES.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="flex flex-col items-center rounded-2xl border border-white/50 bg-white/70 p-6 text-center shadow-xl backdrop-blur-xl transition hover:border-teal-200/60 hover:shadow-2xl"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-teal-600">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold text-stone-900">{title}</h3>
              <p className="mt-1 text-sm text-stone-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Things to do in Sri Lanka - slideshow */}
      <ThingsToDoSlideshow />

      {/* Keep things flexible */}
      <section className="rounded-2xl border-2 border-teal-200/60 bg-teal-50/50 px-6 py-8 text-center backdrop-blur-sm">
        <Clock className="mx-auto h-12 w-12 text-teal-600" />
        <h2 className="mt-4 text-xl font-bold text-stone-900">
          Keep things flexible
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-stone-600">
          Use Reserve Now & Pay Later to secure the tours you don&apos;t want to
          miss. Free cancellation up to 24 hours before most experiences.
        </p>
      </section>

      {/* Top / Featured tours */}
      {featuredPackages.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-stone-900">
            Top tours
          </h2>
          <p className="mt-1 text-stone-600">
            Our most popular Sri Lanka experiences
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredPackages.map((pkg) => (
              <Link
                key={pkg.id}
                href={`/packages/${pkg.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/50 bg-white/80 shadow-xl backdrop-blur-xl transition hover:border-teal-200 hover:shadow-2xl"
              >
                <div className="aspect-[16/10] overflow-hidden">
                  {pkg.imageUrl ? (
                    <img src={pkg.imageUrl} alt={pkg.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-100 to-amber-100">
                      <MapPin className="h-12 w-12 text-teal-400" />
                    </div>
                  )}
                </div>
                <div className="border-b border-white/30 bg-amber-500/10 px-6 py-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-semibold text-stone-900 group-hover:text-teal-700">
                      {pkg.name}
                    </h3>
                    {(pkg.rating ?? 0) > 0 && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-sm font-medium text-amber-800">
                        <Star className="h-3.5 w-3.5 fill-amber-400" />
                        {pkg.rating!.toFixed(1)}
                        {pkg.reviewCount != null && (
                          <span className="text-amber-700/80">
                            ({pkg.reviewCount})
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-stone-600">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {pkg.region ?? pkg.destination}
                    </span>
                    <span>{pkg.duration}</span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <p className="line-clamp-2 text-sm text-stone-600">
                    {pkg.description}
                  </p>
                  <div className="mt-4 flex items-end justify-between gap-4">
                    <span className="text-lg font-bold text-teal-600">
                      From {getFromPrice(pkg).toLocaleString()} {pkg.currency}
                      <span className="text-sm font-medium text-stone-500"> / person</span>
                    </span>
                    <span className="text-teal-600 font-medium group-hover:text-teal-700">
                      Book now →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/packages"
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
            >
              View all tours
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      {/* Free cancellation */}
      <section className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 px-6 py-6 text-center">
        <Shield className="mx-auto h-10 w-10 text-emerald-600" />
        <h2 className="mt-3 font-semibold text-stone-900">
          Free cancellation
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Full refund if you cancel at least 24 hours before most experiences
        </p>
      </section>

      {/* View your booking */}
      <section className="rounded-2xl border border-white/50 bg-white/70 p-8 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Search className="h-6 w-6 text-teal-600" />
          <h2 className="text-xl font-semibold text-stone-900">
            View your booking
          </h2>
        </div>
        <p className="mt-2 text-stone-600">
          Already have a booking? Enter your reference or email to see your
          itinerary and details.
        </p>
        <div className="mt-6">
          <Suspense
            fallback={
              <div className="h-48 animate-pulse rounded-xl bg-stone-100" />
            }
          >
            <ClientLookupForm />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
