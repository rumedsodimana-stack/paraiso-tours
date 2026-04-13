"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Building2, Globe2, ImageIcon, Loader2, Mail, Phone } from "lucide-react";
import { updateAppSettingsAction } from "@/app/actions/app-settings";
import type { AppSettings, BusinessType } from "@/lib/types";

const initialState = { ok: false, message: "" };

const BUSINESS_TYPES: { value: BusinessType | ""; label: string }[] = [
  { value: "", label: "Select business type…" },
  { value: "adventure", label: "Adventure & Trekking" },
  { value: "beach_resort", label: "Beach & Resort" },
  { value: "cultural", label: "Cultural & Heritage" },
  { value: "luxury", label: "Luxury Travel" },
  { value: "budget", label: "Budget Travel" },
  { value: "eco", label: "Eco & Sustainable Tourism" },
  { value: "corporate", label: "Corporate Travel" },
  { value: "safari_wildlife", label: "Safari & Wildlife" },
  { value: "multi_destination", label: "Multi-destination" },
  { value: "other", label: "Other" },
];

const CURRENCIES = [
  "USD", "EUR", "GBP", "LKR", "AED", "SGD", "AUD", "CAD",
  "INR", "THB", "MYR", "IDR", "JPY", "ZAR", "KES",
];

const TIMEZONES = [
  "Asia/Colombo", "Asia/Dubai", "Asia/Singapore", "Asia/Kolkata",
  "Asia/Bangkok", "Asia/Jakarta", "Asia/Tokyo", "Africa/Nairobi",
  "Africa/Johannesburg", "Europe/London", "Europe/Paris",
  "America/New_York", "America/Los_Angeles", "Australia/Sydney",
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      {hint && <span className="ml-2 text-xs text-stone-400">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls = "w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";
const selectCls = `${inputCls} appearance-none`;

export function CompanySettingsSection({ settings }: { settings: AppSettings }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateAppSettingsAction, initialState);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state.ok]);

  const displayName = settings.company.displayName ?? settings.company.companyName;

  return (
    <form action={formAction} className="space-y-6">
      {/* Company Identity */}
      <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/50 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-stone-100 px-6 py-4">
          <Building2 className="h-5 w-5 text-teal-600" />
          <div>
            <p className="font-semibold text-stone-900">Company Identity</p>
            <p className="text-xs text-stone-500">Your brand name, logo, and business details</p>
          </div>
        </div>
        <div className="p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Display name" hint="shown in portal header">
                  <input name="displayName" defaultValue={displayName} placeholder="Paraíso Ceylon Tours" className={inputCls} />
                </Field>
                <Field label="Legal company name" hint="used on invoices">
                  <input name="companyName" defaultValue={settings.company.companyName} placeholder="Paraíso Ceylon Tours Pvt Ltd" className={inputCls} />
                </Field>
                <Field label="Tagline">
                  <input name="tagline" defaultValue={settings.company.tagline} placeholder="Crafted journeys across Sri Lanka" className={inputCls} />
                </Field>
                <Field label="Business type">
                  <select name="businessType" defaultValue={settings.company.businessType ?? ""} className={selectCls}>
                    {BUSINESS_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Logo URL" hint="or upload below">
                  <input name="logoUrl" type="url" defaultValue={settings.company.logoUrl} placeholder="https://…" className={inputCls} />
                </Field>
                <Field label="Website">
                  <input name="website" type="url" defaultValue={settings.company.website} placeholder="https://yourcompany.com" className={inputCls} />
                </Field>
              </div>

              <Field label="Upload logo">
                <input
                  name="logoFile"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="block w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-teal-700"
                />
                <p className="mt-1 text-xs text-stone-400">PNG, JPG, WEBP or SVG · max 2 MB</p>
              </Field>
            </div>

            {/* Live preview */}
            <div className="flex flex-col gap-3 rounded-2xl border border-stone-100 bg-stone-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Preview</p>
              <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-stone-900 text-white">
                  {settings.company.logoUrl ? (
                    <Image src={settings.company.logoUrl} alt={displayName} fill className="object-cover" sizes="48px" />
                  ) : (
                    <ImageIcon className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-900">{displayName}</p>
                  <p className="truncate text-xs text-stone-500">{settings.company.tagline || "Your tagline"}</p>
                </div>
              </div>
              <p className="text-[11px] text-stone-400 leading-4">Used in portal header, invoices, emails, and admin shell.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Location & Operations */}
      <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/50 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-stone-100 px-6 py-4">
          <Globe2 className="h-5 w-5 text-teal-600" />
          <div>
            <p className="font-semibold text-stone-900">Location & Operations</p>
            <p className="text-xs text-stone-500">Country, timezone and default currency for your business</p>
          </div>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Country">
            <input name="country" defaultValue={settings.company.country} placeholder="Sri Lanka" className={inputCls} />
          </Field>
          <Field label="Timezone">
            <select name="timezone" defaultValue={settings.company.timezone ?? "Asia/Colombo"} className={selectCls}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
              <option value="">Other</option>
            </select>
          </Field>
          <Field label="Default currency" hint="for invoices & packages">
            <select name="currency" defaultValue={settings.company.currency ?? "USD"} className={selectCls}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Address">
              <textarea name="address" defaultValue={settings.company.address} placeholder="123 Galle Road, Colombo 03, Sri Lanka" rows={2} className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20" />
            </Field>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/50 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-stone-100 px-6 py-4">
          <Phone className="h-5 w-5 text-teal-600" />
          <div>
            <p className="font-semibold text-stone-900">Contact Details</p>
            <p className="text-xs text-stone-500">Shown in footer, invoices, and client communications</p>
          </div>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <Field label="Email">
            <input name="email" type="email" defaultValue={settings.company.email} placeholder="hello@yourcompany.com" className={inputCls} />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={settings.company.phone} placeholder="+94 77 000 0000" className={inputCls} />
          </Field>
        </div>
      </div>

      {/* Portal copy fields (hidden — passed through so they don't get wiped) */}
      <input type="hidden" name="topBannerText" value={settings.portal.topBannerText} />
      <input type="hidden" name="topBannerSubtext" value={settings.portal.topBannerSubtext ?? ""} />
      <input type="hidden" name="locationBadgeText" value={settings.portal.locationBadgeText ?? ""} />
      <input type="hidden" name="mobileMenuDescription" value={settings.portal.mobileMenuDescription ?? ""} />
      <input type="hidden" name="clientPortalDescription" value={settings.portal.clientPortalDescription} />
      <input type="hidden" name="footerExploreTitle" value={settings.portal.footerExploreTitle} />
      <input type="hidden" name="footerContactTitle" value={settings.portal.footerContactTitle} />
      <input type="hidden" name="footerBaseTitle" value={settings.portal.footerBaseTitle} />
      <input type="hidden" name="footerBaseDescription" value={settings.portal.footerBaseDescription ?? ""} />
      <input type="hidden" name="footerCtaEyebrow" value={settings.portal.footerCtaEyebrow ?? ""} />
      <input type="hidden" name="footerCtaTitle" value={settings.portal.footerCtaTitle} />
      <input type="hidden" name="footerCtaDescription" value={settings.portal.footerCtaDescription ?? ""} />
      <input type="hidden" name="packagesLabel" value={settings.portal.packagesLabel} />
      <input type="hidden" name="journeyBuilderLabel" value={settings.portal.journeyBuilderLabel} />
      <input type="hidden" name="myBookingsLabel" value={settings.portal.myBookingsLabel} />
      <input type="hidden" name="trackBookingLabel" value={settings.portal.trackBookingLabel} />
      <input type="hidden" name="customJourneyGuidanceFee" value={String(settings.portal.customJourneyGuidanceFee)} />
      <input type="hidden" name="customJourneyGuidanceLabel" value={settings.portal.customJourneyGuidanceLabel} />
      <input type="hidden" name="copyrightSuffix" value={settings.portal.copyrightSuffix ?? ""} />

      {state.message && (
        <div className={`rounded-xl px-4 py-3 text-sm ${state.ok ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-rose-200 bg-rose-50 text-rose-700"}`}>
          {state.message}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
        >
          {isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : "Save company"}
        </button>
      </div>
    </form>
  );
}
