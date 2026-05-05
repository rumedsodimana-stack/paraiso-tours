import { NextResponse } from "next/server";

/**
 * Read-only status check for the social platform OAuth credentials
 * required by the future auto-publishing pipeline. Used by the
 * /admin/settings → Marketing section to render live "Connected /
 * Not configured" pills per platform.
 *
 * Returns booleans only — never leaks the actual credential values.
 *
 * Note on v1 scope: the marketing agent currently emits drafts that
 * admin copy-pastes manually. Filling in these env vars does NOT
 * automatically enable direct posting — that pipeline is a future
 * project. The env vars are documented + status-checked here so
 * admin can prepare the credentials ahead of time.
 */
export async function GET() {
  // Meta covers Instagram + Facebook with one set of OAuth creds
  // (Meta App + Page Access Token + Instagram Business Account ID).
  const metaConfigured =
    !!process.env.META_APP_ID?.trim() &&
    !!process.env.META_APP_SECRET?.trim() &&
    !!process.env.META_PAGE_ACCESS_TOKEN?.trim();
  const instagramConfigured =
    metaConfigured && !!process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim();

  // X (Twitter) API v2 — either OAuth 1.0a (4 keys) or OAuth 2.0
  // bearer token suffices for posting on behalf of the brand
  // account. Treating either as configured.
  const xOAuth1 =
    !!process.env.TWITTER_API_KEY?.trim() &&
    !!process.env.TWITTER_API_SECRET?.trim() &&
    !!process.env.TWITTER_ACCESS_TOKEN?.trim() &&
    !!process.env.TWITTER_ACCESS_SECRET?.trim();
  const xOAuth2 = !!process.env.TWITTER_BEARER_TOKEN?.trim();
  const xConfigured = xOAuth1 || xOAuth2;

  // LinkedIn org-page posting — OAuth 2.0 client + refresh token
  // + the org URN that identifies which company page to post to.
  const linkedinConfigured =
    !!process.env.LINKEDIN_CLIENT_ID?.trim() &&
    !!process.env.LINKEDIN_CLIENT_SECRET?.trim() &&
    !!process.env.LINKEDIN_ACCESS_TOKEN?.trim() &&
    !!process.env.LINKEDIN_ORGANIZATION_URN?.trim();

  return NextResponse.json({
    instagram: instagramConfigured,
    facebook: metaConfigured,
    x: xConfigured,
    linkedin: linkedinConfigured,
  });
}
