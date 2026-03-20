"use client";

import { useState } from "react";
import Link from "next/link";
import { Compass, MapPin, Menu, Sparkles, X } from "lucide-react";

const navLinks = [
  { href: "/packages", label: "Packages" },
  { href: "/journey-builder", label: "Build Your Journey" },
  { href: "/my-bookings", label: "My Bookings" },
  { href: "/", label: "Track Booking" },
];

export function ClientHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50">
      <div className="border-b border-white/20 bg-stone-950 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-stone-200/80 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Sri Lanka itineraries shaped across coast, culture, and tea country
          </span>
          <span className="hidden text-stone-300/70 md:inline">
            Colombo arrival support · Flexible private routing
          </span>
        </div>
      </div>

      <div className="border-b border-[#dcc9b1]/60 bg-[#f8f0e4]/88 shadow-[0_8px_40px_-24px_rgba(43,32,15,0.55)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3"
          onClick={() => setOpen(false)}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#12343b] text-[#f7e8d1] shadow-[0_12px_32px_-18px_rgba(18,52,59,0.9)]">
            <Compass className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <span className="block truncate text-base font-semibold tracking-tight text-stone-900 sm:text-xl">
              Paraíso Ceylon Tours
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium text-stone-600 transition hover:text-[#12343b]"
            >
              {label}
            </Link>
          ))}
          <div className="hidden items-center gap-2 rounded-full border border-[#d5c2a9] bg-white/75 px-3 py-1.5 text-xs font-medium text-stone-600 lg:inline-flex">
            <MapPin className="h-3.5 w-3.5 text-[#b67833]" />
            Colombo to the south coast
          </div>
          <Link
            href="/journey-builder"
            className="hidden rounded-full bg-[#12343b] px-5 py-2.5 text-sm font-semibold text-[#f7e8d1] shadow-[0_14px_34px_-18px_rgba(18,52,59,0.95)] transition hover:bg-[#0f2b31] md:inline-flex"
          >
            Build Your Journey
          </Link>
        </nav>

        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen(!open)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl text-stone-700 transition hover:bg-white/80 hover:text-[#12343b] md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      </div>

      {open && (
        <nav className="border-b border-[#dcc9b1]/60 bg-[#fbf5ec]/96 px-4 py-4 shadow-[0_20px_48px_-28px_rgba(43,32,15,0.55)] backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-white hover:text-[#12343b]"
              >
                {label}
              </Link>
            ))}
            <div className="mt-3 rounded-2xl border border-[#dcc9b1] bg-white/85 px-4 py-3 text-sm text-stone-600">
              Sri Lanka routes built for culture, hill country, coast, and safari stays.
            </div>
            <Link
              href="/journey-builder"
              onClick={() => setOpen(false)}
              className="mt-3 flex items-center justify-center gap-2 rounded-full bg-[#12343b] px-4 py-3.5 text-sm font-semibold text-[#f7e8d1] transition hover:bg-[#0f2b31]"
            >
              Build Your Journey
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
