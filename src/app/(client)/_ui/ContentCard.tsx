import type { ReactNode } from "react";

/**
 * ContentCard — the canonical card surface for the client portal.
 *
 * One card treatment, period. If a surface needs imagery, use
 * `StoryCard` instead (it takes the image as a first-class prop).
 * For hero bands, use `HeroBand`.
 *
 * Variants:
 *   - "paper"  : cream surface, warm border (default — used on cream bg)
 *   - "white"  : white surface, same warm border (used for featured/packages)
 *   - "ink"    : dark teal surface, light type (footer CTA, feature bands)
 *   - "ghost"  : transparent, border only (for light UI tiles)
 */
export function ContentCard({
  children,
  className = "",
  variant = "paper",
  as: Component = "div",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  variant?: "paper" | "white" | "ink" | "ghost";
  as?: "div" | "article" | "section" | "aside";
  padded?: boolean;
}) {
  const base =
    "rounded-[var(--portal-radius-lg)] border shadow-[var(--portal-shadow-md)] transition";
  const pad = padded ? "p-6 sm:p-7" : "";
  const tone =
    variant === "white"
      ? "border-[var(--portal-border)]/60 bg-white/80"
      : variant === "ink"
        ? "border-white/10 bg-[var(--portal-ink)] text-[var(--portal-sand-warm)]"
        : variant === "ghost"
          ? "border-[var(--portal-border)]/60 bg-transparent shadow-none"
          : "border-[var(--portal-border)]/60 bg-[var(--portal-paper)]";

  return (
    <Component className={`${base} ${tone} ${pad} ${className}`.trim()}>
      {children}
    </Component>
  );
}
