"use client";

import * as React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

/**
 * Sticky price bar shared between booking wizard and journey-builder.
 *
 * Behavior:
 *   - Fixed to the viewport bottom (`fixed inset-x-0 bottom-0`) so it
 *     survives internal wizard scroll without reflow.
 *   - Shows a live formatted total + an optional trip summary pill.
 *   - On mobile a chevron expands a breakdown sheet above the bar
 *     (line items); on larger screens the breakdown can inline beside
 *     the total if caller wants — they pass `breakdown` and choose.
 *   - `actions` slot renders navigation buttons (Back / Next /
 *     Submit). Callers own validation + disabled state.
 *
 * Safe-area padding (`env(safe-area-inset-bottom)`) keeps the bar
 * clear of iOS home indicators.
 */
export type WizardPriceBarBreakdownItem = {
  id: string;
  label: string;
  amount: string;
  muted?: boolean;
};

export function WizardPriceBar({
  label = "Total",
  totalLabel,
  summary,
  breakdown,
  actions,
}: {
  /** Short label rendered above the total (defaults to "Total"). */
  label?: string;
  /** Formatted total string, e.g. "$2,450". */
  totalLabel: string;
  /** Optional one-liner summary (e.g. "7 nights · 2 guests"). */
  summary?: React.ReactNode;
  /**
   * Optional line items to show when the chevron is expanded. Pass
   * undefined to hide the expander entirely (common for flows that
   * don't surface a per-line breakdown).
   */
  breakdown?: WizardPriceBarBreakdownItem[];
  /** Back / Next / Submit controls rendered on the right. */
  actions: React.ReactNode;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const hasBreakdown = Array.isArray(breakdown) && breakdown.length > 0;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--portal-border)] bg-[var(--portal-paper-strong)]/95 backdrop-blur-xl print:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {hasBreakdown && expanded ? (
        <div className="mx-auto max-w-7xl border-b border-[var(--portal-border)]/60 px-4 py-3 sm:px-6">
          <dl className="grid gap-1.5 text-sm text-stone-600 sm:grid-cols-2 sm:gap-x-6">
            {breakdown!.map((item) => (
              <div
                key={item.id}
                className={`flex items-baseline justify-between gap-3 ${
                  item.muted ? "text-stone-500" : ""
                }`}
              >
                <dt className="truncate">{item.label}</dt>
                <dd className="font-medium text-stone-900">{item.amount}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {hasBreakdown ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-label={expanded ? "Hide price breakdown" : "Show price breakdown"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--portal-border)] bg-white/80 text-[var(--portal-ink)] transition hover:bg-[var(--portal-paper)]"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </button>
          ) : null}
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--portal-eyebrow)]">
              {label}
            </p>
            <p className="portal-display truncate text-lg font-semibold tracking-tight text-[var(--portal-ink)] sm:text-xl">
              {totalLabel}
            </p>
            {summary ? (
              <p className="hidden truncate text-xs text-stone-600 sm:block">
                {summary}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>
    </div>
  );
}
