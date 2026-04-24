import type { ReactNode } from "react";

/**
 * PillRow — pill / chip list with three tonal variants.
 *
 *   "light"   : warm cream border + stone ink (on cream page backgrounds)
 *   "dark"    : translucent white on dark backgrounds (hero, ink cards)
 *   "accent"  : solid ink background, cream text (for emphasis counts)
 *
 * Replaces the seven copy-pasted chip-list patterns in the old portal.
 */
export function PillRow({
  items,
  tone = "light",
  size = "md",
  className = "",
}: {
  items: ReactNode[];
  tone?: "light" | "dark" | "accent";
  size?: "sm" | "md";
  className?: string;
}) {
  const padding = size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs";
  const toneClasses =
    tone === "dark"
      ? "border border-white/15 bg-white/10 text-[var(--portal-sand-warm)] backdrop-blur-sm"
      : tone === "accent"
        ? "border border-transparent bg-[var(--portal-ink)] text-[var(--portal-cream)]"
        : "border border-[var(--portal-border)] bg-white/70 text-stone-600";

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`.trim()}>
      {items.map((item, i) => (
        <span
          key={i}
          className={`rounded-full ${toneClasses} ${padding} font-medium`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}
