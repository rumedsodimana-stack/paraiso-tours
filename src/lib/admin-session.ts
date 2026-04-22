export const ADMIN_SESSION_COOKIE = "paraiso_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

interface AdminSessionPayload {
  role: "admin";
  issuedAt: number;
  expiresAt: number;
}

/**
 * Returns the HMAC secret used to sign admin session tokens.
 * Throws at runtime if no secret is configured — we never fall back to a
 * hardcoded string, because that would make tokens forgeable in any env
 * that forgot to set ADMIN_SESSION_SECRET or ADMIN_PASSWORD.
 */
function getAdminSessionSecret(): string {
  const secret =
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.ADMIN_PASSWORD?.trim();
  if (!secret) {
    throw new Error(
      "Admin session secret not configured. Set ADMIN_SESSION_SECRET (preferred) " +
        "or ADMIN_PASSWORD in the environment before using admin-session helpers."
    );
  }
  return secret;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function base64UrlEncodeText(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlDecodeText(value: string): string | null {
  try {
    return new TextDecoder().decode(base64UrlToBytes(value));
  } catch {
    return null;
  }
}

async function signValue(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getAdminSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

export function getSafeAdminNextPath(value?: string | null): string {
  if (!value) return "/admin";
  if (!value.startsWith("/")) return "/admin";
  if (value.startsWith("//")) return "/admin";
  if (!value.startsWith("/admin")) return "/admin";
  return value;
}

export async function createAdminSessionToken(): Promise<string> {
  const now = Date.now();
  const payload: AdminSessionPayload = {
    role: "admin",
    issuedAt: now,
    expiresAt: now + ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
  };
  const encodedPayload = base64UrlEncodeText(JSON.stringify(payload));
  const signature = await signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * Admin-session guard for server actions. Call at the top of every
 * admin-mutating action. Throws if no valid admin session cookie.
 *
 * Usage:
 *   "use server";
 *   import { requireAdmin } from "@/lib/admin-session";
 *   export async function someAction(...) {
 *     await requireAdmin();
 *     // ... mutation
 *   }
 */
export async function requireAdmin(): Promise<void> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifyAdminSessionToken(token);
  if (!session) {
    throw new Error("Unauthorized — admin session required.");
  }
}

export async function verifyAdminSessionToken(
  token?: string | null
): Promise<AdminSessionPayload | null> {
  if (!token) return null;

  const [encodedPayload, signature, ...rest] = token.split(".");
  if (!encodedPayload || !signature || rest.length > 0) return null;

  const expectedSignature = await signValue(encodedPayload);
  if (!constantTimeEqual(signature, expectedSignature)) return null;

  const decodedPayload = base64UrlDecodeText(encodedPayload);
  if (!decodedPayload) return null;

  try {
    const payload = JSON.parse(decodedPayload) as Partial<AdminSessionPayload>;
    if (payload.role !== "admin") return null;
    if (typeof payload.issuedAt !== "number") return null;
    if (typeof payload.expiresAt !== "number") return null;
    if (payload.expiresAt <= Date.now()) return null;
    return payload as AdminSessionPayload;
  } catch {
    return null;
  }
}
