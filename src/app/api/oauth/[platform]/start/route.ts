/**
 * OAuth 2.0 start route. Hits the platform's consent screen.
 *
 * GET /api/oauth/{meta|x|linkedin}/start
 *
 * Flow:
 *   1. Admin must be authenticated (302 to /admin/login otherwise)
 *   2. Build a signed state token (HMAC + nonce + iat) so the
 *      callback can verify the request originated here — defends
 *      against CSRF on the redirect-back leg.
 *   3. For PKCE platforms (X), generate a code_verifier, hash it
 *      to S256, attach the challenge to the consent URL, and stash
 *      the verifier in a short-lived encrypted cookie that the
 *      callback reads back.
 *   4. 302 to the platform's authorize URL with redirect_uri,
 *      scope, response_type=code, state, and PKCE if applicable.
 *
 * Errors render at /admin/settings?marketing-error=… so the admin
 * sees a friendly explanation in the same panel they clicked from.
 */

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/admin-session";
import {
  getOAuthConfig,
  redirectUriFor,
} from "@/lib/social-oauth-config";
import {
  encryptToken,
  signOAuthState,
} from "@/lib/social-token-crypto";

const PKCE_COOKIE = "social_oauth_pkce_v";

function settingsErrorRedirect(reason: string, baseUrl: string): NextResponse {
  const url = new URL("/admin/settings?section=marketing", baseUrl);
  url.searchParams.set("marketing_error", reason);
  return NextResponse.redirect(url, { status: 302 });
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
    url.searchParams.set("next", `/api/oauth/${platform}/start`);
    return NextResponse.redirect(url, { status: 302 });
  }

  const cfg = getOAuthConfig(platform);
  if (!cfg) {
    return settingsErrorRedirect(
      `Unknown platform: ${platform}`,
      request.url
    );
  }
  const creds = cfg.readCredentials();
  if (!creds) {
    return settingsErrorRedirect(
      `${cfg.label} env vars are missing — see the Marketing settings panel for the required keys.`,
      request.url
    );
  }

  let state: string;
  try {
    state = signOAuthState({
      nonce: randomBytes(16).toString("hex"),
      platform,
    });
  } catch (err) {
    return settingsErrorRedirect(
      err instanceof Error ? err.message : "OAuth state signing failed",
      request.url
    );
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: creds.clientId,
    redirect_uri: redirectUriFor(cfg.platform),
    scope: cfg.scopes,
    state,
  });

  // PKCE for X — required by Twitter OAuth 2.0.
  const response = NextResponse.redirect(
    `${cfg.authorizeUrl}?${params.toString()}`,
    { status: 302 }
  );
  if (cfg.requiresPkce) {
    const verifier = randomBytes(48).toString("base64url");
    const challenge = createHash("sha256")
      .update(verifier)
      .digest("base64url");
    params.set("code_challenge", challenge);
    params.set("code_challenge_method", "S256");
    let verifierCt: string;
    try {
      verifierCt = encryptToken(verifier);
    } catch (err) {
      return settingsErrorRedirect(
        err instanceof Error ? err.message : "PKCE encryption failed",
        request.url
      );
    }
    // Re-target the redirect with the PKCE-augmented params.
    const reTargeted = NextResponse.redirect(
      `${cfg.authorizeUrl}?${params.toString()}`,
      { status: 302 }
    );
    reTargeted.cookies.set({
      name: PKCE_COOKIE,
      value: verifierCt,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: `/api/oauth/${platform}`,
      maxAge: 600, // 10 min — same TTL as the state token
    });
    return reTargeted;
  }
  return response;
}
