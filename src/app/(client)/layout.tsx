import { ClientHeader } from "./ClientHeader";
import { ClientFooter } from "./ClientFooter";
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
      <ClientFooter
        settings={{
          brandName,
          companyLogoUrl: settings.company.logoUrl,
          companyEmail: settings.company.email,
          companyPhone: settings.company.phone,
          companyAddress: settings.company.address,
          clientPortalDescription: settings.portal.clientPortalDescription,
          footerExploreTitle: settings.portal.footerExploreTitle,
          footerContactTitle: settings.portal.footerContactTitle,
          footerBaseTitle: settings.portal.footerBaseTitle,
          footerBaseDescription: settings.portal.footerBaseDescription,
          packagesLabel: settings.portal.packagesLabel,
          journeyBuilderLabel: settings.portal.journeyBuilderLabel,
          myBookingsLabel: settings.portal.myBookingsLabel,
          copyrightSuffix: settings.portal.copyrightSuffix,
        }}
      />
    </div>
  );
}
