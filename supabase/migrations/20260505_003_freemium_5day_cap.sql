-- =============================================
-- Freemium 5-day bonus cap
-- Free users receive daily top-up for at most 5 days
-- (50 credits total lifetime, counting the signup bonus as day 1).
-- After that, the daily top-up is blocked until they upgrade.
-- =============================================

-- 1. Add tracking column to user_credits
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS free_bonus_days_used INTEGER DEFAULT 1 NOT NULL;

-- 2. Backfill: day-1 is the signup bonus (not a credit_transaction),
--    each subsequent 'daily_bonus' transaction is one more day.
UPDATE public.user_credits uc
SET free_bonus_days_used = LEAST(
  1 + COALESCE((
    SELECT COUNT(*)
    FROM public.credit_transactions ct
    WHERE ct.user_id = uc.user_id
      AND ct.type = 'daily_bonus'
  ), 0),
  5
);

-- 3. Replace refresh_freemium_credits to enforce the cap.
--    Return type changes → must DROP first.
DROP FUNCTION IF EXISTS public.refresh_freemium_credits(UUID);

CREATE OR REPLACE FUNCTION public.refresh_freemium_credits(
  p_user_id UUID
)
RETURNS TABLE (
  credits                INTEGER,
  free_daily_limit       INTEGER,
  free_daily_used        INTEGER,
  free_daily_remaining   INTEGER,
  is_freemium            BOOLEAN,
  next_reset_at          TIMESTAMPTZ,
  free_bonus_days_used   INTEGER,
  free_bonus_days_max    INTEGER
) AS $$
DECLARE
  v_quota            CONSTANT INTEGER := 10;
  v_max_bonus_days   CONSTANT INTEGER := 5;
  v_today            DATE := timezone('utc', now())::date;
  v_is_paid          BOOLEAN := FALSE;
  v_is_admin         BOOLEAN := FALSE;
  v_current_credits  INTEGER := 0;
  v_current_lifetime INTEGER := 0;
  v_current_used     INTEGER := 0;
  v_current_date     DATE := v_today;
  v_bonus_days_used  INTEGER := 1;
  v_topup            INTEGER := 0;
  v_caller_role      TEXT := COALESCE(auth.role(), '');
  v_caller_uid       UUID := auth.uid();
BEGIN
  IF v_caller_role <> 'service_role' AND (v_caller_uid IS NULL OR v_caller_uid <> p_user_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Check admin
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = p_user_id
      AND p.role = 'admin'
  ) INTO v_is_admin;

  -- Check active paid subscription
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = p_user_id
      AND s.status = 'active'
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ) INTO v_is_paid;

  -- Admins bypass freemium
  v_is_paid := v_is_paid OR v_is_admin;

  -- Ensure credit row exists (day-1 counts as 1 bonus day already used)
  INSERT INTO public.user_credits (
    user_id, credits, lifetime_credits, free_daily_used, free_daily_date, free_bonus_days_used
  )
  VALUES (p_user_id, v_quota, v_quota, 0, v_today, 1)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT uc.credits,
         uc.lifetime_credits,
         uc.free_daily_used,
         uc.free_daily_date,
         uc.free_bonus_days_used
    INTO v_current_credits,
         v_current_lifetime,
         v_current_used,
         v_current_date,
         v_bonus_days_used
  FROM public.user_credits uc
  WHERE uc.user_id = p_user_id
  FOR UPDATE;

  -- New day logic
  IF v_current_date IS DISTINCT FROM v_today THEN
    v_current_used := 0;
    v_current_date := v_today;

    IF NOT v_is_paid
       AND v_current_credits < v_quota
       AND v_bonus_days_used < v_max_bonus_days
    THEN
      -- Still within the 5-day free bonus window → top up
      v_topup := v_quota - v_current_credits;

      UPDATE public.user_credits uc
      SET credits              = uc.credits + v_topup,
          lifetime_credits     = uc.lifetime_credits + v_topup,
          free_daily_used      = 0,
          free_daily_date      = v_today,
          free_bonus_days_used = uc.free_bonus_days_used + 1,
          updated_at           = NOW()
      WHERE uc.user_id = p_user_id;

      v_current_credits := v_current_credits + v_topup;
      v_current_lifetime := v_current_lifetime + v_topup;
      v_bonus_days_used := v_bonus_days_used + 1;

      INSERT INTO public.credit_transactions (
        user_id, type, amount, balance_after, description
      )
      VALUES (
        p_user_id, 'daily_bonus', v_topup, v_current_credits,
        'Daily freemium credits top-up'
      );
    ELSE
      -- Cap reached, paid user, or already at quota: just reset daily counter
      UPDATE public.user_credits uc
      SET free_daily_used = 0,
          free_daily_date = v_today,
          updated_at      = NOW()
      WHERE uc.user_id = p_user_id;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    v_current_credits,
    v_quota,
    v_current_used,
    GREATEST(v_quota - v_current_used, 0),
    NOT v_is_paid,
    ((date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day') AT TIME ZONE 'utc')::timestamptz,
    v_bonus_days_used,
    v_max_bonus_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
