import Link from "next/link";
import Image from "next/image";
import { Compass, Mail, Phone, Waves, Mountain, Landmark } from "lucide-react";
import { ClientHeader } from "./ClientHeader";
import { getAppSettings, getDisplayCompanyName } from "@/lib/app-config";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getAppSettings();
  const brandName = getDisplayCompanyName(settings);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f6efe4] text-stone-800">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(circle at 12% 12%, rgba(210, 164, 87, 0.22), transparent 26%), radial-gradient(circle at 82% 8%, rgba(18, 52, 59, 0.16), transparent 24%), radial-gradient(circle at 86% 62%, rgba(38, 111, 118, 0.14), transparent 26%), linear-gradient(180deg, rgba(252,246,238,0.96), rgba(246,239,228,1))",
        }}
      />
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
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </main>
      <footer className="relative mt-auto border-t border-[#d9c6ad] bg-[#f8f1e7]/92 shadow-[0_-10px_40px_-30px_rgba(43,32,15,0.55)] backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="mb-8 grid gap-4 rounded-[2rem] border border-[#d9c6ad] bg-[#12343b] p-6 text-[#f6ead6] shadow-[0_24px_60px_-28px_rgba(18,52,59,0.95)] lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-[#dcb87b]">
                {settings.portal.footerCtaEyebrow}
              </p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight">
                {settings.portal.footerCtaTitle}
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#dfd7c6]">
                {settings.portal.footerCtaDescription}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4">
                <Mountain className="h-5 w-5 text-[#dcb87b]" />
                <p className="mt-3 text-sm font-medium">Hill-country trains</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4">
                <Waves className="h-5 w-5 text-[#dcb87b]" />
                <p className="mt-3 text-sm font-medium">South and east coast stays</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4">
                <Landmark className="h-5 w-5 text-[#dcb87b]" />
                <p className="mt-3 text-sm font-medium">Cultural triangle routes</p>
              </div>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#12343b] text-[#f6ead6]">
                  {settings.company.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <Image
                      src={settings.company.logoUrl}
                      alt={brandName}
                      fill
                      unoptimized
                      className="rounded-2xl object-cover"
                      sizes="100vw"
                    />
                  ) : (
                    <Compass className="h-4 w-4" />
                  )}
                </div>
                <span className="font-semibold text-stone-900">
                  {brandName}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                {settings.portal.clientPortalDescription}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-stone-900">
                {settings.portal.footerExploreTitle}
              </h4>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link
                    href="/packages"
                    className="text-sm text-stone-600 transition hover:text-[#12343b]"
                  >
                    {settings.portal.packagesLabel}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/journey-builder"
                    className="text-sm text-stone-600 transition hover:text-[#12343b]"
                  >
                    {settings.portal.journeyBuilderLabel}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/my-bookings"
                    className="text-sm text-stone-600 transition hover:text-[#12343b]"
                  >
                    {settings.portal.myBookingsLabel}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-stone-900">
                {settings.portal.footerContactTitle}
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-stone-600">
                {settings.company.email ? (
                  <li className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[#b67833]" />
                    {settings.company.email}
                  </li>
                ) : null}
                {settings.company.phone ? (
                  <li className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-[#b67833]" />
                    {settings.company.phone}
                  </li>
                ) : null}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-stone-900">
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

          <div className="mt-10 border-t border-[#d9c6ad] pt-8 text-center text-sm text-stone-500">
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
