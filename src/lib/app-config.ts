import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { cache } from "react";
import { supabase } from "./supabase";
import type {
  AiProviderKind,
  AiPromptCacheTtl,
  AiSettings,
  AppSettings,
  Company,
  PortalSettings,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = "app-settings.json";
const SECRETS_FILE = "app-secrets.json";
const SETTINGS_ROW_ID = "default";
const SECRETS_ROW_ID = "default";
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
    customJourneyGuidanceFee: 150,
    customJourneyGuidanceLabel: "Route design & local guidance",
    copyrightSuffix: "Sri Lanka",
  },
  ai: {
    enabled: false,
    providerKind: "gemini",
    providerLabel: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash",
    simpleModel: "gemini-2.5-flash-lite",
    defaultModel: "gemini-2.5-flash",
    heavyModel: "gemini-2.5-pro",
    temperature: 0.4,
    maxTokens: 900,
    bookingBriefEnabled: true,
    packageWriterEnabled: true,
    journeyAssistantEnabled: true,
    workspaceCopilotEnabled: true,
    clientConciergeEnabled: true,
    ragEnabled: true,
    ragMaxChunks: 6,
    selfLearningEnabled: true,
    promptCacheEnabled: true,
    promptCacheTtl: "5m",
    dailyBudgetAlertUsd: 2,
    superpowerEnabled: true,
    globalInstructions:
      "Use a practical travel-operations tone. Be concise, concrete, and commercially aware.",
    knowledgeNotes:
      "Favor realistic Sri Lanka routing, supplier-grounded hotel guidance, and transparent commercial recommendations.",
  },
  updatedAt: "2026-03-20T00:00:00.000Z",
};

interface AppSettingsInput {
  company?: Partial<Company>;
  portal?: Partial<PortalSettings>;
  ai?: Partial<AiSettings>;
  updatedAt?: string | null;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

interface AppSecretsInput {
  aiApiKeyEncrypted?: string | null;
  updatedAt?: string | null;
}

function mergeAppSettings(input?: AppSettingsInput | null): AppSettings {
  const merged = {
    company: {
      ...DEFAULT_APP_SETTINGS.company,
      ...(input?.company ?? {}),
    },
    portal: {
      ...DEFAULT_APP_SETTINGS.portal,
      ...(input?.portal ?? {}),
    },
    ai: {
      ...DEFAULT_APP_SETTINGS.ai,
      ...(input?.ai ?? {}),
    },
    updatedAt: input?.updatedAt ?? DEFAULT_APP_SETTINGS.updatedAt,
  };

  return {
    ...merged,
    ai: upgradeLegacyAiSettings(merged.ai, input?.ai),
  };
}

function mergeAppSecrets(input?: AppSecretsInput | null) {
  return {
    aiApiKeyEncrypted: sanitizeText(input?.aiApiKeyEncrypted),
    updatedAt: sanitizeText(input?.updatedAt),
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

async function readFallbackSecrets() {
  if (IS_VERCEL) return mergeAppSecrets();

  try {
    await ensureDataDir();
    const filePath = path.join(DATA_DIR, SECRETS_FILE);
    const data = await readFile(filePath, "utf-8");
    return mergeAppSecrets(JSON.parse(data) as AppSecretsInput);
  } catch {
    return mergeAppSecrets();
  }
}

async function writeFallbackSecrets(input: AppSecretsInput): Promise<void> {
  if (IS_VERCEL) return;

  await ensureDataDir();
  const filePath = path.join(DATA_DIR, SECRETS_FILE);
  const next = mergeAppSecrets(input);
  await writeFile(filePath, JSON.stringify(next, null, 2), "utf-8");
}

function sanitizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function sanitizeNumber(
  value: number | string | null | undefined,
  fallback: number
) {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function sanitizeInteger(
  value: number | string | null | undefined,
  fallback: number
) {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function sanitizeBoolean(value: boolean | string | null | undefined) {
  if (typeof value === "boolean") return value;
  return value === "true" || value === "on" || value === "1";
}

function sanitizeEnum<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  const trimmed = value?.trim() as T | undefined;
  return trimmed && allowed.includes(trimmed) ? trimmed : fallback;
}

function upgradeLegacyAiSettings(
  ai: AiSettings,
  input?: Partial<AiSettings>
): AiSettings {
  const rawProviderKind = input?.providerKind?.trim();
  const providerLabel = ai.providerLabel.trim().toLowerCase();
  const baseUrl = trimTrailingSlash(ai.baseUrl).toLowerCase();
  const model = ai.model.trim().toLowerCase();

  const isLegacyOpenAiDefault =
    !rawProviderKind &&
    providerLabel === "openai-compatible" &&
    baseUrl === "https://api.openai.com/v1" &&
    model === "gpt-4.1-mini";

  if (!isLegacyOpenAiDefault) {
    return ai;
  }

  return {
    ...ai,
    providerKind: "gemini",
    providerLabel: DEFAULT_APP_SETTINGS.ai.providerLabel,
    baseUrl: DEFAULT_APP_SETTINGS.ai.baseUrl,
    model: DEFAULT_APP_SETTINGS.ai.model,
    simpleModel: input?.simpleModel?.trim()
      ? ai.simpleModel
      : DEFAULT_APP_SETTINGS.ai.simpleModel,
    defaultModel: input?.defaultModel?.trim()
      ? ai.defaultModel
      : DEFAULT_APP_SETTINGS.ai.defaultModel,
    heavyModel: input?.heavyModel?.trim()
      ? ai.heavyModel
      : DEFAULT_APP_SETTINGS.ai.heavyModel,
  };
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
    customJourneyGuidanceFee: sanitizeNumber(
      portal.customJourneyGuidanceFee,
      DEFAULT_APP_SETTINGS.portal.customJourneyGuidanceFee
    ),
    customJourneyGuidanceLabel:
      sanitizeText(portal.customJourneyGuidanceLabel) ||
      DEFAULT_APP_SETTINGS.portal.customJourneyGuidanceLabel,
    copyrightSuffix: sanitizeText(portal.copyrightSuffix),
  };
}

function normalizeAi(ai?: Partial<AiSettings>): Partial<AiSettings> {
  if (!ai) return {};

  const providerKind = sanitizeEnum<AiProviderKind>(
    ai.providerKind,
    ["gemini", "openai_compatible", "anthropic"] as const,
    DEFAULT_APP_SETTINGS.ai.providerKind
  );

  return {
    enabled: sanitizeBoolean(ai.enabled),
    providerKind,
    providerLabel:
      sanitizeText(ai.providerLabel) || DEFAULT_APP_SETTINGS.ai.providerLabel,
    baseUrl: sanitizeUrl(ai.baseUrl) || DEFAULT_APP_SETTINGS.ai.baseUrl,
    model:
      sanitizeText(ai.model) ||
      sanitizeText(ai.defaultModel) ||
      DEFAULT_APP_SETTINGS.ai.model,
    simpleModel:
      sanitizeText(ai.simpleModel) || DEFAULT_APP_SETTINGS.ai.simpleModel,
    defaultModel:
      sanitizeText(ai.defaultModel) || DEFAULT_APP_SETTINGS.ai.defaultModel,
    heavyModel:
      sanitizeText(ai.heavyModel) || DEFAULT_APP_SETTINGS.ai.heavyModel,
    temperature: sanitizeNumber(
      ai.temperature,
      DEFAULT_APP_SETTINGS.ai.temperature
    ),
    maxTokens: sanitizeInteger(ai.maxTokens, DEFAULT_APP_SETTINGS.ai.maxTokens),
    bookingBriefEnabled: sanitizeBoolean(ai.bookingBriefEnabled),
    packageWriterEnabled: sanitizeBoolean(ai.packageWriterEnabled),
    journeyAssistantEnabled: sanitizeBoolean(ai.journeyAssistantEnabled),
    workspaceCopilotEnabled: sanitizeBoolean(ai.workspaceCopilotEnabled),
    clientConciergeEnabled: sanitizeBoolean(ai.clientConciergeEnabled),
    ragEnabled: sanitizeBoolean(ai.ragEnabled),
    ragMaxChunks: sanitizeInteger(
      ai.ragMaxChunks,
      DEFAULT_APP_SETTINGS.ai.ragMaxChunks
    ),
    selfLearningEnabled: sanitizeBoolean(ai.selfLearningEnabled),
    promptCacheEnabled: sanitizeBoolean(ai.promptCacheEnabled),
    promptCacheTtl: sanitizeEnum<AiPromptCacheTtl>(
      ai.promptCacheTtl,
      ["5m", "1h"] as const,
      DEFAULT_APP_SETTINGS.ai.promptCacheTtl
    ),
    dailyBudgetAlertUsd: sanitizeNumber(
      ai.dailyBudgetAlertUsd,
      DEFAULT_APP_SETTINGS.ai.dailyBudgetAlertUsd
    ),
    superpowerEnabled: sanitizeBoolean(ai.superpowerEnabled),
    globalInstructions:
      sanitizeText(ai.globalInstructions) ||
      DEFAULT_APP_SETTINGS.ai.globalInstructions,
    knowledgeNotes: sanitizeText(ai.knowledgeNotes),
  };
}

const readAppSettings = cache(async (): Promise<AppSettings> => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("company, portal, ai, updated_at")
        .eq("id", SETTINGS_ROW_ID)
        .maybeSingle();

      if (!error && data) {
        return mergeAppSettings({
          company: (data.company as Partial<Company> | null) ?? undefined,
          portal: (data.portal as Partial<PortalSettings> | null) ?? undefined,
          ai: (data.ai as Partial<AiSettings> | null) ?? undefined,
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
  ai?: Partial<AiSettings>;
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
    ai: {
      ...existing.ai,
      ...normalizeAi(input.ai),
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
        ai: nextSettings.ai,
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

export async function getStoredAiApiKeyRecord(): Promise<{
  encryptedKey: string;
  updatedAt?: string;
}> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("app_secrets")
        .select("ai_api_key_encrypted, updated_at")
        .eq("id", SECRETS_ROW_ID)
        .maybeSingle();

      if (!error && data) {
        return {
          encryptedKey: sanitizeText(data.ai_api_key_encrypted as string | null),
          updatedAt: sanitizeText(data.updated_at as string | null) || undefined,
        };
      }
    } catch {
      // fall back to file/defaults
    }
  }

  const fallback = await readFallbackSecrets();
  return {
    encryptedKey: fallback.aiApiKeyEncrypted,
    updatedAt: fallback.updatedAt || undefined,
  };
}

export async function setStoredAiApiKeyRecord(input: {
  encryptedKey: string;
  updatedAt?: string;
}): Promise<void> {
  const next = mergeAppSecrets({
    aiApiKeyEncrypted: input.encryptedKey,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  });

  if (supabase) {
    const { error } = await supabase.from("app_secrets").upsert(
      {
        id: SECRETS_ROW_ID,
        ai_api_key_encrypted: next.aiApiKeyEncrypted,
        updated_at: next.updatedAt || new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) throw error;
    return;
  }

  await writeFallbackSecrets(next);
}

export function getDisplayCompanyName(settings: Pick<AppSettings, "company">) {
  return settings.company.displayName?.trim() || settings.company.companyName;
}
