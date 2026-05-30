-- Marketing: scheduled publish.
--
-- Lets admin schedule a post for a future datetime. Status flips to
-- 'scheduled' (a fourth status alongside draft/approved/posted/archived)
-- and the cron worker at /api/cron/publish-scheduled-posts polls for
-- due rows every 15 minutes (configured in vercel.json) and publishes
-- them via the existing OAuth pipeline.
--
-- Idempotent — safe to re-run.

ALTER TABLE social_post_drafts
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

-- Partial index optimised for the cron worker's lookup
-- (status='scheduled' AND scheduled_for <= NOW()).
CREATE INDEX IF NOT EXISTS idx_social_post_drafts_scheduled
  ON social_post_drafts(status, scheduled_for)
  WHERE status = 'scheduled';
