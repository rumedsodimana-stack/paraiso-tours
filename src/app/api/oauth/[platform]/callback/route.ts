/**
 * OAuth 2.0 callback route. Exchanges the authorization code for a
 * token set, fetches platform-specific metadata (page id, IG biz
 * account id, LinkedIn org URN), encrypts everything, persists.
 *
 * GET /api/oauth/{meta|x|linkedin}/callback?code=...&state=...
 *
 * On success → 302 to /admin/settings?section=marketing&connected=<platform>
 * On any failure → 302 to /admin/settings?section=marketing&marketing_error=<reason>
 *
 * Each branch records the relevant detail so admin sees what
 * actually happened. Token bytes never appear in URLs or audit
 * events — only the platform name + non-secret metadata.
 */

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/admin-session";
import { recordAuditEvent } from "@/lib/audit";
import {
  getOAuthConfig,
  redirectUriFor,
} from "@/lib/social-oauth-config";
import {
  decryptToken,
  verifyOAuthState,
} from "@/lib/social-token-crypto";
import { saveSocialToken } from "@/lib/social-token-store";
import { debugLog } from "@/lib/debug";
import type { SocialConnectedPlatform } from "@/lib/types";

const PKCE_COOKIE = "social_oauth_pkce_v";

function back(
  baseUrl: string,
  query: Record<string, string>
): NextResponse {
  const url = new URL("/admin/settings?section=marketing", baseUrl);
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url, { status: 302 });
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

async function exchangeCodeForToken(opts: {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  pkceVerifier?: string;
  /** Some platforms (X) want HTTP Basic auth; others (Meta) use form-urlencoded body. */
  authStyle: "basic" | "body";
}): Promise<TokenResponse | { error: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
  });
  if (opts.authStyle === "body") {
    body.set("client_id", opts.clientId);
    body.set("client_secret", opts.clientSecret);
  }
  if (opts.pkceVerifier) {
    body.set("code_verifier", opts.pkceVerifier);
    // X requires client_id in the body even with Basic auth.
    body.set("client_id", opts.clientId);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (opts.authStyle === "basic") {
    headers["Authorization"] =
      "Basic " +
      Buffer.from(`${opts.clientId}:${opts.clientSecret}`).toString("base64");
  }

  try {
    const r = await fetch(opts.tokenUrl, {
      method: "POST",
      headers,
      body: body.toString(),
    });
    const text = await r.text();
    if (!r.ok) {
      return {
        error: `Token exchange failed (${r.status}): ${text.slice(0, 400)}`,
      };
    }
    try {
      return JSON.parse(text) as TokenResponse;
    } catch {
      // Meta sometimes returns access_token=...&expires=... as a
      // raw query string body — fall back to URLSearchParams.
      const parsed = new URLSearchParams(text);
      const accessToken = parsed.get("access_token");
      if (!accessToken) {
        return {
          error: `Token endpoint returned non-JSON: ${text.slice(0, 200)}`,
        };
      }
      return {
        access_token: accessToken,
        expires_in: Number(parsed.get("expires") ?? 0) || undefined,
        token_type: parsed.get("token_type") ?? undefined,
      };
    }
  } catch (err) {
    return {
      error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Per-platform metadata fetch — runs after the access token is in
 * hand. Returns the metadata blob to store + a friendly summary
 * the audit event can render. Best-effort: failure here doesn't
 * void the connection, just leaves metadata sparse and surfaces a
 * warning.
 */
async function fetchMetaMetadata(
  accessToken: string
): Promise<{ metadata: Record<string, string>; warning?: string }> {
  try {
    // /me/accounts returns FB pages the admin manages.
    const r = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(accessToken)}`
    );
    const data = (await r.json()) as {
      data?: Array<{
        id: string;
        name: string;
        access_token?: string;
        instagram_business_account?: { id: string };
      }>;
      error?: { message?: string };
    };
    if (data.error) {
      return {
        metadata: {},
        warning: `Meta /me/accounts: ${data.error.message ?? "unknown error"}`,
      };
    }
    const page = data.data?.[0];
    if (!page) {
      return {
        metadata: {},
        warning:
          "No Facebook Pages accessible by this user — connect a page first.",
      };
    }
    return {
      metadata: {
        page_id: page.id,
        page_name: page.name,
        // Page access token (long-lived) is what we'll use for posting.
        // Replaces the user token we received from OAuth.
        page_access_token: page.access_token ?? "",
        instagram_business_account_id:
          page.instagram_business_account?.id ?? "",
      },
    };
  } catch (err) {
    return {
      metadata: {},
      warning:
        err instanceof Error
          ? `Meta metadata fetch threw: ${err.message}`
          : "Meta metadata fetch failed",
    };
  }
}

async function fetchXMetadata(
  accessToken: string
): Promise<{ metadata: Record<string, string>; warning?: string }> {
  try {
    const r = await fetch("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await r.json()) as {
      data?: { id: string; username: string; name: string };
      errors?: Array<{ detail?: string }>;
    };
    if (data.errors) {
      return {
        metadata: {},
        warning: `X /users/me: ${data.errors[0]?.detail ?? "unknown error"}`,
      };
    }
    if (!data.data) {
      return { metadata: {}, warning: "X /users/me returned no data." };
    }
    return {
      metadata: {
        user_id: data.data.id,
        username: data.data.username,
        display_name: data.data.name,
      },
    };
  } catch (err) {
    return {
      metadata: {},
      warning:
        err instanceof Error ? `X metadata fetch threw: ${err.message}` : "X metadata fetch failed",
    };
  }
}

async function fetchLinkedInMetadata(
  accessToken: string
): Promise<{ metadata: Record<string, string>; warning?: string }> {
  try {
    // /v2/userinfo (OpenID Connect) returns sub + name + email.
    const userinfo = await fetch(
      "https://api.linkedin.com/v2/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const userinfoData = (await userinfo.json()) as {
      sub?: string;
      name?: string;
      email?: string;
      message?: string;
    };
    if (userinfoData.message && !userinfoData.sub) {
      return {
        metadata: {},
        warning: `LinkedIn /userinfo: ${userinfoData.message}`,
      };
    }
    const personUrn = userinfoData.sub
      ? `urn:li:person:${userinfoData.sub}`
      : "";

    // Try to find a company page the user has admin access to.
    let organizationUrn = "";
    let organizationName = "";
    try {
      const orgs = await fetch(
        "https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(localizedName,vanityName)))",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const orgsData = (await orgs.json()) as {
        elements?: Array<{
          organization?: string;
          ["organization~"]?: {
            localizedName?: string;
            vanityName?: string;
          };
        }>;
      };
      const first = orgsData.elements?.[0];
      if (first?.organization) {
        organizationUrn = first.organization;
        organizationName = first["organization~"]?.localizedName ?? "";
      }
    } catch {
      // Org lookup optional — admin may only post as a person.
    }

    return {
      metadata: {
        person_urn: personUrn,
        person_name: userinfoData.name ?? "",
        person_email: userinfoData.email ?? "",
        organization_urn: organizationUrn,
        organization_name: organizationName,
      },
      warning:
        !organizationUrn
          ? "No company page admin role found — drafts will post as the personal profile."
          : undefined,
    };
  } catch (err) {
    return {
      metadata: {},
      warning:
        err instanceof Error
          ? `LinkedIn metadata fetch threw: ${err.message}`
          : "LinkedIn metadata fetch failed",
    };
  }
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ platform: string }> }
): Promise<NextResponse> {
  const { platform } = await ctx.params;
  const cookieStore = await cookies();
  const session = await verifyAdminSessionToken(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  );
  if (!session) {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("next", "/admin/settings?section=marketing");
    return NextResponse.redirect(url, { status: 302 });
  }

  const cfg = getOAuthConfig(platform);
  if (!cfg) {
    return back(request.url, {
      marketing_error: `Unknown platform in callback: ${platform}`,
    });
  }
  const creds = cfg.readCredentials();
  if (!creds) {
    return back(request.url, {
      marketing_error: `${cfg.label} env vars missing — re-set credentials and retry.`,
    });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    const desc = url.searchParams.get("error_description") ?? oauthError;
    return back(request.url, {
      marketing_error: `${cfg.label} declined: ${desc}`,
    });
  }
  if (!code) {
    return back(request.url, {
      marketing_error: `${cfg.label} callback returned no code.`,
    });
  }
  const claim = verifyOAuthState(state);
  if (!claim || claim.platform !== platform) {
    return back(request.url, {
      marketing_error: `${cfg.label} state token invalid or expired — restart the connection.`,
    });
  }

  // PKCE verifier (X) lives in the encrypted cookie set by /start.
  let pkceVerifier: string | undefined;
  if (cfg.requiresPkce) {
    const ct = cookieStore.get(PKCE_COOKIE)?.value;
    const v = decryptToken(ct);
    if (!v) {
      return back(request.url, {
        marketing_error: `${cfg.label} PKCE verifier missing — restart the connection.`,
      });
    }
    pkceVerifier = v;
  }

  const tokenRes = await exchangeCodeForToken({
    tokenUrl: cfg.tokenUrl,
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    code,
    redirectUri: redirectUriFor(cfg.platform),
    pkceVerifier,
    // X uses HTTP Basic; Meta + LinkedIn want body params.
    authStyle: cfg.platform === "x" ? "basic" : "body",
  });
  if ("error" in tokenRes) {
    debugLog("OAuth token exchange failed", {
      platform,
      error: tokenRes.error,
    });
    return back(request.url, {
      marketing_error: `${cfg.label} token exchange failed: ${tokenRes.error.slice(0, 200)}`,
    });
  }

  // Per-platform metadata fetch.
  let metaResult: { metadata: Record<string, string>; warning?: string } = {
    metadata: {},
  };
  if (cfg.platform === "meta") {
    metaResult = await fetchMetaMetadata(tokenRes.access_token);
  } else if (cfg.platform === "x") {
    metaResult = await fetchXMetadata(tokenRes.access_token);
  } else if (cfg.platform === "linkedin") {
    metaResult = await fetchLinkedInMetadata(tokenRes.access_token);
  }

  // For Meta we prefer the long-lived page access token over the
  // user access token (page tokens don't expire when configured
  // correctly + are required for Pages API + Instagram Content
  // Publishing). Fall back to the user token if the page lookup
  // didn't return one.
  const finalAccess =
    cfg.platform === "meta" && metaResult.metadata.page_access_token
      ? metaResult.metadata.page_access_token
      : tokenRes.access_token;

  // Drop the page_access_token from metadata — it lives in
  // access_token_ct now.
  const cleanMetadata = { ...metaResult.metadata };
  delete cleanMetadata.page_access_token;

  const expiresAt = tokenRes.expires_in
    ? new Date(Date.now() + tokenRes.expires_in * 1000).toISOString()
    : undefined;

  try {
    await saveSocialToken({
      platform: cfg.platform as SocialConnectedPlatform,
      accessToken: finalAccess,
      refreshToken: tokenRes.refresh_token,
      expiresAt,
      metadata: cleanMetadata,
    });
  } catch (err) {
    return back(request.url, {
      marketing_error: `${cfg.label} token save failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // Audit-log under "Admin" actor (admin clicked Connect).
  await recordAuditEvent({
    entityType: "system",
    entityId: `social_oauth_${cfg.platform}`,
    action: "social_connected",
    summary: `${cfg.label} connected for marketing posting`,
    details: Object.entries(cleanMetadata)
      .filter(([, v]) => !!v)
      .map(([k, v]) => `${k}: ${v}`),
    metadata: {
      channel: "marketing",
      platform: cfg.platform,
      ...(metaResult.warning ? { warning: metaResult.warning } : {}),
    },
  });

  // Clear the PKCE cookie post-use.
  const redirect = back(request.url, {
    connected: cfg.platform,
    ...(metaResult.warning ? { warning: metaResult.warning } : {}),
  });
  if (cfg.requiresPkce) {
    redirect.cookies.delete({
      name: PKCE_COOKIE,
      path: `/api/oauth/${platform}`,
    });
  }
  return redirect;
}
