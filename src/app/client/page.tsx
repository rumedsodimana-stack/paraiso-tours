import Link from "next/link";
import { Suspense } from "react";
import { MapPin, Package, Search } from "lucide-react";
import { ClientLookupForm } from "./ClientLookupForm";

export default function ClientPortalPage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-stone-900 sm:text-4xl">
          Your Sri Lanka adventure awaits
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-stone-600">
          Browse our curated tours or check the status of your existing booking
        </p>
      </div>

      {/* Two options */}
      <div className="grid gap-8 lg:grid-cols-2">
        <Link
          href="/client/packages"
          className="group flex flex-col rounded-2xl border border-white/50 bg-white/70 p-8 shadow-xl backdrop-blur-xl transition hover:border-teal-300/50 hover:shadow-2xl"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-100 text-teal-600 group-hover:bg-teal-200">
            <Package className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-stone-900">
            Browse & book a tour
          </h2>
          <p className="mt-2 flex-1 text-stone-600">
            Explore our tour packages and submit a booking request. We&apos;ll
            get back to you within 24 hours with a personalised quote.
          </p>
          <span className="mt-4 inline-flex items-center gap-2 text-teal-600 font-medium group-hover:text-teal-700">
            View packages
            <span aria-hidden>→</span>
          </span>
        </Link>

        <div className="rounded-2xl border border-white/50 bg-white/70 p-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-stone-900">
              View your booking
            </h2>
          </div>
          <p className="mt-2 text-sm text-stone-600">
            Already have a booking? Enter your reference and email to see your
            itinerary and details.
          </p>
          <div className="mt-4">
            <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-stone-100" />}>
              <ClientLookupForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
