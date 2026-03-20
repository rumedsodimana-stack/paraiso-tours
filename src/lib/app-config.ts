import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { cache } from "react";
import { supabase } from "./supabase";
import type { AppSettings, Company, PortalSettings } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = "app-settings.json";
const SETTINGS_ROW_ID = "default";
const IS_VERCEL = process.env.VERCEL === "1";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  company: {
    displayName: "Paraíso Ceylon Tours",
    companyName: "Paraíso Ceylon Tours",
    tagline: "Crafted journeys across Sri Lanka",
    address: "Colombo, Sri Lanka",
    phone: "+94 11 234 5678",
    email: "hello@paraisoceylontours.com",
    logoUrl: "",
  },
  portal: {
    topBannerText:
      "Sri Lanka itineraries shaped across coast, culture, and tea country",
    topBannerSubtext: "Colombo arrival support · Flexible private routing",
    locationBadgeText: "Colombo to the south coast",
    mobileMenuDescription:
      "Sri Lanka routes built for culture, hill country, coast, and safari stays.",
    clientPortalDescription:
      "A client portal for tracking Sri Lanka routes, comparing package styles, and keeping booking details close at hand.",
    footerExploreTitle: "Explore",
    footerContactTitle: "Contact",
    footerBaseTitle: "Base",
    footerBaseDescription: "Routing support from arrival to departure",
    footerCtaEyebrow: "Plan With Context",
    footerCtaTitle:
      "Build a Sri Lanka trip that flows from arrival to final beach day",
    footerCtaDescription:
      "Use the portal to compare routes, lock in accommodation style, and keep your booking visible after checkout.",
    packagesLabel: "Tour packages",
    journeyBuilderLabel: "Build your journey",
    myBookingsLabel: "My bookings",
    trackBookingLabel: "Track booking",
    copyrightSuffix: "Sri Lanka",
  },
  updatedAt: "2026-03-20T00:00:00.000Z",
};

interface AppSettingsInput {
  company?: Partial<Company>;
  portal?: Partial<PortalSettings>;
  updatedAt?: string | null;
}

function mergeAppSettings(input?: AppSettingsInput | null): AppSettings {
  return {
    company: {
      ...DEFAULT_APP_SETTINGS.company,
      ...(input?.company ?? {}),
    },
    portal: {
      ...DEFAULT_APP_SETTINGS.portal,
      ...(input?.portal ?? {}),
    },
    updatedAt: input?.updatedAt ?? DEFAULT_APP_SETTINGS.updatedAt,
  };
}

async function ensureDataDir() {
  if (IS_VERCEL) return;
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch {
    // directory already exists
  }
}

async function readFallbackSettings(): Promise<AppSettings> {
  if (IS_VERCEL) return DEFAULT_APP_SETTINGS;

  try {
    await ensureDataDir();
    const filePath = path.join(DATA_DIR, SETTINGS_FILE);
    const data = await readFile(filePath, "utf-8");
    return mergeAppSettings(JSON.parse(data) as Partial<AppSettings>);
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

async function writeFallbackSettings(settings: AppSettings): Promise<void> {
  if (IS_VERCEL) return;

  await ensureDataDir();
  const filePath = path.join(DATA_DIR, SETTINGS_FILE);
  await writeFile(filePath, JSON.stringify(settings, null, 2), "utf-8");
}

function sanitizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function sanitizeUrl(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:")) {
    throw new Error(
      "Use a public image URL for the logo. Data URLs are disabled to avoid filling server memory."
    );
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("Logo URL must start with http:// or https://");
  }
  if (trimmed.length > 1000) {
    throw new Error("Logo URL is too long.");
  }
  return trimmed;
}

function normalizeCompany(company?: Partial<Company>): Partial<Company> {
  if (!company) return {};

  return {
    displayName: sanitizeText(company.displayName),
    companyName: sanitizeText(company.companyName),
    tagline: sanitizeText(company.tagline),
    address: sanitizeText(company.address),
    phone: sanitizeText(company.phone),
    email: sanitizeText(company.email),
    logoUrl: sanitizeUrl(company.logoUrl),
  };
}

function normalizePortal(portal?: Partial<PortalSettings>): Partial<PortalSettings> {
  if (!portal) return {};

  return {
    topBannerText: sanitizeText(portal.topBannerText),
    topBannerSubtext: sanitizeText(portal.topBannerSubtext),
    locationBadgeText: sanitizeText(portal.locationBadgeText),
    mobileMenuDescription: sanitizeText(portal.mobileMenuDescription),
    clientPortalDescription: sanitizeText(portal.clientPortalDescription),
    footerExploreTitle: sanitizeText(portal.footerExploreTitle),
    footerContactTitle: sanitizeText(portal.footerContactTitle),
    footerBaseTitle: sanitizeText(portal.footerBaseTitle),
    footerBaseDescription: sanitizeText(portal.footerBaseDescription),
    footerCtaEyebrow: sanitizeText(portal.footerCtaEyebrow),
    footerCtaTitle: sanitizeText(portal.footerCtaTitle),
    footerCtaDescription: sanitizeText(portal.footerCtaDescription),
    packagesLabel: sanitizeText(portal.packagesLabel),
    journeyBuilderLabel: sanitizeText(portal.journeyBuilderLabel),
    myBookingsLabel: sanitizeText(portal.myBookingsLabel),
    trackBookingLabel: sanitizeText(portal.trackBookingLabel),
    copyrightSuffix: sanitizeText(portal.copyrightSuffix),
  };
}

const readAppSettings = cache(async (): Promise<AppSettings> => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("company, portal, updated_at")
        .eq("id", SETTINGS_ROW_ID)
        .maybeSingle();

      if (!error && data) {
        return mergeAppSettings({
          company: (data.company as Partial<Company> | null) ?? undefined,
          portal: (data.portal as Partial<PortalSettings> | null) ?? undefined,
          updatedAt: String(data.updated_at),
        });
      }
    } catch {
      // fall back to file/defaults
    }
  }

  return readFallbackSettings();
});

export async function getAppSettings(): Promise<AppSettings> {
  return readAppSettings();
}

export async function updateAppSettings(input: {
  company?: Partial<Company>;
  portal?: Partial<PortalSettings>;
}): Promise<AppSettings> {
  const existing = await getAppSettings();
  const nextSettings = mergeAppSettings({
    company: {
      ...existing.company,
      ...normalizeCompany(input.company),
    },
    portal: {
      ...existing.portal,
      ...normalizePortal(input.portal),
    },
    updatedAt: new Date().toISOString(),
  });

  if (!nextSettings.company.companyName) {
    throw new Error("Company name is required.");
  }
  if (!nextSettings.portal.clientPortalDescription) {
    throw new Error("Client portal description is required.");
  }
  if (!nextSettings.portal.footerCtaTitle) {
    throw new Error("Footer CTA title is required.");
  }

  if (supabase) {
    const { error } = await supabase.from("app_settings").upsert(
      {
        id: SETTINGS_ROW_ID,
        company: nextSettings.company,
        portal: nextSettings.portal,
        updated_at: nextSettings.updatedAt,
      },
      { onConflict: "id" }
    );
    if (error) throw error;
    return nextSettings;
  }

  await writeFallbackSettings(nextSettings);
  return nextSettings;
}

export function getDisplayCompanyName(settings: Pick<AppSettings, "company">) {
  return settings.company.displayName?.trim() || settings.company.companyName;
}
