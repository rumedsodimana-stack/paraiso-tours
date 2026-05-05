-- Social OAuth tokens table.
--
-- Holds the OAuth 2.0 access + refresh tokens granted by Meta
-- (Facebook + Instagram), X, and LinkedIn so the marketing-agent
-- publish pipeline can post on the brand's behalf.
--
-- Tokens are AES-256-GCM encrypted at rest using a key derived from
-- APP_SETTINGS_SECRET. The columns hold base64 ciphertext, never
-- plaintext. Decryption happens server-side at publish time only.
--
-- One row per connected platform (primary key on `platform`):
--   - "meta"      → covers both Facebook + Instagram (single OAuth
--                   flow, single page access token, IG business
--                   account id stored in `metadata`)
--   - "x"         → X (Twitter) OAuth 2.0 with PKCE
--   - "linkedin"  → LinkedIn 3-legged OAuth, org-page posting
--
-- Apply: paste into Supabase SQL Editor → Run. Idempotent.

CREATE TABLE IF NOT EXISTS social_oauth_tokens (
  platform TEXT PRIMARY KEY,
  -- AES-256-GCM ciphertext of the access token. Base64 encoded.
  access_token_ct TEXT NOT NULL,
  -- AES-256-GCM ciphertext of the refresh token (X + LinkedIn).
  -- Null for Meta which uses long-lived tokens that don't refresh.
  refresh_token_ct TEXT,
  -- ISO timestamp when the access token expires. NULL = never
  -- (Meta long-lived) or unknown.
  expires_at TIMESTAMPTZ,
  -- Non-secret per-platform identifiers:
  --   meta:     { page_id, page_name, instagram_business_account_id, instagram_username }
  --   x:        { user_id, username }
  --   linkedin: { organization_urn, organization_name, person_urn }
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
