/**
 * Per-platform OAuth 2.0 configuration. The start + callback routes
 * read from this table so adding a 4th platform (Pinterest, TikTok)
 * is a one-block append rather than a routing change.
 *
 * Each platform's `clientId`/`clientSecret` come from env vars set
 * by the operator. Their absence is what makes the "Connect"
 * button refuse to redirect — the start route surfaces a friendly
 * error rather than a half-broken consent URL.
 *
 * The `redirectUri` is computed from NEXT_PUBLIC_APP_URL so the
 * same code path works in dev (http://localhost:3000), preview
 * deploys, and production.
 */

import type { SocialConnectedPlatform } from "./types";

export interface OAuthPlatformConfig {
  platform: SocialConnectedPlatform;
  /** Display label used in error messages. */
  label: string;
  /** Where to redirect the admin to consent. */
  authorizeUrl: string;
  /** OAuth 2.0 token-exchange endpoint. */
  tokenUrl: string;
  /** Space-separated scopes requested. */
  scopes: string;
  /** True if this platform requires PKCE (X). */
  requiresPkce: boolean;
  /** Reads env vars for client id + secret. Returns null when
   *  unconfigured so the start route can short-circuit politely. */
  readCredentials(): { clientId: string; clientSecret: string } | null;
}

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000"
  );
}

export function redirectUriFor(platform: SocialConnectedPlatform): string {
  return `${appBaseUrl()}/api/oauth/${platform}/callback`;
}

const META: OAuthPlatformConfig = {
  platform: "meta",
  label: "Meta (Facebook + Instagram)",
  // Facebook Login dialog — Instagram Business posting flows through
  // the linked Facebook Page so a single Meta OAuth covers both.
  authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
  tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
  // Scopes for posting to Facebook Page + Instagram Business:
  //   pages_show_list           — list pages the admin manages
  //   pages_read_engagement     — read page details
  //   pages_manage_posts        — publish to Facebook page
  //   instagram_basic           — read IG account
  //   instagram_content_publish — publish to IG via Graph API
  //   business_management       — required for IG-FB linkage lookup
  scopes:
    "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,business_management",
  requiresPkce: false,
  readCredentials() {
    const id = process.env.META_APP_ID?.trim();
    const secret = process.env.META_APP_SECRET?.trim();
    if (!id || !secret) return null;
    return { clientId: id, clientSecret: secret };
  },
};

const X: OAuthPlatformConfig = {
  platform: "x",
  label: "X (Twitter)",
  authorizeUrl: "https://twitter.com/i/oauth2/authorize",
  tokenUrl: "https://api.twitter.com/2/oauth2/token",
  // tweet.read + tweet.write for posting; users.read for /users/me
  // lookup so we can stash the username in metadata; offline.access
  // for refresh tokens.
  scopes: "tweet.read tweet.write users.read offline.access",
  requiresPkce: true,
  readCredentials() {
    const id = process.env.TWITTER_OAUTH2_CLIENT_ID?.trim();
    const secret = process.env.TWITTER_OAUTH2_CLIENT_SECRET?.trim();
    if (!id || !secret) return null;
    return { clientId: id, clientSecret: secret };
  },
};

const LINKEDIN: OAuthPlatformConfig = {
  platform: "linkedin",
  label: "LinkedIn",
  authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
  tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
  // openid + profile + email for /userinfo lookup;
  // w_member_social for personal posts;
  // r_organization_social + w_organization_social for company-page
  // posts (admin still has to be a verified page admin).
  scopes:
    "openid profile email w_member_social r_organization_social w_organization_social",
  requiresPkce: false,
  readCredentials() {
    const id = process.env.LINKEDIN_CLIENT_ID?.trim();
    const secret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
    if (!id || !secret) return null;
    return { clientId: id, clientSecret: secret };
  },
};

export const OAUTH_PLATFORMS: Record<
  SocialConnectedPlatform,
  OAuthPlatformConfig
> = {
  meta: META,
  x: X,
  linkedin: LINKEDIN,
};

export function getOAuthConfig(
  platform: string
): OAuthPlatformConfig | null {
  if (platform === "meta") return META;
  if (platform === "x") return X;
  if (platform === "linkedin") return LINKEDIN;
  return null;
}
