import { CheckCircle2, Mail, Search } from "lucide-react";
import { homeHeroScene } from "../client-visuals";
import {
  ContentCard,
  HeroBand,
  PortalButton,
  PortalShell,
} from "../_ui";

/**
 * Post-submit confirmation screen. Reached after the booking wizard
 * posts a lead. The wizard itself is untouched.
 */
export default async function BookingConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  const steps = [
    {
      icon: CheckCircle2,
      iconClass: "text-emerald-600",
      title: "Step 1 · Request logged",
      text: "Your booking is now in the same operations pipeline the admin team uses for leads and scheduling.",
    },
    {
      icon: Mail,
      iconClass: "text-[var(--portal-ink)]",
      title: "Step 2 · Watch your inbox",
      text: "We'll confirm availability and send the next update to your email once the team reviews the request.",
    },
    {
      icon: Search,
      iconClass: "text-[var(--portal-ink)]",
      title: "Step 3 · Track the status",
      text: "Use your email or reference in the client area to see when the request becomes a confirmed tour.",
    },
  ];

  return (
    <PortalShell spacing="tight">
      <HeroBand
        imageUrl={homeHeroScene.imageUrl}
        imageAlt="Booking request received"
        variant="full"
      >
        <HeroBand.Eyebrow>Request received</HeroBand.Eyebrow>
        <HeroBand.Title>Your route request is in</HeroBand.Title>
        <HeroBand.Summary>
          Our team will review the trip setup, confirm availability, and
          follow up with the next step from the admin side.
        </HeroBand.Summary>
        <HeroBand.Actions>
          <PortalButton
            href="/my-bookings"
            variant="on-dark"
            size="lg"
            withArrow
          >
            View my bookings
          </PortalButton>
          <PortalButton
            href="/packages"
            variant="secondary"
            size="lg"
            className="border-white/25 bg-white/10 text-white hover:bg-white/18"
          >
            Browse more packages
          </PortalButton>
        </HeroBand.Actions>
        {ref ? (
          <div className="mt-8 inline-flex flex-col rounded-[var(--portal-radius-md)] border border-white/14 bg-white/10 px-5 py-4 backdrop-blur-sm">
            <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-gold)]">
              Booking reference
            </span>
            <span className="portal-display mt-2 font-mono text-2xl font-semibold text-white">
              {ref}
            </span>
          </div>
        ) : null}
      </HeroBand>

      <section className="grid gap-4 lg:grid-cols-3">
        {steps.map(({ icon: Icon, iconClass, title, text }) => (
          <ContentCard key={title} variant="paper">
            <Icon className={`h-6 w-6 ${iconClass}`} />
            <h2 className="portal-display mt-4 text-lg font-semibold tracking-tight text-stone-900">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">{text}</p>
          </ContentCard>
        ))}
      </section>
    </PortalShell>
  );
}
