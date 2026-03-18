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
    packages = [...packages].sort((a, b) => a.price - b.price);
  } else if (sortBy === "price-desc") {
    packages = [...packages].sort((a, b) => b.price - a.price);
  } else if (sortBy === "rating") {
    packages = [...packages].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  } else if (sortBy === "name") {
    packages = [...packages].sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">
            Our Tour Packages
          </h1>
          <p className="mt-1 text-stone-600">
            Choose your perfect Sri Lanka experience
          </p>
        </div>
      </div>

      {/* Search and sort */}
      <Suspense fallback={<div className="h-12 animate-pulse rounded-xl bg-stone-100" />}>
        <PackageFilters
          regionFilter={regionFilter}
          initialQ={(params.q as string) || ""}
          initialSort={sortBy}
        />
      </Suspense>

      {/* Region filter */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-stone-500" />
        <span className="text-sm font-medium text-stone-600">Filter by region:</span>
        <Link
          href="/packages"
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            !regionFilter
              ? "bg-teal-600 text-white"
              : "bg-white/70 text-stone-600 hover:bg-white"
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
                ? "bg-teal-600 text-white"
                : "bg-white/70 text-stone-600 hover:bg-white"
            }`}
          >
            {region}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-white/50 bg-white/70 shadow-xl backdrop-blur-xl transition hover:shadow-2xl hover:border-teal-200/50"
          >
            <Link href={`/packages/${pkg.id}`} className="block aspect-[16/10] overflow-hidden">
              {pkg.imageUrl ? (
                <img src={pkg.imageUrl} alt={pkg.name} className="h-full w-full object-cover transition hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-100 to-amber-100">
                  <MapPin className="h-16 w-16 text-teal-400" />
                </div>
              )}
            </Link>
            <div className="flex flex-1 flex-col p-6">
              <h2 className="text-xl font-semibold text-stone-900">
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
                  From {pkg.price.toLocaleString()}{" "}
                  <span className="text-sm font-medium text-stone-500">
                    {pkg.currency} / person
                  </span>
                </span>
                <Link
                  href={`/packages/${pkg.id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
                >
                  Book now
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {packages.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/50 py-16 text-center">
          <p className="text-stone-500">
            {regionFilter
              ? `No packages in ${regionFilter} yet.`
              : "No packages available yet."}
          </p>
          <Link
            href="/packages"
            className="mt-3 inline-block text-sm font-medium text-teal-600 hover:text-teal-700"
          >
            View all tours
          </Link>
        </div>
      )}
    </div>
  );
}
