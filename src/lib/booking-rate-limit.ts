/**
 * Per-email rate limit shared by the public booking endpoints.
 *
 * Without this guard, a bot or accidental submission loop on the
 * public site can:
 *  - exhaust the Resend free-tier daily limit (100/day, 3000/month)
 *  - bloat the leads table and burn DB row quota
 *  - bury real bookings in admin's /admin/bookings inbox
 *  - trigger admin-alert emails to flood the company inbox
 *
 * Strategy: check the existing leads table for recent submissions
 * from the same email. We don't need Redis or a separate rate-limit
 * table for the volume this business sees — counting leads in the
 * last hour by email is plenty.
 *
 * Numbers: 5 bookings per email per hour is the practical ceiling
 * for a legitimate user (e.g. booking different packages at the
 * same time, or correcting a typo + resubmitting). Beyond that, a
 * polite "try again later" is the right behaviour.
 *
 * Limitations:
 *  - Email-based, not IP-based. A determined attacker rotating
 *    emails would slip through. The defense is layered with input
 *    validation and the recordAuditEvent visibility — admin would
 *    see the spam pattern in /admin/bookings within minutes.
 *  - Falls open on DB error: we'd rather accept a legitimate
 *    booking than reject one because of a transient DB blip.
 */

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5;

export interface RateLimitDecision {
  ok: boolean;
  message: string;
}

interface MinimalLead {
  email?: string;
  createdAt?: string;
}

export async function checkPublicBookingRateLimit(opts: {
  email: string;
  /**
   * Injected so callers can pass an already-loaded list (avoiding a
   * second DB hit) or stub it in tests. Production callers pass the
   * `getLeads` import from `@/lib/db`.
   */
  getLeads: () => Promise<MinimalLead[]>;
}): Promise<RateLimitDecision> {
  const targetEmail = opts.email.trim().toLowerCase();
  if (!targetEmail) return { ok: true, message: "" };

  let leads: MinimalLead[];
  try {
    leads = await opts.getLeads();
  } catch {
    // Fall open: a transient DB blip should not silently reject a
    // legitimate guest.
    return { ok: true, message: "" };
  }

  const cutoffMs = Date.now() - RATE_LIMIT_WINDOW_MS;
  let recentCount = 0;
  for (const lead of leads) {
    if ((lead.email ?? "").trim().toLowerCase() !== targetEmail) continue;
    const ts = lead.createdAt ? new Date(lead.createdAt).getTime() : 0;
    if (ts >= cutoffMs) recentCount += 1;
  }

  if (recentCount >= RATE_LIMIT_MAX) {
    return {
      ok: false,
      message:
        "We've received several recent booking requests from this email. Please wait an hour before submitting another, or reply to your earlier email if you need to update your request.",
    };
  }
  return { ok: true, message: "" };
}
