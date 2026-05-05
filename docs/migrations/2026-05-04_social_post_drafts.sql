-- Marketing: social post drafts table.
--
-- Adds the storage backing the new "Marketing Assistant" agent and
-- the /admin/marketing page. Idempotent — safe to re-run.
--
-- The table holds AI-generated post copy that admin reviews +
-- copy-pastes into each platform's app. No OAuth / direct posting
-- to Instagram / Facebook / X / LinkedIn in v1; admin keeps
-- editorial control.
--
-- Apply: paste into Supabase SQL Editor → Run.
-- Or: re-run the full supabase/schema.sql which now includes this.

CREATE TABLE IF NOT EXISTS social_post_drafts (
  id TEXT PRIMARY KEY,
  -- One of: instagram | facebook | x | linkedin
  platform TEXT NOT NULL,
  -- The post copy itself, including line breaks + hashtags. Free
  -- text — no length cap, but the marketing agent's prompt steers
  -- output toward platform-appropriate sizes (Instagram 1-3 short
  -- paragraphs, X 280 chars, LinkedIn longer-form, Facebook flexible).
  copy TEXT NOT NULL,
  -- Short note describing the kind of image to pair with the copy
  -- (e.g. "wide shot of Sigiriya at golden hour"). v1 doesn't
  -- generate images — admin supplies them.
  image_direction TEXT,
  -- One of: package | destination | tour | generic. Lets the agent
  -- ground the copy in real catalog records instead of inventing.
  target_kind TEXT NOT NULL DEFAULT 'generic',
  -- ID of the package / destination / tour referenced. NULL for
  -- generic brand / seasonal posts.
  target_id TEXT,
  -- Hashtags as a JSONB string array. UI prepends '#' on render.
  tags JSONB NOT NULL DEFAULT '[]',
  -- One of: draft | approved | posted | archived
  status TEXT NOT NULL DEFAULT 'draft',
  -- Free-form identifier of who generated this draft. Defaults to
  -- 'Marketing Agent'; admin-edited drafts may flip to 'Admin'.
  generated_by TEXT NOT NULL DEFAULT 'Marketing Agent',
  -- Set when status flips to 'posted'.
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Status + recency index for the main /admin/marketing list
CREATE INDEX IF NOT EXISTS idx_social_post_drafts_status
  ON social_post_drafts(status, created_at DESC);

-- Platform tab filter
CREATE INDEX IF NOT EXISTS idx_social_post_drafts_platform
  ON social_post_drafts(platform, status);
