import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ShieldCheck, X } from "lucide-react";
import { getPackage } from "@/lib/db";
import { getFromPrice } from "@/lib/package-price";
import { getClientPackageVisual } from "../../client-visuals";
import {
  ContentCard,
  HeroBand,
  PillRow,
  PortalButton,
  PortalShell,
  SectionHeader,
  StatRow,
  type StatItem,
} from "../../_ui";

/**
 * Package detail.
 *
 * Design notes:
 *   - HeroBand holds the title + cinematic imagery; the aside
 *     carries a StatRow (duration / region / rating) and the chip
 *     badges instead of a nested teal "Route Snapshot" card
 *   - Body is a two-column layout: day-by-day itinerary on the left,
 *     Included / Exclusions / pricing on the right
 *   - Sticky bottom rail keeps "From X / traveller" and the Book CTA
 *     in view; both Book links still point to /packages/[id]/book —
 *     the booking wizard is untouched by this redesign
 *
 * Booking flow is deliberately out of scope for this surface; every
 * CTA on this page routes into the existing /book wizard without
 * modification.
 */
export default async function PackageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pkg = await getPackage(id);

  if (!pkg || pkg.published === false) {
    return (
      <PortalShell spacing="tight">
        <ContentCard
          variant="paper"
          className="flex flex-col items-center gap-4 py-16 text-center"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-eyebrow)]">
            Not found
          </p>
          <h1 className="portal-display text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            This package isn&apos;t published
          </h1>
          <p className="max-w-md text-sm leading-6 text-stone-600">
            It may have been renamed, archived, or moved. Browse the full
            package list to find a similar route.
          </p>
          <PortalButton href="/packages" variant="primary" size="lg" withArrow>
            Back to packages
          </PortalButton>
        </ContentCard>
      </PortalShell>
    );
  }

  const visual = getClientPackageVisual(pkg);
  const rating = pkg.rating ?? 0;

  const heroStats: StatItem[] = [
    { label: "Duration", value: pkg.duration },
    { label: "Region", value: pkg.region ?? pkg.destination },
    {
      label: "Rating",
      value: rating > 0 ? rating.toFixed(1) : "—",
      hint:
        rating > 0 && pkg.reviewCount != null
          ? `${pkg.reviewCount} reviews`
          : undefined,
    },
  ];

  const fromPrice = getFromPrice(pkg).toLocaleString();
  const bookHref = `/packages/${pkg.id}/book`;

  return (
    <PortalShell spacing="tight" className="pb-32">
      <Link
        href="/packages"
        className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 transition hover:text-[var(--portal-ink)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to packages
      </Link>

      <HeroBand
        imageUrl={visual.imageUrl}
        imageAlt={pkg.name}
        asideChildren={
          <>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-gold)]">
              Route snapshot
            </p>
            <StatRow tone="dark" stats={heroStats} />
            <PillRow items={visual.chips} tone="dark" size="sm" />
            {pkg.cancellationPolicy ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-4 py-2 text-sm text-[var(--portal-sand-warm)] backdrop-blur-sm">
                <ShieldCheck className="h-4 w-4 text-[var(--portal-highlight)]" />
                {pkg.cancellationPolicy}
              </div>
            ) : null}
          </>
        }
      >
        <HeroBand.Eyebrow>{visual.eyebrow}</HeroBand.Eyebrow>
        <HeroBand.Title>{pkg.name}</HeroBand.Title>
        <HeroBand.Summary>{pkg.description}</HeroBand.Summary>
        <HeroBand.Actions>
          <PortalButton href={bookHref} variant="on-dark" size="lg" withArrow>
            Book this route
          </PortalButton>
          <span className="inline-flex items-center gap-2 text-sm text-[var(--portal-sand-warm)]">
            From{" "}
            <span className="portal-display text-lg font-semibold text-white">
              {fromPrice}
            </span>{" "}
            {pkg.currency} · per traveller
          </span>
        </HeroBand.Actions>
      </HeroBand>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Itinerary */}
        <ContentCard variant="paper">
          <SectionHeader
            eyebrow="Trip overview"
            title="Day-by-day route"
            align="stack"
          />
          <ol className="mt-8 space-y-5">
            {pkg.itinerary.map((day, i) => {
              const isLast = i === pkg.itinerary.length - 1;
              return (
                <li key={day.day} className="relative pl-14">
                  {!isLast ? (
                    <span className="absolute left-5 top-10 h-full w-px bg-[var(--portal-border)]" />
                  ) : null}
                  <span className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--portal-ink)] text-sm font-semibold text-[var(--portal-cream)] shadow-[var(--portal-shadow-sm)]">
                    {day.day}
                  </span>
                  <div className="rounded-[var(--portal-radius-md)] border border-[var(--portal-border)]/60 bg-white/75 p-5">
                    <h3 className="portal-display text-lg font-semibold tracking-tight text-stone-900">
                      {day.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-stone-600">
                      {day.description}
                    </p>
                    {day.accommodation ? (
                      <p className="mt-3 text-sm font-medium text-[var(--portal-ink)]">
                        Stay · {day.accommodation}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </ContentCard>

        <aside className="space-y-6">
          <ContentCard variant="paper">
            <SectionHeader
              eyebrow="Included"
              title="What's in the route"
              align="stack"
            />
            <ul className="mt-5 space-y-2.5">
              {pkg.inclusions.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm leading-6 text-stone-700"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </ContentCard>

          <ContentCard variant="paper">
            <SectionHeader
              eyebrow="Exclusions"
              title="Plan separately"
              align="stack"
            />
            <ul className="mt-5 space-y-2.5">
              {pkg.exclusions.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm leading-6 text-stone-600"
                >
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </ContentCard>

          <ContentCard variant="ink" className="text-[var(--portal-cream)]">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-gold)]">
              From
            </p>
            <p className="portal-display mt-2 text-3xl font-semibold text-white">
              {fromPrice}{" "}
              <span className="text-lg font-medium text-[var(--portal-sand-warm)]">
                {pkg.currency}
              </span>
            </p>
            <p className="mt-1 text-sm text-[var(--portal-sand-warm)]">
              per traveller · before meal plan upgrades
            </p>
            <PortalButton
              href={bookHref}
              variant="on-dark"
              size="lg"
              withArrow
              className="mt-5 w-full"
            >
              Book this route
            </PortalButton>
          </ContentCard>
        </aside>
      </section>

      {/* Sticky mobile-first booking rail */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--portal-border)] bg-[var(--portal-paper-strong)]/95 shadow-[0_-18px_48px_-32px_rgba(43,32,15,0.6)] backdrop-blur-xl print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-eyebrow)]">
              Starting from
            </p>
            <p className="portal-display mt-1 text-xl font-semibold text-[var(--portal-ink)]">
              {fromPrice} {pkg.currency}
              <span className="ml-1 text-sm font-medium text-stone-500">
                / traveller
              </span>
            </p>
          </div>
          <Link
            href={bookHref}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--portal-ink)] px-6 py-3 text-sm font-semibold text-[var(--portal-cream)] shadow-[0_14px_34px_-18px_rgba(18,52,59,0.95)] transition hover:bg-[var(--portal-ink-soft)]"
          >
            Book this route
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </PortalShell>
  );
}
