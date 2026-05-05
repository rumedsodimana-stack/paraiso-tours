-- Marketing image hosting.
--
-- Adds the storage backing the Instagram publish flow + admin's
-- in-app image upload UI on /admin/marketing.
--
-- Two changes:
--   1. New `image_url` column on social_post_drafts so the upload
--      URL persists with the draft (admin doesn't re-upload across
--      re-publish attempts).
--   2. New Supabase Storage bucket `marketing-images` with public
--      read access — required because the Instagram Container API
--      fetches the image URL server-side during media-publish.
--
-- Apply: paste into Supabase SQL Editor → Run. Idempotent.

-- Column on drafts.
ALTER TABLE social_post_drafts
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Storage bucket. The `public` flag means objects served from
-- /storage/v1/object/public/<bucket>/<path> are accessible without
-- auth. Required so Meta's Graph API can fetch the image URL when
-- creating an Instagram media container.
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-images', 'marketing-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read policy on the bucket. Without this, the public-flag
-- only allows direct URL fetches; signed URL APIs still need this.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'marketing_images_public_read'
  ) THEN
    CREATE POLICY marketing_images_public_read
      ON storage.objects FOR SELECT
      USING (bucket_id = 'marketing-images');
  END IF;
END $$;

-- Authenticated write — only the service-role key (used by the
-- admin upload server action) writes here. We don't issue
-- anon-keyed uploads from the browser; the upload action proxies
-- through the server.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'marketing_images_service_write'
  ) THEN
    CREATE POLICY marketing_images_service_write
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'marketing-images');
  END IF;
END $$;
