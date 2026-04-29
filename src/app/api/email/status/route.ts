import { NextResponse } from "next/server";
import { isEmailConfigured } from "@/lib/email";

/**
 * Lightweight read-only status check for the email provider (Resend).
 * Used by /admin/settings → Notifications to render a Connected /
 * Not configured chip without leaking the API key value.
 *
 * Returns:
 *   - `connected: boolean` — true iff RESEND_API_KEY is present
 *   - `fromAddress: string | null` — the configured RESEND_FROM_EMAIL,
 *     or null if not set (in which case Resend defaults to
 *     onboarding@resend.dev, which deliverability-wise is a sandbox)
 */
export async function GET() {
  const connected = isEmailConfigured();
  const fromAddress = process.env.RESEND_FROM_EMAIL?.trim() || null;
  return NextResponse.json({ connected, fromAddress });
}
