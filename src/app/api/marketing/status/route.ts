import { NextResponse } from "next/server";
import { listConnectedSocialPlatforms } from "@/lib/social-token-store";
import { getOAuthConfig } from "@/lib/social-oauth-config";

/**
 * Read-only status check for the marketing publish pipeline.
 *
 * Returns two things per platform:
 *   - `envConfigured` — the OAuth client id + secret env vars
 *     are set (admin can attempt to connect).
 *   - `connected` — a token has been saved through the OAuth flow
 *     (admin can publish drafts directly).
 *
 * Returns booleans only — never leaks credential values or tokens.
 */
export async function GET() {
  // Env-var presence checks via the central config table so the
  // route doesn't need to know each platform's variable names.
  const metaCfg = getOAuthConfig("meta");
  const xCfg = getOAuthConfig("x");
  const linkedinCfg = getOAuthConfig("linkedin");

  const metaEnv = !!metaCfg?.readCredentials();
  const xEnv = !!xCfg?.readCredentials();
  const linkedinEnv = !!linkedinCfg?.readCredentials();

  // Connected = token saved in the encrypted store.
  const connected = await listConnectedSocialPlatforms();
  const metaConnected = connected.includes("meta");
  const xConnected = connected.includes("x");
  const linkedinConnected = connected.includes("linkedin");

  return NextResponse.json({
    // Backwards-compat keys (instagram + facebook share Meta).
    instagram: metaConnected,
    facebook: metaConnected,
    x: xConnected,
    linkedin: linkedinConnected,
    // Detailed env vs connected breakdown for the new connect buttons.
    detail: {
      meta: { envConfigured: metaEnv, connected: metaConnected },
      x: { envConfigured: xEnv, connected: xConnected },
      linkedin: { envConfigured: linkedinEnv, connected: linkedinConnected },
    },
  });
}
