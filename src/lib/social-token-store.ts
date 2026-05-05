/**
 * Server-side store for the encrypted OAuth tokens that the social
 * publish pipeline uses. NEVER import this module from a client
 * component — the decryptToken call returns plaintext access tokens.
 *
 * Backed by the `social_oauth_tokens` Supabase table. Falls back to
 * an in-memory map for local development when supabase isn't
 * configured (development tokens never persist past a process
 * restart, which is the right behaviour for dev hygiene anyway).
 */

import { supabase } from "./supabase";
import {
  decryptToken,
  encryptToken,
} from "./social-token-crypto";
import type {
  SocialConnectedPlatform,
  SocialOAuthToken,
} from "./types";

interface PersistInput {
  platform: SocialConnectedPlatform;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  metadata?: Record<string, string>;
}

const memoryStore = new Map<SocialConnectedPlatform, SocialOAuthToken>();

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Encrypt + persist a freshly-acquired token set. Replaces any
 * existing row for the same platform (one row per platform). Throws
 * on encryption failure so the caller can route the error back to
 * the OAuth callback page rather than silently storing nothing.
 */
export async function saveSocialToken(input: PersistInput): Promise<void> {
  const accessCt = encryptToken(input.accessToken);
  const refreshCt = input.refreshToken
    ? encryptToken(input.refreshToken)
    : null;
  const now = nowIso();

  if (supabase) {
    const { error } = await supabase
      .from("social_oauth_tokens")
      .upsert(
        {
          platform: input.platform,
          access_token_ct: accessCt,
          refresh_token_ct: refreshCt,
          expires_at: input.expiresAt ?? null,
          metadata: input.metadata ?? {},
          updated_at: now,
        },
        { onConflict: "platform" }
      );
    if (error) throw new Error(`Token save failed: ${error.message}`);
  }

  memoryStore.set(input.platform, {
    id: input.platform,
    platform: input.platform,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    expiresAt: input.expiresAt,
    metadata: input.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Load + decrypt the saved token for a platform. Returns null if
 * the platform isn't connected, the row is missing required fields,
 * or decryption fails (e.g. APP_SETTINGS_SECRET rotated since the
 * row was written — operator must reconnect).
 */
export async function loadSocialToken(
  platform: SocialConnectedPlatform
): Promise<SocialOAuthToken | null> {
  // In-memory cache hit (warm process)
  const cached = memoryStore.get(platform);
  if (cached) return cached;

  if (!supabase) return null;
  const { data, error } = await supabase
    .from("social_oauth_tokens")
    .select("*")
    .eq("platform", platform)
    .maybeSingle();
  if (error || !data) return null;

  const accessToken = decryptToken(data.access_token_ct as string);
  if (!accessToken) return null; // ciphertext present but undecodable

  const refreshToken = data.refresh_token_ct
    ? (decryptToken(data.refresh_token_ct as string) ?? undefined)
    : undefined;

  const decoded: SocialOAuthToken = {
    id: platform,
    platform,
    accessToken,
    refreshToken,
    expiresAt: (data.expires_at as string | null) ?? undefined,
    metadata:
      (data.metadata as Record<string, string> | null) ?? {},
    createdAt: String(data.created_at ?? nowIso()),
    updatedAt: String(data.updated_at ?? nowIso()),
  };
  memoryStore.set(platform, decoded);
  return decoded;
}

/**
 * Disconnect a platform. Wipes both the DB row + the in-memory
 * cache so subsequent loads return null.
 */
export async function deleteSocialToken(
  platform: SocialConnectedPlatform
): Promise<void> {
  if (supabase) {
    await supabase
      .from("social_oauth_tokens")
      .delete()
      .eq("platform", platform);
  }
  memoryStore.delete(platform);
}

/**
 * Lightweight presence check — returns the set of platforms that
 * currently have a saved token. Used by the marketing settings
 * panel to render connection chips without leaking token bytes.
 */
export async function listConnectedSocialPlatforms(): Promise<
  SocialConnectedPlatform[]
> {
  // Memory-store fast path covers warm processes; cold processes
  // miss in-memory but the supabase fallback below still works.
  if (memoryStore.size > 0) {
    return [...memoryStore.keys()];
  }
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("social_oauth_tokens")
    .select("platform");
  if (error || !data) return [];
  return data
    .map((r) => r.platform as SocialConnectedPlatform)
    .filter((p) => p === "meta" || p === "x" || p === "linkedin");
}
