"use client";

import * as React from "react";
import { Check } from "lucide-react";

/**
 * Compact step indicator used at the top of the booking wizard and
 * journey-builder. Renders a horizontal row of dot → label pairs
 * where the active step is filled, completed steps show a check, and
 * upcoming steps render muted. Labels collapse on small viewports so
 * the bar never wraps.
 *
 * The component is purely presentational — the parent flow owns
 * progression state, so caller can drive it from either a step-
 * exclusive wizard (booking) or an accordion (journey-builder).
 */
export type StepSelectorItem = {
  id: string | number;
  label: string;
  icon?: React.ElementType;
};

export function StepSelector({
  steps,
  currentIndex,
  onSelect,
}: {
  steps: StepSelectorItem[];
  currentIndex: number;
  /**
   * Optional click handler — when provided, completed steps become
   * clickable so guests can jump back. Active / upcoming steps are
   * never clickable regardless (caller still controls forward via
   * its Next button + validation).
   */
  onSelect?: (index: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      {steps.map((step, idx) => {
        const isActive = idx === currentIndex;
        const isDone = idx < currentIndex;
        const Icon = step.icon;
        const isClickable = isDone && typeof onSelect === "function";

        const dot = (
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition ${
              isActive
                ? "border-[var(--portal-ink)] bg-[var(--portal-ink)] text-[var(--portal-cream)]"
                : isDone
                  ? "border-[var(--portal-ink)]/70 bg-[var(--portal-ink)]/90 text-[var(--portal-cream)]"
                  : "border-[var(--portal-border)] bg-white text-stone-500"
            }`}
          >
            {isDone ? (
              <Check className="h-3.5 w-3.5" />
            ) : Icon ? (
              <Icon className="h-3.5 w-3.5" />
            ) : (
              idx + 1
            )}
          </span>
        );

        return (
          <li key={step.id} className="flex items-center gap-2">
            {isClickable ? (
              <button
                type="button"
                onClick={() => onSelect!(idx)}
                className="flex items-center gap-2 rounded-full transition hover:opacity-80"
              >
                {dot}
                <span className="hidden text-xs font-medium text-stone-700 sm:inline">
                  {step.label}
                </span>
              </button>
            ) : (
              <>
                {dot}
                <span
                  className={`hidden text-xs font-medium sm:inline ${
                    isActive
                      ? "text-[var(--portal-ink)]"
                      : isDone
                        ? "text-stone-700"
                        : "text-stone-400"
                  }`}
                >
                  {step.label}
                </span>
              </>
            )}
            {idx < steps.length - 1 ? (
              <span
                aria-hidden
                className={`mx-1 hidden h-px w-6 sm:block ${
                  isDone
                    ? "bg-[var(--portal-ink)]/50"
                    : "bg-[var(--portal-border)]"
                }`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
