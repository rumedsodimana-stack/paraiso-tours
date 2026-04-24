import type { ReactNode } from "react";

/**
 * PortalShell — the standard page wrapper for client-portal surfaces.
 *
 * Applies the canonical max-width, horizontal gutter, and the
 * large vertical spacing between sections. Put every client-portal
 * page's body inside a <PortalShell> so they all share the same
 * rhythm.
 */
export function PortalShell({
  children,
  className = "",
  spacing = "normal",
}: {
  children: ReactNode;
  className?: string;
  /** "tight" = 12 units between sections, "normal" = 20, "loose" = 28 */
  spacing?: "tight" | "normal" | "loose";
}) {
  const gap =
    spacing === "tight"
      ? "space-y-12"
      : spacing === "loose"
        ? "space-y-28"
        : "space-y-20";
  return (
    <div className={`${gap} ${className}`.trim()}>{children}</div>
  );
}
