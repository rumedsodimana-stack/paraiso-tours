import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

/**
 * SectionHeader — the canonical "eyebrow + editorial title + optional CTA"
 * pattern repeated across every section of the client portal.
 *
 * The previous portal reinvented this seven times with slightly different
 * colours and weights. Now it lives here.
 */
export function SectionHeader({
  eyebrow,
  title,
  action,
  description,
  align = "row",
}: {
  eyebrow?: string;
  title: ReactNode;
  /** Optional right-aligned CTA link (shown on sm+ inline with the title). */
  action?: { label: string; href: string };
  /** Optional paragraph under the title. */
  description?: ReactNode;
  /** "row" places title & action side-by-side, "stack" forces a vertical layout. */
  align?: "row" | "stack";
}) {
  const stack = align === "stack";
  return (
    <header
      className={
        stack
          ? "space-y-3"
          : "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      }
    >
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-eyebrow)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="portal-display mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--portal-ink)] transition hover:gap-3"
        >
          {action.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </header>
  );
}
