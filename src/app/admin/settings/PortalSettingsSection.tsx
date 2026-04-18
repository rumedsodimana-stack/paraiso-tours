"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Globe2, Loader2 } from "lucide-react";
import { updateAppSettingsAction } from "@/app/actions/app-settings";
import type { AppSettings } from "@/lib/types";

const initialState = { ok: false, message: "" };

const inputCls = "w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-sm text-[#11272b] outline-none transition focus:border-[#c9922f] focus:ring-2 focus:ring-[#c9922f]/20";
const textareaCls = "w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-sm text-[#11272b] outline-none transition focus:border-[#c9922f] focus:ring-2 focus:ring-[#c9922f]/20";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[#11272b]">{label}</span>
      {hint && <span className="ml-1.5 text-xs text-[#8a9ba1]">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function PortalSettingsSection({ settings }: { settings: AppSettings }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateAppSettingsAction, initialState);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state.ok]);

  const p = settings.portal;
  const c = settings.company;

  return (
    <form action={formAction} className="space-y-6">
      {/* Hidden company fields — preserve them */}
      <input type="hidden" name="displayName" value={c.displayName ?? c.companyName} />
      <input type="hidden" name="companyName" value={c.companyName} />
      <input type="hidden" name="tagline" value={c.tagline ?? ""} />
      <input type="hidden" name="address" value={c.address ?? ""} />
      <input type="hidden" name="country" value={c.country ?? ""} />
      <input type="hidden" name="timezone" value={c.timezone ?? ""} />
      <input type="hidden" name="currency" value={c.currency ?? "USD"} />
      <input type="hidden" name="website" value={c.website ?? ""} />
      <input type="hidden" name="businessType" value={c.businessType ?? ""} />
      <input type="hidden" name="phone" value={c.phone ?? ""} />
      <input type="hidden" name="email" value={c.email ?? ""} />
      <input type="hidden" name="logoUrl" value={c.logoUrl ?? ""} />

      {/* Key Portal Fields */}
      <div className="overflow-hidden rounded-2xl border border-[#e0e4dd] bg-[#fffbf4] shadow-sm">
        <div className="flex items-center gap-3 border-b border-[#e0e4dd] px-6 py-4">
          <Globe2 className="h-5 w-5 text-[#c9922f]" />
          <div>
            <p className="font-semibold text-[#11272b]">Client Portal</p>
            <p className="text-xs text-[#5e7279]">What your customers see on the booking site</p>
          </div>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Hero banner text" hint="top ticker strip">
              <input name="topBannerText" defaultValue={p.topBannerText} placeholder="Sri Lanka itineraries shaped across coast, culture…" className={inputCls} />
            </Field>
            <Field label="Banner subtext" hint="right side of ticker">
              <input name="topBannerSubtext" defaultValue={p.topBannerSubtext} placeholder="Flexible private routing" className={inputCls} />
            </Field>
            <Field label="Location badge" hint="shown near hero CTA">
              <input name="locationBadgeText" defaultValue={p.locationBadgeText} placeholder="Colombo to the south coast" className={inputCls} />
            </Field>
            <Field label="Journey guidance fee" hint="USD — shown on custom journey builder">
              <input name="customJourneyGuidanceFee" type="number" defaultValue={String(p.customJourneyGuidanceFee)} placeholder="150" className={inputCls} />
            </Field>
          </div>
          <Field label="Portal description" hint="hero subheading on homepage">
            <textarea name="clientPortalDescription" defaultValue={p.clientPortalDescription} rows={2} placeholder="Private circuits, coastal escapes, hill-country trains…" className={textareaCls} />
          </Field>
        </div>
      </div>

      {/* Navigation Labels */}
      <div className="overflow-hidden rounded-2xl border border-[#e0e4dd] bg-[#fffbf4] shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <p className="text-sm font-semibold text-[#11272b]">Navigation labels</p>
          <p className="text-xs text-[#8a9ba1]">Rename menu items for your market</p>
        </div>
        <div className="grid gap-4 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Packages">
            <input name="packagesLabel" defaultValue={p.packagesLabel} placeholder="Tour packages" className={inputCls} />
          </Field>
          <Field label="Journey builder">
            <input name="journeyBuilderLabel" defaultValue={p.journeyBuilderLabel} placeholder="Build your journey" className={inputCls} />
          </Field>
          <Field label="My bookings">
            <input name="myBookingsLabel" defaultValue={p.myBookingsLabel} placeholder="My bookings" className={inputCls} />
          </Field>
          <Field label="Track booking">
            <input name="trackBookingLabel" defaultValue={p.trackBookingLabel} placeholder="Track booking" className={inputCls} />
          </Field>
        </div>
      </div>

      {/* Advanced accordion */}
      <div className="overflow-hidden rounded-2xl border border-[#e0e4dd] bg-[#fffbf4] shadow-sm">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-4 text-left transition hover:bg-[#f4ecdd]"
        >
          <div>
            <p className="text-sm font-semibold text-[#11272b]">Advanced — footer copy</p>
            <p className="text-xs text-[#8a9ba1]">Footer titles, CTA section, copyright</p>
          </div>
          <ChevronDown className={`h-4 w-4 text-[#8a9ba1] transition ${advancedOpen ? "rotate-180" : ""}`} />
        </button>
        {advancedOpen && (
          <div className="space-y-4 border-t border-[#e0e4dd] px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Footer — explore column title">
                <input name="footerExploreTitle" defaultValue={p.footerExploreTitle} placeholder="Explore" className={inputCls} />
              </Field>
              <Field label="Footer — contact column title">
                <input name="footerContactTitle" defaultValue={p.footerContactTitle} placeholder="Contact" className={inputCls} />
              </Field>
              <Field label="Footer — base column title">
                <input name="footerBaseTitle" defaultValue={p.footerBaseTitle} placeholder="Base" className={inputCls} />
              </Field>
              <Field label="Footer CTA eyebrow">
                <input name="footerCtaEyebrow" defaultValue={p.footerCtaEyebrow} placeholder="Ready to travel?" className={inputCls} />
              </Field>
              <Field label="Footer CTA title">
                <input name="footerCtaTitle" defaultValue={p.footerCtaTitle} placeholder="Start planning your journey" className={inputCls} />
              </Field>
              <Field label="Copyright suffix">
                <input name="copyrightSuffix" defaultValue={p.copyrightSuffix} placeholder="All rights reserved." className={inputCls} />
              </Field>
              <Field label="Journey guidance label">
                <input name="customJourneyGuidanceLabel" defaultValue={p.customJourneyGuidanceLabel} placeholder="Custom journey guidance fee" className={inputCls} />
              </Field>
              <Field label="Mobile menu text">
                <input name="mobileMenuDescription" defaultValue={p.mobileMenuDescription} placeholder="Explore Sri Lanka" className={inputCls} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Footer base description">
                <textarea name="footerBaseDescription" defaultValue={p.footerBaseDescription} rows={2} className={textareaCls} />
              </Field>
              <Field label="Footer CTA description">
                <textarea name="footerCtaDescription" defaultValue={p.footerCtaDescription} rows={2} className={textareaCls} />
              </Field>
            </div>
          </div>
        )}
      </div>

      {state.message && (
        <div className={`rounded-xl px-4 py-3 text-sm ${state.ok ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-rose-200 bg-rose-50 text-rose-700"}`}>
          {state.message}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-6 py-2.5 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f] disabled:opacity-60"
        >
          {isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : "Save portal"}
        </button>
      </div>
    </form>
  );
}
