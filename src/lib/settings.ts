import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { createHash, scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { authLogger } from "./logger";

const scryptAsync = promisify(scrypt);

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = "settings.json";
const IS_VERCEL = process.env.VERCEL === "1";

/* ------------------------------------------------------------------ */
/*  Legacy SHA-256 hashing (read-only, for backward compatibility)    */
/* ------------------------------------------------------------------ */

function hashPasswordLegacy(password: string): string {
  return createHash("sha256").update(password + "paraiso-salt").digest("hex");
}

/**
 * Check if a stored hash uses the legacy SHA-256 format.
 * Scrypt hashes contain a ":" separator (salt:derived); SHA-256 hex does not.
 */
function isLegacyHash(hash: string): boolean {
  return !hash.includes(":");
}

/* ------------------------------------------------------------------ */
/*  Scrypt-based hashing (new standard)                               */
/* ------------------------------------------------------------------ */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPasswordHash(
  password: string,
  hash: string
): Promise<boolean> {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const keyBuffer = Buffer.from(key, "hex");
  if (derived.length !== keyBuffer.length) return false;
  return timingSafeEqual(derived, keyBuffer);
}

export interface AdminSettings {
  adminPasswordHash?: string;
  updatedAt?: string;
}

let memorySettings: AdminSettings | null = null;

async function ensureDataDir() {
  if (IS_VERCEL) return;
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch {
    // dir exists
  }
}

async function readSettings(): Promise<AdminSettings> {
  if (IS_VERCEL) {
    return memorySettings || {};
  }
  try {
    await ensureDataDir();
    const filePath = path.join(DATA_DIR, SETTINGS_FILE);
    const data = await readFile(filePath, "utf-8");
    return JSON.parse(data) as AdminSettings;
  } catch {
    return {};
  }
}

async function writeSettings(settings: AdminSettings): Promise<void> {
  if (IS_VERCEL) {
    memorySettings = { ...settings, updatedAt: new Date().toISOString() };
    authLogger.warn("Settings change on Vercel: stored in memory only");
    return;
  }
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, SETTINGS_FILE);
  await writeFile(filePath, JSON.stringify(settings, null, 2), "utf-8");
}

/**
 * Verify admin password. Returns true if correct.
 *
 * Supports three modes:
 * 1. ADMIN_PASSWORD env var (plain-text comparison via timingSafeEqual)
 * 2. Stored hash — either legacy SHA-256 or new scrypt format
 * 3. Hard-coded default fallback (admin123) — only if nothing else is configured
 *
 * On successful verification of a legacy SHA-256 hash, automatically
 * re-hashes with scrypt so subsequent logins use the stronger algorithm.
 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const envPassword = process.env.ADMIN_PASSWORD?.trim();
  if (envPassword) {
    try {
      const a = Buffer.from(password, "utf-8");
      const b = Buffer.from(envPassword, "utf-8");
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  const settings = await readSettings();
  if (settings.adminPasswordHash) {
    if (isLegacyHash(settings.adminPasswordHash)) {
      // Legacy SHA-256 verification
      const legacyHash = hashPasswordLegacy(password);
      try {
        const a = Buffer.from(legacyHash, "utf-8");
        const b = Buffer.from(settings.adminPasswordHash, "utf-8");
        if (a.length !== b.length) return false;
        const match = timingSafeEqual(a, b);
        if (match) {
          // Re-hash with scrypt for future logins
          authLogger.info("Upgrading legacy SHA-256 hash to scrypt");
          const upgraded = await hashPassword(password);
          await writeSettings({
            adminPasswordHash: upgraded,
            updatedAt: new Date().toISOString(),
          });
        }
        return match;
      } catch {
        return false;
      }
    }

    // New scrypt verification
    return verifyPasswordHash(password, settings.adminPasswordHash);
  }

  return password === "admin123";
}

/* ------------------------------------------------------------------ */
/*  Password strength validation                                      */
/* ------------------------------------------------------------------ */

const COMMON_PASSWORDS = new Set([
  "password", "12345678", "123456789", "1234567890", "qwerty123",
  "password1", "admin123", "letmein1", "welcome1", "changeme",
  "iloveyou", "sunshine1", "princess1", "football1", "monkey123",
  "master123", "dragon123", "abc12345", "trustno1", "baseball1",
  "passw0rd", "p@ssw0rd", "p@ssword", "password123", "admin1234",
]);

export function validatePasswordStrength(
  password: string
): { ok: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { ok: false, error: "Password must contain at least one letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, error: "Password must contain at least one number" };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, error: "This password is too common. Please choose a stronger one." };
  }
  return { ok: true };
}

/**
 * Check whether the current password setup is still the hard-coded default.
 *
 * Returns true when:
 * - No ADMIN_PASSWORD env var is set, AND
 * - No custom hash has been stored in settings.json (i.e. still falling back
 *   to the hard-coded "admin123" comparison in verifyAdminPassword).
 */
export async function isDefaultPassword(): Promise<boolean> {
  // If an env var overrides the password, the default is not in use.
  if (process.env.ADMIN_PASSWORD?.trim()) return false;

  const settings = await readSettings();
  // A stored hash means the admin has changed the password at some point.
  if (settings.adminPasswordHash) return false;

  // No env var and no stored hash → still using the hard-coded "admin123".
  return true;
}

/**
 * Change admin password. Requires current password verification.
 * On Vercel: cannot persist to disk; returns error instructing to use env var.
 */
export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const verified = await verifyAdminPassword(currentPassword);
  if (!verified) {
    authLogger.warn("Change password failed: invalid current password");
    return { ok: false, error: "Current password is incorrect" };
  }

  const strength = validatePasswordStrength(newPassword);
  if (!strength.ok) {
    return { ok: false, error: strength.error };
  }

  if (IS_VERCEL) {
    authLogger.info("Password change requested on Vercel - cannot persist");
    return {
      ok: false,
      error: "On Vercel, set ADMIN_PASSWORD in Project Settings → Environment Variables. Password cannot be changed from UI.",
    };
  }

  const hash = await hashPassword(newPassword);
  await writeSettings({ adminPasswordHash: hash, updatedAt: new Date().toISOString() });
  authLogger.info("Admin password changed successfully");
  return { ok: true };
}
