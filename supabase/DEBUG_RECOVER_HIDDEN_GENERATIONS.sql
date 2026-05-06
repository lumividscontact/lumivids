-- Debug and recovery script for missing MyVideos history caused by hidden_at
-- Run in Supabase SQL Editor (preferably in a transaction-safe workflow).
-- This script does NOT run automatically in app code.

-- 1) Set target user id
-- Replace with the affected user UUID.
WITH params AS (
  SELECT '00000000-0000-0000-0000-000000000000'::uuid AS target_user_id
)
SELECT target_user_id FROM params;

-- 2) Quick visibility audit
WITH params AS (
  SELECT '00000000-0000-0000-0000-000000000000'::uuid AS target_user_id
)
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE hidden_at IS NULL) AS visible_rows,
  COUNT(*) FILTER (WHERE hidden_at IS NOT NULL) AS hidden_rows,
  MIN(created_at) AS oldest_created_at,
  MAX(created_at) AS newest_created_at
FROM public.generations g
JOIN params p ON p.target_user_id = g.user_id;

-- 3) Inspect hidden rows (sample)
WITH params AS (
  SELECT '00000000-0000-0000-0000-000000000000'::uuid AS target_user_id
)
SELECT
  id,
  replicate_prediction_id,
  type,
  status,
  created_at,
  hidden_at,
  output_url,
  thumbnail_url
FROM public.generations g
JOIN params p ON p.target_user_id = g.user_id
WHERE g.hidden_at IS NOT NULL
ORDER BY g.created_at DESC
LIMIT 200;

-- 4) Correlate with audit trail: who/what hid those rows
WITH params AS (
  SELECT '00000000-0000-0000-0000-000000000000'::uuid AS target_user_id
)
SELECT
  a.created_at AS audit_at,
  a.event_type,
  a.actor_user_id,
  a.actor_role,
  a.generation_id,
  a.replicate_prediction_id,
  a.row_before ->> 'hidden_at' AS hidden_before,
  a.row_after ->> 'hidden_at' AS hidden_after
FROM public.generations_audit a
JOIN params p ON p.target_user_id = a.user_id
WHERE a.event_type = 'update'
  AND (a.row_before ->> 'hidden_at') IS DISTINCT FROM (a.row_after ->> 'hidden_at')
ORDER BY a.created_at DESC
LIMIT 300;

-- 5) Candidate rows for safe recovery (preview only)
-- Rule: only completed rows with media URLs and currently hidden.
WITH params AS (
  SELECT '00000000-0000-0000-0000-000000000000'::uuid AS target_user_id
)
SELECT
  g.id,
  g.replicate_prediction_id,
  g.status,
  g.created_at,
  g.hidden_at,
  g.output_url,
  g.thumbnail_url
FROM public.generations g
JOIN params p ON p.target_user_id = g.user_id
WHERE g.hidden_at IS NOT NULL
  AND g.status = 'succeeded'
  AND (g.output_url IS NOT NULL OR g.thumbnail_url IS NOT NULL)
ORDER BY g.created_at DESC;

-- 6) Recovery update (commented out by default)
-- IMPORTANT: execute only after reviewing step 5 output.
-- BEGIN;
-- WITH params AS (
--   SELECT '00000000-0000-0000-0000-000000000000'::uuid AS target_user_id
-- )
-- UPDATE public.generations g
-- SET hidden_at = NULL,
--     updated_at = NOW()
-- FROM params p
-- WHERE g.user_id = p.target_user_id
--   AND g.hidden_at IS NOT NULL
--   AND g.status = 'succeeded'
--   AND (g.output_url IS NOT NULL OR g.thumbnail_url IS NOT NULL);
--
-- -- Verify result before commit
-- SELECT COUNT(*) AS still_hidden
-- FROM public.generations g
-- JOIN params p ON p.target_user_id = g.user_id
-- WHERE g.hidden_at IS NOT NULL;
--
-- COMMIT;
-- ROLLBACK;
