import { Suspense } from "react";
import { BadgeCheck, Headphones, ShieldCheck } from "lucide-react";
import { ClientLookupForm } from "./ClientLookupForm";
import { ThingsToDoSlideshow } from "./ThingsToDoSlideshow";
import {
  clientPortalStats,
  destinationHighlights,
  getClientPackageVisual,
  homeHeroScene,
} from "./client-visuals";
import { getAppSettings, getDisplayCompanyName } from "@/lib/app-config";
import { getPackagesForClient } from "@/lib/db";
import { getFromPrice } from "@/lib/package-price";
import {
  ContentCard,
  DestinationsShowcase,
  HeroBand,
  PortalButton,
  PortalShell,
  SectionHeader,
  StatRow,
  StoryCard,
  StoryCardPriceFooter,
} from "./_ui";

/**
 * Client portal homepage.
 *
 * Editorial direction:
 *   - One cinematic hero (HeroBand) carrying eyebrow, serif title,
 *     summary, two CTAs, chips, and a 3-up StatRow in the aside.
 *   - Three editorial prose columns for the service pillars (no
 *     card-inside-card stacking).
 *   - DestinationsShowcase cross-fade replaces the tile grid +
 *     the old "Route Notes" card (which duplicated the hero CTA).
 *   - Featured packages use StoryCard. The first card claims
 *     lg:col-span-2 so it reads as the hero story.
 *   - Track-booking lives inside a paper ContentCard; the form
 *     itself is unchanged (see ClientLookupForm.tsx).
 */

const SERVICE_PILLARS = [
  {
    icon: Headphones,
    title: "Local planning support",
    text: "Real itinerary help before and after booking, not just a checkout page.",
  },
  {
    icon: ShieldCheck,
    title: "Flexible booking path",
    text: "Compare package styles, keep your booking visible, and adjust the plan with context.",
  },
  {
    icon: BadgeCheck,
    title: "Curated Sri Lanka routing",
    text: "Trips shaped around transfer times, scenic legs, and how the island actually moves.",
  },
];

export default async function ClientPortalPage() {
  const settings = await getAppSettings();
  const allPackages = await getPackagesForClient();
  const featuredPackages = allPackages
    .filter((pkg) => pkg.featured)
    .slice(0, 5);
  const brandName = getDisplayCompanyName(settings);

  return (
    <PortalShell>
      {/* ───── Hero ─────────────────────────────────────────────────── */}
      <HeroBand
        imageUrl={homeHeroScene.imageUrl}
        imageAlt="Sri Lanka travel panorama"
        asideChildren={
          <>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-gold)]">
              At a glance
            </p>
            <StatRow
              tone="dark"
              stats={clientPortalStats.map((s) => ({
                label: s.label,
                value: s.value,
              }))}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {homeHeroScene.chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-white/18 bg-white/10 px-3 py-1 text-xs font-medium text-[var(--portal-sand-warm)] backdrop-blur-sm"
                >
                  {chip}
                </span>
              ))}
            </div>
          </>
        }
      >
        <HeroBand.Eyebrow>Curated island journeys</HeroBand.Eyebrow>
        <HeroBand.Title>{homeHeroScene.title}</HeroBand.Title>
        <HeroBand.Summary>{homeHeroScene.summary}</HeroBand.Summary>
        <HeroBand.Actions>
          <PortalButton
            href="/journey-builder"
            variant="on-dark"
            size="lg"
            withArrow
          >
            {settings.portal.journeyBuilderLabel}
          </PortalButton>
          <PortalButton
            href="/packages"
            variant="secondary"
            size="lg"
            className="border-white/25 bg-white/10 text-white hover:bg-white/18"
            withArrow
          >
            {settings.portal.packagesLabel}
          </PortalButton>
        </HeroBand.Actions>
      </HeroBand>

      {/* ───── Service pillars (editorial prose columns) ────────────── */}
      <section className="grid gap-10 sm:grid-cols-3">
        {SERVICE_PILLARS.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="border-l border-[var(--portal-gold)]/60 pl-5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--portal-ink)] text-[var(--portal-cream)]">
              <Icon className="h-4 w-4" />
            </div>
            <h3 className="portal-display mt-4 text-lg font-semibold tracking-tight text-stone-900">
              {title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-stone-600">{text}</p>
          </div>
        ))}
      </section>

      {/* ───── Destinations — cross-fade slideshow ──────────────────── */}
      <DestinationsShowcase
        scenes={destinationHighlights}
        eyebrow="Where you'll go"
        title="Six regions, one smooth route"
        deepLinkTemplate="See routes in {region}"
      />

      {/* ───── Featured packages ────────────────────────────────────── */}
      {featuredPackages.length > 0 && (
        <section className="space-y-8">
          <SectionHeader
            eyebrow="Featured journeys"
            title="Popular ways to see the island"
            action={{
              label: "View every package",
              href: "/packages",
            }}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            {featuredPackages.map((pkg, index) => {
              const visual = getClientPackageVisual(pkg);
              return (
                <div
                  key={pkg.id}
                  className={index === 0 ? "lg:col-span-2" : ""}
                >
                  <StoryCard
                    href={`/packages/${pkg.id}`}
                    imageUrl={visual.imageUrl}
                    imageAlt={pkg.name}
                    imageAspect={index === 0 ? "16/10" : "4/3"}
                    eyebrow={`${pkg.region ?? pkg.destination} · ${pkg.duration}`}
                    title={pkg.name}
                    body={visual.highlight}
                    chips={visual.chips}
                    tone="white"
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
                        action="View journey"
                      />
                    }
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ───── Things to do (kept — separate content set) ───────────── */}
      <ThingsToDoSlideshow />

      {/* ───── Track your booking ───────────────────────────────────── */}
      <section
        id="track-booking"
        className="grid gap-6 scroll-mt-28 lg:grid-cols-[0.95fr_1.05fr]"
      >
        <div className="flex flex-col justify-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-eyebrow)]">
            Booking visibility
          </p>
          <h2 className="portal-display mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            Track your booking with {brandName}
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-stone-600">
            Use your reference or email to reopen your request, review dates,
            and follow the package details after your first enquiry. We keep
            one live thread so you never lose context between messages.
          </p>
        </div>
        <ContentCard variant="paper" padded={false} className="overflow-hidden">
          <div className="p-6 sm:p-8">
            <Suspense
              fallback={
                <div className="h-48 animate-pulse rounded-[var(--portal-radius-md)] bg-white/70" />
              }
            >
              <ClientLookupForm />
            </Suspense>
          </div>
        </ContentCard>
      </section>
    </PortalShell>
  );
}
