"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Compass, Mail, Phone } from "lucide-react";

/**
 * Paths where the footer must not render. The booking wizard and the
 * journey-builder are viewport-fit flows with a sticky price bar — a
 * full-bleed footer underneath would duplicate CTAs and force the
 * wizard content above the fold. Post-submit screens
 * (`/booking-confirmed`, `/booking/[ref]`) keep the footer so guests
 * re-orient with normal site chrome.
 */
const WIZARD_PATH_PREFIXES = ["/journey-builder"];

/** Matches /packages/[id]/book but NOT /packages or /packages/[id]. */
function isBookingWizardPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (WIZARD_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  // /packages/{id}/book — matches any package id
  return /^\/packages\/[^/]+\/book\/?$/.test(pathname);
}

export type ClientFooterSettings = {
  brandName: string;
  companyLogoUrl?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  clientPortalDescription: string;
  footerExploreTitle: string;
  footerContactTitle: string;
  footerBaseTitle: string;
  footerBaseDescription?: string;
  packagesLabel: string;
  journeyBuilderLabel: string;
  myBookingsLabel: string;
  copyrightSuffix?: string;
};

/**
 * Client-side gate around the portal footer. Renders the same editorial
 * footer the server used to render inline in the layout, but skips it
 * on wizard routes where the sticky price bar owns the bottom of the
 * viewport.
 */
export function ClientFooter({ settings }: { settings: ClientFooterSettings }) {
  const pathname = usePathname();
  if (isBookingWizardPath(pathname)) return null;

  return (
    <footer className="relative mt-auto border-t border-[var(--portal-border)] bg-[var(--portal-paper-strong)]/92 backdrop-blur-xl print:hidden">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2.8fr]">
          <div>
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-[var(--portal-ink)] text-[var(--portal-cream)]">
                {settings.companyLogoUrl ? (
                  <Image
                    src={settings.companyLogoUrl}
                    alt={settings.brandName}
                    fill
                    className="rounded-2xl object-cover"
                    sizes="40px"
                  />
                ) : (
                  <Compass className="h-4 w-4" />
                )}
              </div>
              <span className="text-base font-semibold tracking-tight text-stone-900">
                {settings.brandName}
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-stone-600">
              {settings.clientPortalDescription}
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <h4 className="text-sm font-semibold tracking-tight text-stone-900">
                {settings.footerExploreTitle}
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-stone-600">
                <li>
                  <Link
                    href="/packages"
                    className="transition hover:text-[var(--portal-ink)]"
                  >
                    {settings.packagesLabel}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/journey-builder"
                    className="transition hover:text-[var(--portal-ink)]"
                  >
                    {settings.journeyBuilderLabel}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/my-bookings"
                    className="transition hover:text-[var(--portal-ink)]"
                  >
                    {settings.myBookingsLabel}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold tracking-tight text-stone-900">
                {settings.footerContactTitle}
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-stone-600">
                {settings.companyEmail ? (
                  <li className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-[var(--portal-gold-deep)]" />
                    {settings.companyEmail}
                  </li>
                ) : null}
                {settings.companyPhone ? (
                  <li className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-[var(--portal-gold-deep)]" />
                    {settings.companyPhone}
                  </li>
                ) : null}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold tracking-tight text-stone-900">
                {settings.footerBaseTitle}
              </h4>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                {settings.companyAddress}
                {settings.footerBaseDescription ? (
                  <>
                    <br />
                    {settings.footerBaseDescription}
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-[var(--portal-border)] pt-6 text-center text-xs text-stone-500">
          © {new Date().getFullYear()} {settings.brandName}
          {settings.copyrightSuffix ? ` · ${settings.copyrightSuffix}` : ""}
        </div>
      </div>
    </footer>
  );
}
