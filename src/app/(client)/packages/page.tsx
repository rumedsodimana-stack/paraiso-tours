import Link from "next/link";
import { Suspense } from "react";
import {
  MapPin,
  Clock,
  DollarSign,
  ChevronRight,
  Star,
  Shield,
  Filter,
} from "lucide-react";
import { PackageFilters } from "./PackageFilters";
import { getPackagesForClient } from "@/lib/db";
import { getFromPrice } from "@/lib/package-price";

const REGIONS = [
  "All",
  "Colombo",
  "Kandy",
  "Galle",
  "Ella",
  "Sigiriya",
  "Yala",
  "Nuwara Eliya",
  "Southern Coast",
  "Cultural Triangle",
  "Tea Country",
];

export default async function ClientPackagesPage({
  searchParams,
}: {
  searchParams?: Promise<{ region?: string; q?: string; sort?: string }> | { region?: string; q?: string; sort?: string };
}) {
  const params = searchParams ? await Promise.resolve(searchParams) : {};
  const regionFilter = (params.region as string)?.trim() || "";
  const searchQ = (params.q as string)?.trim().toLowerCase() || "";
  const sortBy = (params.sort as string) || "default";

  let packages = await getPackagesForClient();

  if (regionFilter && regionFilter.toLowerCase() !== "all") {
    packages = packages.filter(
      (p) => (p.region ?? p.destination)?.toLowerCase() === regionFilter.toLowerCase()
    );
  }

  if (searchQ) {
    packages = packages.filter(
      (p) =>
        p.name.toLowerCase().includes(searchQ) ||
        p.description?.toLowerCase().includes(searchQ) ||
        (p.region ?? p.destination)?.toLowerCase().includes(searchQ)
    );
  }

  if (sortBy === "price") {
    packages = [...packages].sort((a, b) => getFromPrice(a) - getFromPrice(b));
  } else if (sortBy === "price-desc") {
    packages = [...packages].sort((a, b) => getFromPrice(b) - getFromPrice(a));
  } else if (sortBy === "rating") {
    packages = [...packages].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  } else if (sortBy === "name") {
    packages = [...packages].sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-white/50 bg-white/70 p-6 shadow-xl backdrop-blur-xl sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
          Our Tour Packages
        </h1>
        <p className="mt-2 text-stone-600">
          Choose your perfect Sri Lanka experience
        </p>

        {/* Search and sort */}
        <div className="mt-6">
          <Suspense fallback={<div className="h-12 animate-pulse rounded-xl bg-stone-100" />}>
            <PackageFilters
              regionFilter={regionFilter}
              initialQ={(params.q as string) || ""}
              initialSort={sortBy}
            />
          </Suspense>
        </div>

        {/* Region filter */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-stone-500" />
          <span className="text-sm font-medium text-stone-600">Region:</span>
          <Link
            href="/packages"
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              !regionFilter
                ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                : "border border-white/60 bg-white/70 text-stone-600 backdrop-blur-sm hover:border-teal-200 hover:bg-white/90"
            }`}
          >
            All
          </Link>
          {REGIONS.filter((r) => r !== "All").map((region) => (
            <Link
              key={region}
              href={`/packages?region=${encodeURIComponent(region)}`}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                regionFilter.toLowerCase() === region.toLowerCase()
                  ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                  : "border border-white/60 bg-white/70 text-stone-600 backdrop-blur-sm hover:border-teal-200 hover:bg-white/90"
              }`}
            >
              {region}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <Link
            key={pkg.id}
            href={`/packages/${pkg.id}`}
            className="group flex flex-col overflow-hidden rounded-2xl border border-white/50 bg-white/70 shadow-xl backdrop-blur-xl transition hover:border-teal-200/60 hover:shadow-2xl"
          >
            <div className="relative block aspect-[16/10] overflow-hidden">
              {pkg.imageUrl ? (
                <img src={pkg.imageUrl} alt={pkg.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-100 to-amber-100">
                  <MapPin className="h-16 w-16 text-teal-400" />
                </div>
              )}
              {pkg.featured && (
                <span className="absolute right-3 top-3 rounded-full bg-amber-400/90 px-2.5 py-1 text-xs font-semibold text-amber-900 backdrop-blur-sm">
                  Featured
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-6">
              <h2 className="text-xl font-semibold text-stone-900 group-hover:text-teal-700 transition">
                {pkg.name}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-stone-600">
                {pkg.rating != null && (
                  <span className="flex items-center gap-1.5 font-medium text-amber-700">
                    <Star className="h-4 w-4 fill-amber-400" />
                    {pkg.rating.toFixed(1)}
                    {pkg.reviewCount != null && (
                      <span className="font-normal text-stone-500">
                        ({pkg.reviewCount} reviews)
                      </span>
                    )}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {pkg.region ?? pkg.destination}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {pkg.duration}
                </span>
              </div>
              <p className="mt-3 line-clamp-3 text-sm text-stone-600">
                {pkg.description}
              </p>
              {pkg.cancellationPolicy && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
                  <Shield className="h-3.5 w-3.5" />
                  {pkg.cancellationPolicy}
                </p>
              )}
              <div className="mt-4 flex items-end justify-between gap-4">
                <span className="flex items-center gap-1 text-lg font-bold text-teal-600">
                  <DollarSign className="h-5 w-5" />
                  From {getFromPrice(pkg).toLocaleString()}{" "}
                  <span className="text-sm font-medium text-stone-500">
                    {pkg.currency} / person
                  </span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white group-hover:bg-teal-700 transition">
                  Book now
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {packages.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 py-20 text-center backdrop-blur-sm">
          <MapPin className="mx-auto h-16 w-16 text-stone-300" />
          <p className="mt-4 text-lg font-medium text-stone-600">
            {regionFilter
              ? `No packages in ${regionFilter} yet.`
              : "No packages available yet."}
          </p>
          <p className="mt-1 text-sm text-stone-500">
            Try a different region or search term
          </p>
          <Link
            href="/packages"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
          >
            View all tours
          </Link>
        </div>
      )}
    </div>
  );
}
