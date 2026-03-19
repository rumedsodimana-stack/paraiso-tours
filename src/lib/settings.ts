import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { createHash, timingSafeEqual } from "crypto";
import { authLogger } from "./logger";

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = "settings.json";
const IS_VERCEL = process.env.VERCEL === "1";

function hashPassword(password: string): string {
  return createHash("sha256").update(password + "paraiso-salt").digest("hex");
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
    const hash = hashPassword(password);
    try {
      const a = Buffer.from(hash, "utf-8");
      const b = Buffer.from(settings.adminPasswordHash, "utf-8");
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  return password === "admin123";
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

  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: "New password must be at least 6 characters" };
  }

  if (IS_VERCEL) {
    authLogger.info("Password change requested on Vercel - cannot persist");
    return {
      ok: false,
      error: "On Vercel, set ADMIN_PASSWORD in Project Settings → Environment Variables. Password cannot be changed from UI.",
    };
  }

  const hash = hashPassword(newPassword);
  await writeSettings({ adminPasswordHash: hash, updatedAt: new Date().toISOString() });
  authLogger.info("Admin password changed successfully");
  return { ok: true };
}
