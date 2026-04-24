import Link from "next/link";
import { Suspense } from "react";
import { Star } from "lucide-react";
import { PackageFilters } from "./PackageFilters";
import {
  getClientPackageVisual,
  homeHeroScene,
} from "../client-visuals";
import { getAppSettings } from "@/lib/app-config";
import { getPackagesForClient } from "@/lib/db";
import { getFromPrice } from "@/lib/package-price";
import {
  ContentCard,
  HeroBand,
  PortalButton,
  PortalShell,
  SectionHeader,
  StoryCard,
  StoryCardPriceFooter,
} from "../_ui";

/**
 * Packages index.
 *
 * Layout:
 *   - HeroBand as chapter cover (title + summary, no CTA duplication)
 *   - Filter toolbar on a paper ContentCard: search + sort on one row,
 *     region pills on the next — lives outside the hero so it's
 *     glanceable while scrolling
 *   - StoryCard grid (2-up) for each package; featured gets a tonal
 *     "Featured" badge overlay
 *   - Empty state is a ContentCard with a single reset action
 */

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

  const resultCountLabel =
    packages.length === 1 ? "1 route" : `${packages.length} routes`;

  return (
    <PortalShell spacing="tight">
      <HeroBand
        imageUrl={homeHeroScene.imageUrl}
        imageAlt="Sri Lanka route planning"
        variant="full"
      >
        <HeroBand.Eyebrow>Package browser</HeroBand.Eyebrow>
        <HeroBand.Title>
          Find the Sri Lanka route that matches your pace
        </HeroBand.Title>
        <HeroBand.Summary>
          Filter by region, compare package styles, then drill into the route
          details before booking. Every package is priced as a complete
          island-pace journey — transport, stays, and meal plan included.
        </HeroBand.Summary>
        <HeroBand.Actions>
          <PortalButton
            href="/journey-builder"
            variant="on-dark"
            size="lg"
            withArrow
          >
            {settings.portal.journeyBuilderLabel}
          </PortalButton>
        </HeroBand.Actions>
      </HeroBand>

      {/* Filter toolbar */}
      <ContentCard variant="paper" padded={false}>
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <Suspense
            fallback={
              <div className="h-12 animate-pulse rounded-full bg-white/70" />
            }
          >
            <PackageFilters
              regionFilter={regionFilter}
              initialQ={(params.q as string) || ""}
              initialSort={sortBy}
            />
          </Suspense>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-eyebrow)]">
              Region
            </span>
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
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-[var(--portal-ink)] text-[var(--portal-cream)]"
                      : "border border-[var(--portal-border)] bg-white/70 text-stone-600 hover:border-[var(--portal-ink)] hover:text-[var(--portal-ink)]"
                  }`}
                >
                  {region}
                </Link>
              );
            })}
          </div>
        </div>
      </ContentCard>

      {/* Results */}
      {packages.length > 0 ? (
        <section className="space-y-6">
          <SectionHeader
            eyebrow="Results"
            title={
              regionFilter
                ? `${resultCountLabel} in ${regionFilter}`
                : `${resultCountLabel} to explore`
            }
          />
          <div className="grid gap-6 lg:grid-cols-2">
            {packages.map((pkg) => {
              const visual = getClientPackageVisual(pkg);
              const rating = pkg.rating ?? 0;

              return (
                <StoryCard
                  key={pkg.id}
                  href={`/packages/${pkg.id}`}
                  imageUrl={visual.imageUrl}
                  imageAlt={pkg.name}
                  imageAspect="3/2"
                  tone="white"
                  badge={
                    pkg.featured ? (
                      <span className="rounded-full bg-[var(--portal-highlight)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-ink)] shadow-[var(--portal-shadow-sm)]">
                        Featured
                      </span>
                    ) : null
                  }
                  eyebrow={`${pkg.region ?? pkg.destination} · ${pkg.duration}`}
                  title={pkg.name}
                  body={
                    <>
                      <p className="line-clamp-3">
                        {pkg.description ?? visual.highlight}
                      </p>
                      {rating > 0 ? (
                        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--portal-gold-deep)]">
                          <Star className="h-3.5 w-3.5 fill-current" />
                          {rating.toFixed(1)} rated
                        </p>
                      ) : null}
                    </>
                  }
                  chips={visual.chips}
                  footer={
                    <StoryCardPriceFooter
                      price={
                        <>
                          From{" "}
                          <span className="portal-display">
                            {getFromPrice(pkg).toLocaleString()}
                          </span>{" "}
                          {pkg.currency}
                        </>
                      }
                      action="See route"
                    />
                  }
                />
              );
            })}
          </div>
        </section>
      ) : (
        <ContentCard
          variant="paper"
          className="flex flex-col items-center gap-4 py-16 text-center"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-eyebrow)]">
            No matching routes
          </p>
          <h2 className="portal-display text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            {regionFilter
              ? `Nothing is published in ${regionFilter} yet`
              : "No packages are published yet"}
          </h2>
          <p className="max-w-md text-sm leading-6 text-stone-600">
            Try a different region or clear the current search. New island
            circuits are added as routes get field-tested.
          </p>
          <PortalButton href="/packages" variant="primary" size="lg" withArrow>
            Reset filters
          </PortalButton>
        </ContentCard>
      )}
    </PortalShell>
  );
}
