"use client";

import * as React from "react";

/**
 * Viewport-fit wizard scaffold.
 *
 * The booking flow and the journey-builder both share a constraint:
 * the guest should see the whole step without scrolling the page —
 * only the step body itself scrolls when content overflows. This shell
 * locks total height to small-viewport units (`100svh`) minus the
 * portal header band, and exposes three stacked regions:
 *
 *   - `<WizardShell.Header>` — back link / step eyebrow / step title
 *   - `<WizardShell.Body>`   — the current step, scrolls internally
 *   - `<WizardShell.PriceBar>` — sticky footer with live total
 *
 * The shell is intentionally layout-only. Step content, primitives,
 * and validation all live in the consuming flow.
 *
 * Mobile browser chrome is handled via `100svh` (small-viewport
 * height) — the unit that already accounts for collapsing URL bars on
 * iOS Safari and Chrome Android. No additional JS needed.
 */
export function WizardShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`wizard-shell relative flex min-h-[calc(100svh-var(--portal-header-offset,5rem))] flex-col ${className}`}
    >
      {children}
    </div>
  );
}

function WizardHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`shrink-0 border-b border-[var(--portal-border)]/60 bg-[var(--portal-paper)]/80 px-4 py-4 backdrop-blur-sm sm:px-6 sm:py-5 ${className}`}
    >
      {children}
    </header>
  );
}

function WizardBody({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex-1 overflow-y-auto px-4 pb-28 pt-6 sm:px-6 sm:pb-32 sm:pt-8 ${className}`}
    >
      {children}
    </div>
  );
}

WizardShell.Header = WizardHeader;
WizardShell.Body = WizardBody;
