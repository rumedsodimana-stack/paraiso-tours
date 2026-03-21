"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Building2, Database, Globe2, ImageIcon, Loader2 } from "lucide-react";
import { updateAppSettingsAction } from "@/app/actions/app-settings";
import type { AppSettings } from "@/lib/types";

const initialState = { ok: false, message: "" };

function InputField(props: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-stone-700">{props.label}</span>
      <input
        name={props.name}
        type={props.type ?? "text"}
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
        className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
      />
    </label>
  );
}

function TextAreaField(props: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-stone-700">{props.label}</span>
      <textarea
        name={props.name}
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
        rows={props.rows ?? 3}
        className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
      />
    </label>
  );
}

export function BrandSettingsSection({
  settings,
}: {
  settings: AppSettings;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    updateAppSettingsAction,
    initialState
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [router, state.ok]);

  const displayName = settings.company.displayName ?? settings.company.companyName;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-white/20 bg-white/40 p-6 shadow-lg shadow-stone-200/50 backdrop-blur-xl">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-stone-900">
              Brand & company setup
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Change the travel agency name, contact details, logo URL, and the
              client portal footer/header copy from one place.
            </p>
          </div>
        </div>

        <form action={formAction} className="mt-6 space-y-8">
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
              <ImageIcon className="h-4 w-4" />
              Company Identity
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="Display name"
                  name="displayName"
                  defaultValue={displayName}
                  placeholder="Shown in portal header and footer"
                />
                <InputField
                  label="Legal company name"
                  name="companyName"
                  defaultValue={settings.company.companyName}
                  placeholder="Used in invoices and records"
                />
                <InputField
                  label="Tagline"
                  name="tagline"
                  defaultValue={settings.company.tagline}
                  placeholder="Crafted journeys across Sri Lanka"
                />
                <InputField
                  label="Logo URL"
                  name="logoUrl"
                  defaultValue={settings.company.logoUrl}
                  placeholder="https://..."
                  type="url"
                />
                <label className="block md:col-span-2">
                  <span className="text-sm font-medium text-stone-700">
                    Upload logo image
                  </span>
                  <input
                    name="logoFile"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="mt-1 block w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-teal-700"
                  />
                  <p className="mt-2 text-xs text-stone-500">
                    PNG, JPG, WEBP, or SVG up to 2 MB. When Supabase is
                    configured, uploads go straight to Supabase Storage instead
                    of Vercel memory.
                  </p>
                </label>
                <InputField
                  label="Email"
                  name="email"
                  defaultValue={settings.company.email}
                  placeholder="hello@example.com"
                  type="email"
                />
                <InputField
                  label="Phone"
                  name="phone"
                  defaultValue={settings.company.phone}
                  placeholder="+94 ..."
                />
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-5">
                <p className="text-sm font-semibold text-stone-900">
                  Live branding preview
                </p>
                <div className="mt-4 flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4">
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#12343b] text-[#f7e8d1]">
                    {settings.company.logoUrl ? (
                      <Image
                        src={settings.company.logoUrl}
                        alt={displayName}
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <ImageIcon className="h-7 w-7" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-stone-900">
                      {displayName}
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                      {settings.company.tagline || "Tagline will appear here"}
                    </p>
                    <p className="mt-2 text-xs text-stone-400">
                      Header, footer, invoices, admin shell, and notifications
                      use this branding.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <TextAreaField
              label="Address"
              name="address"
              defaultValue={settings.company.address}
              placeholder="Colombo, Sri Lanka"
              rows={2}
            />
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
              <Globe2 className="h-4 w-4" />
              Client Portal Copy
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <InputField
                label="Top banner text"
                name="topBannerText"
                defaultValue={settings.portal.topBannerText}
              />
              <InputField
                label="Top banner subtext"
                name="topBannerSubtext"
                defaultValue={settings.portal.topBannerSubtext}
              />
              <InputField
                label="Location badge text"
                name="locationBadgeText"
                defaultValue={settings.portal.locationBadgeText}
              />
              <InputField
                label="Mobile menu text"
                name="mobileMenuDescription"
                defaultValue={settings.portal.mobileMenuDescription}
              />
              <InputField
                label="Packages label"
                name="packagesLabel"
                defaultValue={settings.portal.packagesLabel}
              />
              <InputField
                label="Journey builder label"
                name="journeyBuilderLabel"
                defaultValue={settings.portal.journeyBuilderLabel}
              />
              <InputField
                label="My bookings label"
                name="myBookingsLabel"
                defaultValue={settings.portal.myBookingsLabel}
              />
              <InputField
                label="Track booking label"
                name="trackBookingLabel"
                defaultValue={settings.portal.trackBookingLabel}
              />
              <InputField
                label="Journey guidance fee"
                name="customJourneyGuidanceFee"
                defaultValue={String(settings.portal.customJourneyGuidanceFee)}
                placeholder="150"
                type="number"
              />
              <InputField
                label="Journey guidance label"
                name="customJourneyGuidanceLabel"
                defaultValue={settings.portal.customJourneyGuidanceLabel}
              />
              <InputField
                label="Footer explore title"
                name="footerExploreTitle"
                defaultValue={settings.portal.footerExploreTitle}
              />
              <InputField
                label="Footer contact title"
                name="footerContactTitle"
                defaultValue={settings.portal.footerContactTitle}
              />
              <InputField
                label="Footer base title"
                name="footerBaseTitle"
                defaultValue={settings.portal.footerBaseTitle}
              />
              <InputField
                label="Copyright suffix"
                name="copyrightSuffix"
                defaultValue={settings.portal.copyrightSuffix}
              />
            </div>
            <TextAreaField
              label="Client portal description"
              name="clientPortalDescription"
              defaultValue={settings.portal.clientPortalDescription}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <TextAreaField
                label="Footer base description"
                name="footerBaseDescription"
                defaultValue={settings.portal.footerBaseDescription}
              />
              <TextAreaField
                label="Footer CTA description"
                name="footerCtaDescription"
                defaultValue={settings.portal.footerCtaDescription}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <InputField
                label="Footer CTA eyebrow"
                name="footerCtaEyebrow"
                defaultValue={settings.portal.footerCtaEyebrow}
              />
              <InputField
                label="Footer CTA title"
                name="footerCtaTitle"
                defaultValue={settings.portal.footerCtaTitle}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Storage strategy</p>
                <p className="mt-1 leading-6">
                  Vercel is stateless, so branding assets should live in
                  external object storage. This screen supports either a public
                  image URL or a direct upload into Supabase Storage, which
                  keeps server memory and ephemeral disk usage low.
                </p>
              </div>
            </div>
          </section>

          {state.message ? (
            <div
              className={`rounded-xl px-4 py-3 text-sm ${
                state.ok
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {state.message}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-stone-500">
              Changes apply across the public portal and admin documents after
              save.
            </p>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save branding"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
