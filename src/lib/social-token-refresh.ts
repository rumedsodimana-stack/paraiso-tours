/**
 * Per-platform OAuth 2.0 token-refresh.
 *
 * X and LinkedIn both issue refresh tokens (X via the `offline.access`
 * scope we requested in the OAuth start, LinkedIn via its standard
 * 3-legged flow). When the access token is close to expiring, the
 * publisher calls `ensureFreshToken()` which inspects expiresAt and,
 * if needed, swaps the refresh_token for a new access_token before
 * the publish attempt.
 *
 * Meta long-lived page access tokens do NOT expire (when generated
 * correctly via the page-token exchange), so refresh is a no-op.
 *
 * If refresh fails, we keep the existing (possibly stale) token so
 * the publish attempt still gets to log a clean failure with the
 * platform's actual error. The /admin/health expiry check will
 * surface the gap on the next render.
 */

import { saveSocialToken, loadSocialToken } from "./social-token-store";
import { getOAuthConfig } from "./social-oauth-config";
import { extractErrorMessage } from "./db";
import { debugLog } from "./debug";
import type {
  SocialConnectedPlatform,
  SocialOAuthToken,
} from "./types";

/** Refresh ahead of expiry by this much — gives a safety window for
 *  publish attempts that might run into the boundary. */
const REFRESH_LEAD_MS = 5 * 60 * 1000;

interface RefreshTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

async function refreshXToken(
  token: SocialOAuthToken
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number } | { error: string }> {
  const cfg = getOAuthConfig("x");
  const creds = cfg?.readCredentials();
  if (!cfg || !creds) {
    return { error: "X OAuth env vars are missing — cannot refresh." };
  }
  if (!token.refreshToken) {
    return { error: "X token has no refresh token saved — admin must reconnect." };
  }
  try {
    const res = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // X requires HTTP Basic auth on token endpoints.
        Authorization:
          "Basic " +
          Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString(
            "base64"
          ),
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
        client_id: creds.clientId,
      }).toString(),
    });
    const text = await res.text();
    if (!res.ok) {
      return { error: `X refresh failed (${res.status}): ${text.slice(0, 300)}` };
    }
    const data = JSON.parse(text) as RefreshTokenResponse;
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    };
  } catch (err) {
    return { error: `X refresh threw: ${extractErrorMessage(err)}` };
  }
}

async function refreshLinkedInToken(
  token: SocialOAuthToken
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number } | { error: string }> {
  const cfg = getOAuthConfig("linkedin");
  const creds = cfg?.readCredentials();
  if (!cfg || !creds) {
    return {
      error: "LinkedIn OAuth env vars are missing — cannot refresh.",
    };
  }
  if (!token.refreshToken) {
    return {
      error: "LinkedIn token has no refresh token — admin must reconnect.",
    };
  }
  try {
    const res = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }).toString(),
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        error: `LinkedIn refresh failed (${res.status}): ${text.slice(0, 300)}`,
      };
    }
    const data = JSON.parse(text) as RefreshTokenResponse;
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    };
  } catch (err) {
    return { error: `LinkedIn refresh threw: ${extractErrorMessage(err)}` };
  }
}

/**
 * Load a token + auto-refresh if it's within REFRESH_LEAD_MS of
 * expiring. Returns the freshest token it can produce. Never throws
 * — refresh failures fall back to the existing token so the caller's
 * publish attempt can still surface the platform-side error.
 *
 * Use this in publishers instead of loadSocialToken directly.
 */
export async function ensureFreshToken(
  platform: SocialConnectedPlatform
): Promise<SocialOAuthToken | null> {
  const token = await loadSocialToken(platform);
  if (!token) return null;

  // Meta page tokens don't expire; nothing to refresh.
  if (platform === "meta") return token;

  // No expiresAt = unknown lifetime; assume valid.
  if (!token.expiresAt) return token;

  const expiresAtMs = new Date(token.expiresAt).getTime();
  if (Number.isNaN(expiresAtMs)) return token;
  const remainingMs = expiresAtMs - Date.now();
  if (remainingMs > REFRESH_LEAD_MS) return token; // still fresh enough

  // Time to refresh.
  const refresh =
    platform === "x"
      ? await refreshXToken(token)
      : platform === "linkedin"
        ? await refreshLinkedInToken(token)
        : { error: "Unsupported platform for refresh" };

  if ("error" in refresh) {
    debugLog("Token refresh failed", { platform, error: refresh.error });
    // Return the stale token so the publisher hits the platform
    // and surfaces the real error. /admin/health will flag the
    // expiry separately on the next render.
    return token;
  }

  // Persist the refreshed token. Some providers rotate the refresh
  // token alongside the access token — preserve whatever they sent
  // back; fall back to the prior refresh token otherwise.
  const newExpiresAt = refresh.expires_in
    ? new Date(Date.now() + refresh.expires_in * 1000).toISOString()
    : undefined;
  try {
    await saveSocialToken({
      platform,
      accessToken: refresh.access_token,
      refreshToken: refresh.refresh_token ?? token.refreshToken,
      expiresAt: newExpiresAt,
      metadata: token.metadata,
    });
  } catch (err) {
    debugLog("Token refresh: save failed", {
      platform,
      error: extractErrorMessage(err),
    });
    // Fall back to the in-memory refreshed token even if persist
    // failed. Next process restart will lose it but that's better
    // than rejecting the current publish attempt.
  }

  return {
    ...token,
    accessToken: refresh.access_token,
    refreshToken: refresh.refresh_token ?? token.refreshToken,
    expiresAt: newExpiresAt,
    updatedAt: new Date().toISOString(),
  };
}
