import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import {
  ArrowRight,
  Clock3,
  Filter,
  MapPin,
  ShieldCheck,
  Star,
} from "lucide-react";
import { PackageFilters } from "./PackageFilters";
import {
  destinationHighlights,
  getClientPackageVisual,
  homeHeroScene,
} from "../client-visuals";
import { CraftJourneyPromoCard } from "../CraftJourneyPromoCard";
import { getAppSettings } from "@/lib/app-config";
import { getPackagesForClient } from "@/lib/db";
import { getFromPrice } from "@/lib/package-price";

const REGIONS = [
  "All",
  "Colombo",
  "Yala",
  "Tea Country",
  "Cultural Triangle",
  "Southern Coast",
  "Eastern Province",
];

export default async function ClientPackagesPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{ region?: string; q?: string; sort?: string }>
    | { region?: string; q?: string; sort?: string };
}) {
  const params = searchParams ? await Promise.resolve(searchParams) : {};
  const regionFilter = (params.region as string)?.trim() || "";
  const searchQ = (params.q as string)?.trim().toLowerCase() || "";
  const sortBy = (params.sort as string) || "default";

  const settings = await getAppSettings();
  let packages = await getPackagesForClient();

  if (regionFilter && regionFilter.toLowerCase() !== "all") {
    packages = packages.filter(
      (pkg) =>
        (pkg.region ?? pkg.destination)?.toLowerCase() ===
        regionFilter.toLowerCase()
    );
  }

  if (searchQ) {
    packages = packages.filter(
      (pkg) =>
        pkg.name.toLowerCase().includes(searchQ) ||
        pkg.description?.toLowerCase().includes(searchQ) ||
        (pkg.region ?? pkg.destination)?.toLowerCase().includes(searchQ)
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
    <div className="space-y-8 pb-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-[#12343b] text-[#f7ead7] shadow-[0_28px_70px_-34px_rgba(18,52,59,0.95)]">
        <div className="absolute inset-0">
          <Image
            src={homeHeroScene.imageUrl}
            alt="Sri Lanka route planning"
            fill
            unoptimized
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[linear-gradient(118deg,rgba(11,33,38,0.92)_12%,rgba(11,33,38,0.64)_46%,rgba(11,33,38,0.24)_100%)]" />
        </div>

        <div className="relative px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.3em] text-[#e5c48e]">
              Package Browser
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Find the Sri Lanka route that matches your pace
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#e3dacb] sm:text-base">
              Filter by region, compare package styles, then drill into the
              route details before booking.
            </p>
          </div>

          <div className="mt-6">
            <Suspense
              fallback={
                <div className="h-14 animate-pulse rounded-[1.25rem] bg-white/10" />
              }
            >
              <PackageFilters
                regionFilter={regionFilter}
                initialQ={(params.q as string) || ""}
                initialSort={sortBy}
              />
            </Suspense>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-[#e5c48e]" />
            {REGIONS.map((region) => {
              const href =
                region === "All"
                  ? "/packages"
                  : `/packages?region=${encodeURIComponent(region)}`;
              const active =
                (region === "All" && !regionFilter) ||
                regionFilter.toLowerCase() === region.toLowerCase();

              return (
                <Link
                  key={region}
                  href={href}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-[#f4dfbe] text-[#12343b]"
                      : "border border-white/18 bg-white/10 text-[#efe3d0] backdrop-blur-sm hover:bg-white/14"
                  }`}
                >
                  {region}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {destinationHighlights.slice(0, 3).map((scene) => (
          <Link
            key={scene.title}
            href={scene.href}
            className="overflow-hidden rounded-[1.6rem] border border-[#ddc8b0] bg-white/70 shadow-[0_16px_40px_-30px_rgba(43,32,15,0.5)] backdrop-blur-sm transition hover:-translate-y-0.5"
          >
            <div className="relative aspect-[5/4] overflow-hidden">
              <Image
                src={scene.imageUrl}
                alt={scene.title}
                fill
                unoptimized
                className="object-cover"
                sizes="100vw"
              />
            </div>
            <div className="p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-[#8c6a38]">
                {scene.location}
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-900">
                {scene.title}
              </h2>
            </div>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <CraftJourneyPromoCard
          label={settings.portal.journeyBuilderLabel}
          className="lg:col-span-2"
        />
        {packages.map((pkg) => {
          const visual = getClientPackageVisual(pkg);

          return (
            <Link
              key={pkg.id}
              href={`/packages/${pkg.id}`}
              className="group relative overflow-hidden rounded-[2rem] border border-white/25 bg-[#12343b] text-[#f7ead7] shadow-[0_24px_60px_-34px_rgba(18,52,59,0.95)]"
            >
              <div className="absolute inset-0">
                <Image
                  src={visual.imageUrl}
                  alt={pkg.name}
                  fill
                  unoptimized
                  className="object-cover transition duration-700 group-hover:scale-105"
                  sizes="100vw"
                />
                <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(11,33,38,0.92)_8%,rgba(11,33,38,0.62)_46%,rgba(11,33,38,0.24)_100%)]" />
              </div>

              <div className="relative flex min-h-[26rem] flex-col justify-between p-6 sm:p-8">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.26em] text-[#e5c48e]">
                        {visual.eyebrow}
                      </p>
                      <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                        {pkg.name}
                      </h2>
                    </div>
                    {pkg.featured && (
                      <span className="rounded-full bg-[#f2dfbf] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#17343b]">
                        Featured
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[#ece1cf]">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {pkg.region ?? pkg.destination}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="h-4 w-4" />
                      {pkg.duration}
                    </span>
                    {(pkg.rating ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-[#f7d895]">
                        <Star className="h-4 w-4 fill-current" />
                        {pkg.rating?.toFixed(1)}
                      </span>
                    )}
                  </div>

                  <p className="mt-5 max-w-xl text-sm leading-7 text-[#e1d8ca]">
                    {pkg.description}
                  </p>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-[#d8ccb9]">
                    {visual.microcopy}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {visual.chips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-[#efe3d0]"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="rounded-[1.4rem] bg-[#f5e2c3] px-4 py-3 text-[#12343b]">
                      <p className="text-xs uppercase tracking-[0.22em] text-[#7d5b2a]">
                        From
                      </p>
                      <p className="mt-1 text-2xl font-semibold">
                        {getFromPrice(pkg).toLocaleString()} {pkg.currency}
                      </p>
                    </div>

                    {pkg.cancellationPolicy && (
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-4 py-2 text-sm text-[#efe3d0]">
                        <ShieldCheck className="h-4 w-4 text-[#f2dfbf]" />
                        {pkg.cancellationPolicy}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {packages.length === 0 && (
        <div className="rounded-[2rem] border border-[#ddc8b0] bg-white/70 px-6 py-16 text-center shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
            No matching routes
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">
            {regionFilter
              ? `Nothing is published in ${regionFilter} yet`
              : "No packages are published yet"}
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Try a different region or clear the current search.
          </p>
          <Link
            href="/packages"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#12343b] px-5 py-3 text-sm font-semibold text-[#f6ead6]"
          >
            Reset filters
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
