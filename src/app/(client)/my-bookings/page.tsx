import { Suspense } from "react";
import { MyBookingsClient } from "./MyBookingsClient";
import { homeHeroScene } from "../client-visuals";
import {
  ContentCard,
  HeroBand,
  PortalShell,
  SectionHeader,
} from "../_ui";

/**
 * My Bookings index — lookup by email, then render active requests +
 * confirmed tours. Logic all lives in MyBookingsClient.
 */
export default function MyBookingsPage() {
  return (
    <PortalShell spacing="tight">
      <HeroBand
        imageUrl={homeHeroScene.imageUrl}
        imageAlt="Booking archive"
        variant="full"
      >
        <HeroBand.Eyebrow>Booking archive</HeroBand.Eyebrow>
        <HeroBand.Title>My bookings</HeroBand.Title>
        <HeroBand.Summary>
          Use your email to see active requests, confirmed tours, and
          anything you&apos;ve already submitted through the portal. One
          thread, one place.
        </HeroBand.Summary>
      </HeroBand>

      <section className="space-y-6">
        <SectionHeader
          eyebrow="Look up"
          title="Find your bookings"
          description="Enter the email you used when requesting the tour — we'll pull any open request or confirmed itinerary on that address."
          align="stack"
        />
        <ContentCard variant="paper" padded={false}>
          <div className="p-6 sm:p-8">
            <Suspense
              fallback={
                <div className="h-24 animate-pulse rounded-[var(--portal-radius-md)] bg-white/70" />
              }
            >
              <MyBookingsClient />
            </Suspense>
          </div>
        </ContentCard>
      </section>
    </PortalShell>
  );
}
