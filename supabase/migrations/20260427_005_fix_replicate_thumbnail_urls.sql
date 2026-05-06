-- Migration: fix_replicate_thumbnail_urls
--
-- Problem: generations rows whose thumbnail_url / output_url point to expiring
-- Replicate CDN URLs (replicate.delivery / replicate.com). The check-prediction
-- edge function already uploads files to Supabase Storage and stores the
-- permanent URL in the related generated_videos row, but the parent generations
-- row was not always back-filled.
--
-- Fix: copy the permanent Supabase Storage URL from generated_videos into the
-- generations row whenever the current thumbnail_url / output_url is still a
-- Replicate URL and a better URL exists in generated_videos.

-- 1. Fix thumbnail_url on generations using generated_videos.thumbnail_url
UPDATE generations g
SET
  thumbnail_url = gv.thumbnail_url,
  updated_at    = now()
FROM generated_videos gv
WHERE gv.generation_id = g.id
  -- generated_videos has a permanent (non-Replicate) URL
  AND gv.thumbnail_url IS NOT NULL
  AND gv.thumbnail_url NOT LIKE '%replicate.delivery%'
  AND gv.thumbnail_url NOT LIKE '%replicate.com%'
  AND gv.thumbnail_url <> ''
  -- generations still has an expiring Replicate URL (or nothing)
  AND (
    g.thumbnail_url IS NULL
    OR g.thumbnail_url = ''
    OR g.thumbnail_url LIKE '%replicate.delivery%'
    OR g.thumbnail_url LIKE '%replicate.com%'
  );

-- 2. Fix output_url on generations using generated_videos.video_url
UPDATE generations g
SET
  output_url = gv.video_url,
  updated_at = now()
FROM generated_videos gv
WHERE gv.generation_id = g.id
  AND gv.video_url IS NOT NULL
  AND gv.video_url NOT LIKE '%replicate.delivery%'
  AND gv.video_url NOT LIKE '%replicate.com%'
  AND gv.video_url <> ''
  AND (
    g.output_url IS NULL
    OR g.output_url = ''
    OR g.output_url LIKE '%replicate.delivery%'
    OR g.output_url LIKE '%replicate.com%'
  );

-- 3. Where output_url was fixed but thumbnail_url is still a Replicate URL,
--    fall back to using output_url as thumbnail (covers image generations)
UPDATE generations
SET
  thumbnail_url = output_url,
  updated_at    = now()
WHERE output_url IS NOT NULL
  AND output_url <> ''
  AND output_url NOT LIKE '%replicate.delivery%'
  AND output_url NOT LIKE '%replicate.com%'
  AND (
    thumbnail_url IS NULL
    OR thumbnail_url = ''
    OR thumbnail_url LIKE '%replicate.delivery%'
    OR thumbnail_url LIKE '%replicate.com%'
  );
