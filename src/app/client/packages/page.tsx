import Link from "next/link";
import { MapPin, Clock, DollarSign, ChevronRight } from "lucide-react";
import { getPackages } from "@/lib/db";

export default async function ClientPackagesPage() {
  const packages = await getPackages();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">
          Our Tour Packages
        </h1>
        <p className="mt-1 text-stone-600">
          Choose your perfect Sri Lanka experience
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-white/50 bg-white/70 shadow-xl backdrop-blur-xl transition hover:shadow-2xl hover:border-teal-200/50"
          >
            <div className="border-b border-white/30 bg-amber-500/10 px-6 py-5">
              <h2 className="text-xl font-semibold text-stone-900">
                {pkg.name}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-stone-600">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {pkg.destination}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {pkg.duration}
                </span>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-6">
              <p className="line-clamp-3 text-sm text-stone-600">
                {pkg.description}
              </p>
              <div className="mt-4 flex items-end justify-between gap-4">
                <span className="flex items-center gap-1 text-lg font-bold text-teal-600">
                  <DollarSign className="h-5 w-5" />
                  {pkg.price.toLocaleString()}{" "}
                  <span className="text-sm font-medium text-stone-500">
                    {pkg.currency} / person
                  </span>
                </span>
                <Link
                  href={`/client/packages/${pkg.id}/book`}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
                >
                  Request this tour
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {packages.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/50 py-16 text-center">
          <p className="text-stone-500">No packages available yet.</p>
          <p className="mt-1 text-sm text-stone-400">
            Check back soon for exciting Sri Lanka tours.
          </p>
        </div>
      )}
    </div>
  );
}
