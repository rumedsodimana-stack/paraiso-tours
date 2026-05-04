import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isEmailConfigured } from "@/lib/email";

/**
 * Public unauthenticated health-check endpoint for external uptime
 * monitoring (UptimeRobot, Pingdom, BetterUptime, Vercel Monitoring,
 * etc.).
 *
 * Returns 200 with a JSON status object when the site is healthy,
 * 503 when the database is unreachable. Email + WhatsApp config
 * status is included as informational signal — they don't make the
 * endpoint fail because the site can still serve public pages
 * without them.
 *
 * Distinct from `/admin/health` which is the authenticated
 * single-page admin diagnostic with 7 deeper checks. This endpoint
 * is a tiny, machine-readable liveness probe — designed to be
 * pinged every minute by an external monitor.
 *
 * Privacy: deliberately does NOT leak environment variable values,
 * project IDs, deploy commit hashes, or anything an attacker could
 * use to fingerprint the deploy. Just a yes/no status per
 * subsystem.
 */
export async function GET() {
  // Probe the database with a tiny count query. `head: true` keeps
  // the network payload to ~30 bytes. The packages table always
  // exists in any working schema.
  let dbOk = false;
  let dbLatencyMs: number | null = null;
  if (supabase) {
    const t0 = Date.now();
    try {
      const { error } = await supabase
        .from("packages")
        .select("id", { count: "exact", head: true });
      dbOk = !error;
      dbLatencyMs = Date.now() - t0;
    } catch {
      dbOk = false;
      dbLatencyMs = Date.now() - t0;
    }
  }

  const status: "ok" | "degraded" = dbOk ? "ok" : "degraded";
  const httpCode = dbOk ? 200 : 503;

  return NextResponse.json(
    {
      status,
      checks: {
        database: dbOk,
        email: isEmailConfigured(),
      },
      // Latency expressed in milliseconds — useful for trend-tracking
      // tools that graph response times. Null when the probe didn't
      // run (e.g. supabase client not initialised).
      dbLatencyMs,
      // ISO timestamp so monitors can verify the response is fresh
      // (vs. cached upstream).
      timestamp: new Date().toISOString(),
    },
    {
      status: httpCode,
      headers: {
        // No caching — every probe must hit the function so the
        // monitor sees real-time status.
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
