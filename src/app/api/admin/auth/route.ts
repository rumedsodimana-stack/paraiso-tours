import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
} from "@/lib/admin-session";
import { verifyAdminPassword } from "@/lib/settings";
import { authLogger } from "@/lib/logger";

/* ------------------------------------------------------------------ */
/*  In-memory rate limiting: max 5 attempts per IP per 15 minutes     */
/* ------------------------------------------------------------------ */

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const attempts = new Map<string, { count: number; resetAt: number }>();

function getRateLimitEntry(ip: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  entry.count++;

  if (entry.count > RATE_LIMIT_MAX) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

function resetRateLimit(ip: string): void {
  attempts.delete(ip);
}

/* Periodic cleanup of stale entries (every 5 minutes) */
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of attempts) {
    if (now > entry.resetAt) {
      attempts.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref?.();

/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  /* --- Rate limit check --- */
  const rateLimit = getRateLimitEntry(ip);
  if (!rateLimit.allowed) {
    authLogger.warn("Rate limit exceeded", { ip });
    return NextResponse.json(
      { ok: false, error: "Too many login attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  try {
    const { password } = await request.json();

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { ok: false, error: "Password required" },
        { status: 400 }
      );
    }

    const valid = await verifyAdminPassword(password);
    if (!valid) {
      authLogger.warn("Login failed: invalid password", { ip });
      return NextResponse.json(
        { ok: false, error: "Invalid password" },
        { status: 401 }
      );
    }

    /* Successful login — reset rate limit counter for this IP */
    resetRateLimit(ip);

    authLogger.info("Admin login successful", { ip });
    const response = NextResponse.json({
      ok: true,
    });
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: await createAdminSessionToken(),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (err) {
    authLogger.error("Auth API error", {}, err);
    return NextResponse.json(
      { ok: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}
