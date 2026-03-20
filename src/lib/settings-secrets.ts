import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const SETTINGS_SECRET_SALT = "paraiso-app-settings-v1";
const INSECURE_FALLBACK_SECRET = "paraiso-admin-session-change-me";

function getSettingsSecret() {
  const secret =
    process.env.APP_SETTINGS_SECRET?.trim() ||
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.ADMIN_PASSWORD?.trim() ||
    "";

  if (!secret || secret === INSECURE_FALLBACK_SECRET) {
    throw new Error(
      "Set APP_SETTINGS_SECRET or ADMIN_SESSION_SECRET before saving private API keys in settings."
    );
  }

  return secret;
}

function deriveEncryptionKey() {
  return scryptSync(getSettingsSecret(), SETTINGS_SECRET_SALT, 32);
}

export function encryptStoredSecret(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const key = deriveEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(trimmed, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptStoredSecret(payload?: string | null) {
  const trimmed = payload?.trim();
  if (!trimmed) return "";

  const [version, ivPart, authTagPart, encryptedPart, ...rest] = trimmed.split(".");
  if (
    version !== "v1" ||
    !ivPart ||
    !authTagPart ||
    !encryptedPart ||
    rest.length > 0
  ) {
    throw new Error("Saved AI API key has an invalid format.");
  }

  const key = deriveEncryptionKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivPart, "base64url")
  );
  decipher.setAuthTag(Buffer.from(authTagPart, "base64url"));

  try {
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, "base64url")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8").trim();
  } catch {
    throw new Error(
      "Saved AI API key could not be decrypted. Check APP_SETTINGS_SECRET or ADMIN_SESSION_SECRET."
    );
  }
}
