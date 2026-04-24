import Link from "next/link";
import Image from "next/image";
import { Compass, Mail, Phone } from "lucide-react";
import { ClientHeader } from "./ClientHeader";
import { getAppSettings, getDisplayCompanyName } from "@/lib/app-config";
import "./_ui/tokens.css";

/**
 * Client portal layout — the shell every (client) page renders inside.
 *
 * Design direction: editorial refinement.
 *   - One ambient gradient on a cream paper surface (no competing
 *     decorative layers)
 *   - Footer is a single quiet band with the brand / nav / contact
 *     stacked in a 4-column grid (no nested teal CTA box)
 *   - Tokens live in _ui/tokens.css and drive every colour here
 */
export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getAppSettings();
  const brandName = getDisplayCompanyName(settings);

  return (
    <div className="portal-print-clean min-h-screen overflow-x-hidden bg-[var(--portal-cream)] text-[var(--portal-text)] print:bg-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 print:hidden"
        style={{
          background:
            "radial-gradient(circle at 12% 12%, rgba(210, 164, 87, 0.18), transparent 28%), radial-gradient(circle at 86% 8%, rgba(18, 52, 59, 0.14), transparent 30%), linear-gradient(180deg, rgba(252,246,238,0.96), rgba(246,239,228,1))",
        }}
      />
      <div className="print:hidden">
        <ClientHeader
          brandName={brandName}
          logoUrl={settings.company.logoUrl}
          topBannerText={settings.portal.topBannerText}
          topBannerSubtext={settings.portal.topBannerSubtext}
          locationBadgeText={settings.portal.locationBadgeText}
          mobileMenuDescription={settings.portal.mobileMenuDescription}
          packagesLabel={settings.portal.packagesLabel}
          journeyBuilderLabel={settings.portal.journeyBuilderLabel}
          myBookingsLabel={settings.portal.myBookingsLabel}
          trackBookingLabel={settings.portal.trackBookingLabel}
        />
      </div>
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 print:max-w-none print:px-0 print:py-0">
        {children}
      </main>
      <footer className="relative mt-auto border-t border-[var(--portal-border)] bg-[var(--portal-paper-strong)]/92 backdrop-blur-xl print:hidden">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_2.8fr]">
            <div>
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-[var(--portal-ink)] text-[var(--portal-cream)]">
                  {settings.company.logoUrl ? (
                    <Image
                      src={settings.company.logoUrl}
                      alt={brandName}
                      fill
                      className="rounded-2xl object-cover"
                      sizes="40px"
                    />
                  ) : (
                    <Compass className="h-4 w-4" />
                  )}
                </div>
                <span className="text-base font-semibold tracking-tight text-stone-900">
                  {brandName}
                </span>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-6 text-stone-600">
                {settings.portal.clientPortalDescription}
              </p>
            </div>
            <div className="grid gap-8 sm:grid-cols-3">
              <div>
                <h4 className="text-sm font-semibold tracking-tight text-stone-900">
                  {settings.portal.footerExploreTitle}
                </h4>
                <ul className="mt-3 space-y-2 text-sm text-stone-600">
                  <li>
                    <Link
                      href="/packages"
                      className="transition hover:text-[var(--portal-ink)]"
                    >
                      {settings.portal.packagesLabel}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/journey-builder"
                      className="transition hover:text-[var(--portal-ink)]"
                    >
                      {settings.portal.journeyBuilderLabel}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/my-bookings"
                      className="transition hover:text-[var(--portal-ink)]"
                    >
                      {settings.portal.myBookingsLabel}
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold tracking-tight text-stone-900">
                  {settings.portal.footerContactTitle}
                </h4>
                <ul className="mt-3 space-y-2 text-sm text-stone-600">
                  {settings.company.email ? (
                    <li className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-[var(--portal-gold-deep)]" />
                      {settings.company.email}
                    </li>
                  ) : null}
                  {settings.company.phone ? (
                    <li className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-[var(--portal-gold-deep)]" />
                      {settings.company.phone}
                    </li>
                  ) : null}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold tracking-tight text-stone-900">
                  {settings.portal.footerBaseTitle}
                </h4>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {settings.company.address}
                  {settings.portal.footerBaseDescription ? (
                    <>
                      <br />
                      {settings.portal.footerBaseDescription}
                    </>
                  ) : null}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 border-t border-[var(--portal-border)] pt-6 text-center text-xs text-stone-500">
            © {new Date().getFullYear()} {brandName}
            {settings.portal.copyrightSuffix
              ? ` · ${settings.portal.copyrightSuffix}`
              : ""}
          </div>
        </div>
      </footer>
    </div>
  );
}
