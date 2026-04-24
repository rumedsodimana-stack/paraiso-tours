"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientScene } from "../client-visuals";

/**
 * DestinationsShowcase — cinematic cross-fade slideshow for the
 * "Where you'll go" section on the homepage and any surface that
 * wants to feature regions.
 *
 * Behaviour:
 *   - Large 16:10 primary image that auto-advances every 5.5s
 *   - 1.2s cross-fade + subtle ken-burns scale (1.04 → 1.0)
 *   - Pauses on hover / keyboard focus so readers can linger
 *   - Arrow buttons, dot pagination, and left/right arrow keys
 *   - Side panel on desktop (region details), stacked caption on mobile
 *
 * The component is self-contained — pass it a list of ClientScene and
 * it renders the whole band.
 */
export function DestinationsShowcase({
  scenes,
  eyebrow = "Regions",
  title = "Where you'll actually go",
  /** Optional deep-link label template, e.g. "See routes in {name}". */
  deepLinkTemplate = "See routes in {region}",
}: {
  scenes: ClientScene[];
  eyebrow?: string;
  title?: string;
  deepLinkTemplate?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | null>(null);
  const count = scenes.length;

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count]
  );

  useEffect(() => {
    if (paused || count < 2) return;
    timer.current = window.setTimeout(() => go(index + 1), 5500);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [index, paused, go, count]);

  if (count === 0) return null;
  const active = scenes[index];
  const regionName = active.searchTerm ?? active.title;
  const deepLinkLabel = deepLinkTemplate.replace("{region}", regionName);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={title}
      tabIndex={0}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
      className="outline-none"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-eyebrow)]">
            {eyebrow}
          </p>
          <h2 className="portal-display mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-stone-500">
            {index + 1} / {count} · {active.title}
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              aria-label="Previous region"
              onClick={() => go(index - 1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--portal-border)] bg-[var(--portal-paper)] text-stone-700 transition hover:border-[var(--portal-ink)] hover:text-[var(--portal-ink)]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next region"
              onClick={() => go(index + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--portal-border)] bg-[var(--portal-paper)] text-stone-700 transition hover:border-[var(--portal-ink)] hover:text-[var(--portal-ink)]"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mt-8 overflow-hidden rounded-[var(--portal-radius-xl)] border border-[var(--portal-border)]/70 bg-[var(--portal-paper)] shadow-[var(--portal-shadow-lg)]">
        <div className="grid lg:grid-cols-[1.45fr_1fr]">
          {/* Image stack — cross-fade between slides */}
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-stone-200 lg:aspect-auto lg:min-h-[560px]">
            {scenes.map((scene, i) => (
              <div
                key={scene.title}
                className={`absolute inset-0 transition-all duration-[1200ms] ease-out ${
                  i === index
                    ? "opacity-100 scale-100"
                    : "opacity-0 scale-[1.04]"
                }`}
                aria-hidden={i !== index}
              >
                <Image
                  src={scene.imageUrl}
                  alt={scene.title}
                  fill
                  sizes="(min-width: 1024px) 720px, 100vw"
                  priority={i === 0}
                  className="object-cover"
                />
              </div>
            ))}
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(11,33,38,0)_55%,rgba(11,33,38,0.55)_100%)]" />
            <div className="absolute bottom-5 left-5 right-5 flex flex-wrap gap-1.5 lg:hidden">
              {active.chips.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-white/20 bg-black/35 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-sm"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>

          {/* Text column */}
          <div className="flex flex-col justify-between gap-10 p-8 sm:p-10 lg:p-12">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-eyebrow)]">
                {active.location}
              </p>
              <h3 className="portal-display mt-3 text-3xl font-semibold leading-tight text-stone-900 sm:text-[2.4rem]">
                {active.title}
              </h3>
              <p className="mt-5 text-base leading-7 text-stone-600">
                {active.summary}
              </p>
              <div className="mt-6 hidden flex-wrap gap-2 lg:flex">
                {active.chips.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-[var(--portal-border)] bg-white/70 px-3 py-1 text-xs font-medium text-stone-600"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {scenes.map((scene, i) => (
                  <button
                    key={scene.title}
                    type="button"
                    aria-label={`Go to ${scene.title}`}
                    aria-current={i === index}
                    onClick={() => go(i)}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      i === index
                        ? "w-8 bg-[var(--portal-ink)]"
                        : "w-4 bg-stone-300 hover:bg-stone-500"
                    }`}
                  />
                ))}
              </div>
              <Link
                href={active.href}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--portal-ink)] transition hover:gap-3"
              >
                {deepLinkLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
