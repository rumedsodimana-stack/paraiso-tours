import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

/**
 * StoryCard — imagery-led card for the portal's editorial surfaces
 * (destination highlights, featured packages, journal entries).
 *
 * All optional content is structured:
 *   eyebrow    → uppercase 0.28em tracking (region/place label)
 *   title      → editorial serif (portal-display)
 *   body       → 1-2 lines of body type
 *   chips      → optional pill list
 *   footer     → slot for price/CTA/etc.
 *
 * If `href` is passed, the whole card becomes a link and gets a
 * hover lift + subtle image scale. The onClick variant (via `as`) is
 * used by slideshow thumbnails where clicking advances state instead
 * of navigating.
 */
export function StoryCard({
  href,
  imageUrl,
  imageAlt,
  imageAspect = "16/10",
  eyebrow,
  title,
  body,
  chips,
  footer,
  badge,
  tone = "paper",
}: {
  href?: string;
  imageUrl: string;
  imageAlt?: string;
  /**
   * Image aspect ratio. The named ratio describes the intent; the rendered
   * aspect is 15% shorter in height than the nominal ratio so banners sit
   * closer to a cinematic 1.85:1 feel across the portal.
   *   "16/10" → rendered 32:17   (hero / editorial banner)
   *   "4/3"   → rendered 80:51   (portrait-leaning card)
   *   "3/2"   → rendered 30:17   (standard listing thumbnail)
   *   "1/1"   → rendered 20:17   (square-ish slideshow thumb)
   */
  imageAspect?: "16/10" | "4/3" | "3/2" | "1/1";
  eyebrow?: string;
  title: ReactNode;
  body?: ReactNode;
  chips?: string[];
  /** Slot below body — usually a price + chevron or a "See routes" link. */
  footer?: ReactNode;
  /** Optional overlay badge on the image (top-left). */
  badge?: ReactNode;
  tone?: "paper" | "white";
}) {
  // All aspects rendered 15% shorter than their nominal ratio — keeps
  // banners editorial-wide across the portal without each caller
  // inventing a custom aspect.
  const aspectClass =
    imageAspect === "4/3"
      ? "aspect-[80/51]"
      : imageAspect === "3/2"
        ? "aspect-[30/17]"
        : imageAspect === "1/1"
          ? "aspect-[20/17]"
          : "aspect-[32/17]";

  const surface =
    tone === "white"
      ? "bg-white/85 border-[var(--portal-border)]/60"
      : "bg-[var(--portal-paper)] border-[var(--portal-border)]/60";

  const card = (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-[var(--portal-radius-lg)] border ${surface} shadow-[var(--portal-shadow-md)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[var(--portal-shadow-lg)]`}
    >
      <div className={`relative w-full overflow-hidden ${aspectClass}`}>
        <Image
          src={imageUrl}
          alt={imageAlt ?? ""}
          fill
          sizes="(min-width: 1024px) 33vw, 100vw"
          className="object-cover transition duration-700 group-hover:scale-[1.04]"
        />
        {badge ? (
          <div className="absolute left-4 top-4">{badge}</div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div>
          {eyebrow ? (
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-eyebrow)]">
              {eyebrow}
            </p>
          ) : null}
          <h3 className="portal-display mt-2 text-xl font-semibold leading-snug text-stone-900 sm:text-[1.4rem]">
            {title}
          </h3>
        </div>
        {body ? (
          <div className="text-sm leading-6 text-stone-600">{body}</div>
        ) : null}
        {chips && chips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c}
                className="rounded-full border border-[var(--portal-border)] bg-white/70 px-2.5 py-1 text-[11px] font-medium text-stone-600"
              >
                {c}
              </span>
            ))}
          </div>
        ) : null}
        {footer ? (
          <div className="mt-auto border-t border-[var(--portal-border)]/50 pt-4">
            {footer}
          </div>
        ) : null}
      </div>
    </article>
  );

  if (!href) return card;

  return (
    <Link href={href} className="group block h-full">
      {card}
    </Link>
  );
}

/**
 * Small helper — the "price · view" footer pattern used by featured packages.
 */
export function StoryCardPriceFooter({
  price,
  action = "View",
}: {
  price: ReactNode;
  action?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-stone-900">{price}</span>
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--portal-ink)]">
        {action}
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </div>
  );
}
