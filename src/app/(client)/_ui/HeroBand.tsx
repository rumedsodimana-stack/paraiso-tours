import Image from "next/image";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

/**
 * HeroBand — full-bleed cinematic hero used on the homepage and the
 * top of major surfaces (packages index, journey builder intro).
 *
 * The image does the heavy lifting. The gradient is applied via CSS
 * and has been tuned to keep copy readable across both sunrise and
 * low-key imagery.
 *
 *   <HeroBand imageUrl={...}>
 *     <HeroBand.Eyebrow>Curated island journeys</HeroBand.Eyebrow>
 *     <HeroBand.Title>Sri Lanka, paced around …</HeroBand.Title>
 *     <HeroBand.Summary>Private circuits …</HeroBand.Summary>
 *     <HeroBand.Actions>…</HeroBand.Actions>
 *     <HeroBand.Aside>…</HeroBand.Aside>
 *   </HeroBand>
 */

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-highlight)] backdrop-blur-sm">
      <Sparkles className="h-3 w-3" />
      {children}
    </p>
  );
}

function Title({ children }: { children: ReactNode }) {
  return (
    <h1 className="portal-display mt-6 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]">
      {children}
    </h1>
  );
}

function Summary({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--portal-sand-warm)] sm:text-lg">
      {children}
    </p>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-8 flex flex-wrap items-center gap-3">{children}</div>;
}

function Aside({ children }: { children: ReactNode }) {
  return (
    <div className="grid content-start gap-3 lg:pl-6">{children}</div>
  );
}

export function HeroBand({
  imageUrl,
  imageAlt,
  children,
  asideChildren,
  /** "split" reserves a right column for an aside. "full" is content-only. */
  variant = "split",
}: {
  imageUrl: string;
  imageAlt?: string;
  children: ReactNode;
  asideChildren?: ReactNode;
  variant?: "split" | "full";
}) {
  return (
    <section className="relative overflow-hidden rounded-[var(--portal-radius-xl)] border border-[var(--portal-border)]/70 bg-[var(--portal-ink-dark)] text-white shadow-[var(--portal-shadow-hero)]">
      <Image
        src={imageUrl}
        alt={imageAlt ?? ""}
        fill
        priority
        sizes="(min-width: 1024px) 1280px, 100vw"
        className="object-cover opacity-75"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(110deg,rgba(11,33,38,0.92) 8%,rgba(11,33,38,0.55) 55%,rgba(11,33,38,0.15) 100%)",
        }}
      />
      <div
        className={`relative grid gap-10 px-6 py-12 sm:px-10 sm:py-16 lg:px-14 lg:py-20 ${
          variant === "split" && asideChildren
            ? "lg:grid-cols-[1.2fr_0.8fr]"
            : ""
        }`}
      >
        <div>{children}</div>
        {variant === "split" && asideChildren ? (
          <Aside>{asideChildren}</Aside>
        ) : null}
      </div>
    </section>
  );
}

HeroBand.Eyebrow = Eyebrow;
HeroBand.Title = Title;
HeroBand.Summary = Summary;
HeroBand.Actions = Actions;
HeroBand.Aside = Aside;
