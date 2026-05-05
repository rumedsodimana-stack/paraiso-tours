/**
 * Symmetric encryption for OAuth access + refresh tokens stored in
 * the `social_oauth_tokens` table. Uses AES-256-GCM keyed by an env
 * var — SAME secret as `APP_SETTINGS_SECRET` so the operator
 * doesn't have to manage another rotation cycle, but kept separate
 * via a domain salt so a leak of one ciphertext bucket doesn't
 * compromise the other.
 *
 * Encrypt format (base64):
 *   <iv (12 bytes)><authTag (16 bytes)><ciphertext (n bytes)>
 *
 * Why a salt: HKDF the env-var bytes with a literal "social_oauth"
 * domain string so the key for THIS module differs from the key
 * APP_SETTINGS_SECRET produces for other domains, even if the env
 * var is shared. Cheap defence against cross-domain replay.
 *
 * Failure mode: if no secret is configured we throw on encrypt and
 * return null on decrypt — this is intentional, since storing
 * plaintext tokens in the DB by accident would be worse than the
 * caller seeing "platform not connected" until they fix the config.
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // GCM standard
const TAG_LEN = 16;
const KEY_LEN = 32; // AES-256

let cachedKey: Buffer | null = null;

function deriveKey(): Buffer | null {
  if (cachedKey) return cachedKey;
  const secret = process.env.APP_SETTINGS_SECRET?.trim();
  if (!secret) return null;
  // HKDF with a fixed domain salt so this key differs from any
  // other key derived from the same env var.
  const ikm = Buffer.from(secret, "utf8");
  const salt = Buffer.from("paraiso-social-oauth-v1", "utf8");
  const info = Buffer.from("social_oauth_token_encryption", "utf8");
  const derived = hkdfSync("sha256", ikm, salt, info, KEY_LEN);
  cachedKey = Buffer.from(derived);
  return cachedKey;
}

/**
 * Encrypts a plaintext token. Returns base64 ciphertext or throws
 * if no secret is configured (call sites should bail out cleanly
 * before attempting to persist).
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) return "";
  const key = deriveKey();
  if (!key) {
    throw new Error(
      "APP_SETTINGS_SECRET is not configured — cannot store OAuth tokens encrypted. Set the env var in Vercel before connecting a platform."
    );
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

/**
 * Decrypts a base64 ciphertext. Returns null on any failure
 * (no secret, malformed input, auth tag mismatch, missing input)
 * so the calling publisher cleanly degrades to "platform not
 * connected" rather than crashing.
 */
export function decryptToken(b64: string | null | undefined): string | null {
  if (!b64) return null;
  const key = deriveKey();
  if (!key) return null;
  try {
    const buf = Buffer.from(b64, "base64");
    if (buf.length < IV_LEN + TAG_LEN + 1) return null;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ct = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Constant-time HMAC-style state-token signer used to validate the
 * `state` parameter in OAuth flows (defends against CSRF on the
 * callback). Different from encryption — state is just signed +
 * carries a random nonce + a redirect path. Verifier checks the
 * HMAC matches and the nonce hasn't expired.
 *
 * Lives here to keep all OAuth-adjacent crypto in one file.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

interface OAuthStateClaim {
  /** Random nonce generated on /start, verified on /callback. */
  nonce: string;
  /** ms timestamp issued at. State is rejected if older than 10 min. */
  iat: number;
  /** Platform identifier. */
  platform: string;
  /** Optional redirect path the callback should bounce to. */
  redirect?: string;
}

const STATE_TTL_MS = 10 * 60 * 1000;

export function signOAuthState(claim: Omit<OAuthStateClaim, "iat">): string {
  const key = deriveKey();
  if (!key) {
    throw new Error(
      "APP_SETTINGS_SECRET is not configured — cannot sign OAuth state."
    );
  }
  const full: OAuthStateClaim = { ...claim, iat: Date.now() };
  const payload = Buffer.from(JSON.stringify(full)).toString("base64url");
  const sig = createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyOAuthState(state: string | null | undefined): OAuthStateClaim | null {
  if (!state) return null;
  const key = deriveKey();
  if (!key) return null;
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = createHmac("sha256", key).update(payload).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;
  try {
    const claim = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as OAuthStateClaim;
    if (Date.now() - claim.iat > STATE_TTL_MS) return null;
    return claim;
  } catch {
    return null;
  }
}
