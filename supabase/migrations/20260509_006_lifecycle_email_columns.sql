-- =============================================
-- Lifecycle email tracking columns
--
-- Tracks when behavioural emails were last sent per user:
--   low_credits_email_sent_at  → freemium user reached ≤ 3 credits
--   reengagement_email_sent_at → user inactive for 7+ days
--
-- Both columns are reset to NULL when a new subscription is purchased
-- (handled by the stripe-webhook function) so the cycle can repeat
-- if the user ever cancels and goes freemium again.
-- =============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS low_credits_email_sent_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reengagement_email_sent_at  TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: get_reengagement_candidates
--
-- Returns users whose last succeeded generation completed before
-- p_inactive_before AND who have not yet received a re-engagement email.
-- Called by the send-lifecycle-emails edge function (service_role).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_reengagement_candidates(
  p_inactive_before TIMESTAMPTZ,
  p_limit           INTEGER DEFAULT 50
)
RETURNS TABLE (
  user_id            UUID,
  email              TEXT,
  display_name       TEXT,
  last_generation_at TIMESTAMPTZ,
  thumbnail_url      TEXT,
  output_url         TEXT,
  generation_type    TEXT,
  prompt             TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH last_gen AS (
    SELECT DISTINCT ON (g.user_id)
      g.user_id,
      g.completed_at  AS last_generation_at,
      g.thumbnail_url,
      g.output_url,
      g.type          AS generation_type,
      g.prompt
    FROM public.generations g
    WHERE g.status    = 'succeeded'
      AND g.hidden_at IS NULL
    ORDER BY g.user_id, g.completed_at DESC
  )
  SELECT
    p.user_id,
    p.email,
    p.display_name,
    lg.last_generation_at,
    lg.thumbnail_url,
    lg.output_url,
    lg.generation_type,
    lg.prompt
  FROM public.profiles p
  JOIN last_gen lg ON lg.user_id = p.user_id
  WHERE lg.last_generation_at < p_inactive_before
    AND p.reengagement_email_sent_at IS NULL
    AND p.email IS NOT NULL
  ORDER BY lg.last_generation_at ASC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.get_reengagement_candidates(TIMESTAMPTZ, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reengagement_candidates(TIMESTAMPTZ, INTEGER) TO service_role;
