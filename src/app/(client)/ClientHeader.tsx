"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Compass, MapPin, Menu, Sparkles, X } from "lucide-react";

/**
 * Client portal header.
 *
 * Redesign notes:
 *   - Two-row layout kept: utility top bar (stone-950) + brand bar
 *   - Underline indicator on the active nav link (editorial discipline)
 *   - Primary CTA on desktop uses the `var(--portal-ink)` treatment
 *   - Mobile drawer uses the same paper surface as the rest of the
 *     portal so it doesn't feel like a different product
 */
export function ClientHeader({
  brandName,
  logoUrl,
  topBannerText,
  topBannerSubtext,
  locationBadgeText,
  mobileMenuDescription,
  packagesLabel,
  journeyBuilderLabel,
  myBookingsLabel,
  trackBookingLabel,
}: {
  brandName: string;
  logoUrl?: string;
  topBannerText: string;
  topBannerSubtext?: string;
  locationBadgeText?: string;
  mobileMenuDescription?: string;
  packagesLabel: string;
  journeyBuilderLabel: string;
  myBookingsLabel: string;
  trackBookingLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: "/packages", label: packagesLabel },
    { href: "/journey-builder", label: journeyBuilderLabel },
    { href: "/my-bookings", label: myBookingsLabel },
    { href: "/#track-booking", label: trackBookingLabel },
  ];

  const isActive = (href: string) => {
    if (href.startsWith("/#")) return false;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header className="sticky top-0 z-50">
      <div className="border-b border-white/15 bg-stone-950 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-stone-200/80 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            {topBannerText}
          </span>
          {topBannerSubtext ? (
            <span className="hidden text-stone-300/70 md:inline">
              {topBannerSubtext}
            </span>
          ) : null}
        </div>
      </div>

      <div className="border-b border-[var(--portal-border-soft)]/70 bg-[var(--portal-paper-strong)]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-3"
            onClick={() => setOpen(false)}
          >
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--portal-ink)] text-[var(--portal-cream)] shadow-[0_12px_32px_-18px_rgba(18,52,59,0.9)]">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={brandName}
                  fill
                  className="object-cover"
                  sizes="44px"
                />
              ) : (
                <Compass className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <span className="portal-display block truncate text-base font-semibold tracking-tight text-stone-900 sm:text-xl">
                {brandName}
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            {navLinks.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative text-sm font-medium transition ${
                    active
                      ? "text-[var(--portal-ink)]"
                      : "text-stone-600 hover:text-[var(--portal-ink)]"
                  }`}
                >
                  {label}
                  {active ? (
                    <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-[var(--portal-gold)]" />
                  ) : null}
                </Link>
              );
            })}
            {locationBadgeText ? (
              <div className="hidden items-center gap-2 rounded-full border border-[var(--portal-border)] bg-white/70 px-3 py-1.5 text-xs font-medium text-stone-600 lg:inline-flex">
                <MapPin className="h-3.5 w-3.5 text-[var(--portal-gold-deep)]" />
                {locationBadgeText}
              </div>
            ) : null}
            <Link
              href="/journey-builder"
              className="hidden rounded-full bg-[var(--portal-ink)] px-5 py-2.5 text-sm font-semibold text-[var(--portal-cream)] shadow-[0_14px_34px_-18px_rgba(18,52,59,0.95)] transition hover:bg-[var(--portal-ink-soft)] md:inline-flex"
            >
              {journeyBuilderLabel}
            </Link>
          </nav>

          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen(!open)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-stone-700 transition hover:bg-white/80 hover:text-[var(--portal-ink)] md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-b border-[var(--portal-border-soft)]/70 bg-[var(--portal-paper)]/96 px-4 py-4 shadow-[var(--portal-shadow-md)] backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-white text-[var(--portal-ink)]"
                      : "text-stone-700 hover:bg-white hover:text-[var(--portal-ink)]"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            {mobileMenuDescription ? (
              <div className="mt-3 rounded-2xl border border-[var(--portal-border-soft)] bg-white/85 px-4 py-3 text-sm text-stone-600">
                {mobileMenuDescription}
              </div>
            ) : null}
            <Link
              href="/journey-builder"
              onClick={() => setOpen(false)}
              className="mt-3 flex items-center justify-center gap-2 rounded-full bg-[var(--portal-ink)] px-4 py-3.5 text-sm font-semibold text-[var(--portal-cream)] transition hover:bg-[var(--portal-ink-soft)]"
            >
              {journeyBuilderLabel}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
