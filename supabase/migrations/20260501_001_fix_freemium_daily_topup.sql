-- =============================================
-- Fix freemium daily top-up: only credit on
-- day reset (no intra-day accumulation).
-- Daily quota reduced from 20 → 10.
-- =============================================

CREATE OR REPLACE FUNCTION public.refresh_freemium_credits(
  p_user_id UUID
)
RETURNS TABLE (
  credits INTEGER,
  free_daily_limit INTEGER,
  free_daily_used INTEGER,
  free_daily_remaining INTEGER,
  is_freemium BOOLEAN,
  next_reset_at TIMESTAMPTZ
) AS $$
DECLARE
  v_quota CONSTANT INTEGER := 10;
  v_today DATE := timezone('utc', now())::date;
  v_is_paid BOOLEAN := FALSE;
  v_current_credits INTEGER := 0;
  v_current_lifetime INTEGER := 0;
  v_current_used INTEGER := 0;
  v_current_date DATE := v_today;
  v_topup INTEGER := 0;
  v_caller_role TEXT := COALESCE(auth.role(), '');
  v_caller_uid UUID := auth.uid();
BEGIN
  IF v_caller_role <> 'service_role' AND (v_caller_uid IS NULL OR v_caller_uid <> p_user_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = p_user_id
      AND s.status = 'active'
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ) INTO v_is_paid;

  -- Ensure credit row exists.
  INSERT INTO public.user_credits (user_id, credits, lifetime_credits, free_daily_used, free_daily_date)
  VALUES (p_user_id, v_quota, v_quota, 0, v_today)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT uc.credits, uc.lifetime_credits, uc.free_daily_used, uc.free_daily_date
    INTO v_current_credits, v_current_lifetime, v_current_used, v_current_date
  FROM public.user_credits uc
  WHERE uc.user_id = p_user_id
  FOR UPDATE;

  -- New day: reset usage counter AND top-up free users to quota (no accumulation).
  IF v_current_date IS DISTINCT FROM v_today THEN
    v_current_used := 0;
    v_current_date := v_today;

    IF NOT v_is_paid AND v_current_credits < v_quota THEN
      v_topup := v_quota - v_current_credits;

      UPDATE public.user_credits uc
      SET credits        = uc.credits + v_topup,
          lifetime_credits = uc.lifetime_credits + v_topup,
          free_daily_used  = 0,
          free_daily_date  = v_today,
          updated_at       = NOW()
      WHERE uc.user_id = p_user_id;

      v_current_credits := v_current_credits + v_topup;
      v_current_lifetime := v_current_lifetime + v_topup;

      INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
      VALUES (p_user_id, 'daily_bonus', v_topup, v_current_credits, 'Daily freemium credits top-up');
    ELSE
      -- Paid users or free with enough credits: just reset usage counter.
      UPDATE public.user_credits uc
      SET free_daily_used = 0,
          free_daily_date = v_today,
          updated_at      = NOW()
      WHERE uc.user_id = p_user_id;
    END IF;
  END IF;
  -- NOTE: no top-up happens mid-day; credits are only restored on the day rollover above.

  RETURN QUERY
  SELECT
    v_current_credits,
    v_quota,
    v_current_used,
    GREATEST(v_quota - v_current_used, 0),
    NOT v_is_paid,
    ((date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day') AT TIME ZONE 'utc')::timestamptz;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update deduct_credits to reference the new quota (10).
CREATE OR REPLACE FUNCTION public.deduct_credits(
  user_id UUID,
  amount INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_credits INTEGER;
  v_new_balance INTEGER;
  v_caller_role TEXT;
  v_caller_uid UUID;
  v_is_freemium BOOLEAN := FALSE;
  v_free_daily_limit INTEGER := 10;
  v_free_daily_used INTEGER := 0;
BEGIN
  v_caller_role := COALESCE(auth.role(), '');
  v_caller_uid := auth.uid();

  IF v_caller_role <> 'service_role' AND (v_caller_uid IS NULL OR v_caller_uid <> deduct_credits.user_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT rf.credits, rf.free_daily_limit, rf.free_daily_used, rf.is_freemium
    INTO v_current_credits, v_free_daily_limit, v_free_daily_used, v_is_freemium
  FROM public.refresh_freemium_credits(deduct_credits.user_id) rf;

  IF v_current_credits IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_is_freemium AND (v_free_daily_used + amount) > v_free_daily_limit THEN
    RAISE EXCEPTION 'DAILY_LIMIT_REACHED' USING ERRCODE = 'P0001';
  END IF;

  IF v_current_credits < amount THEN
    RETURN FALSE;
  END IF;

  v_new_balance := v_current_credits - amount;

  UPDATE public.user_credits uc
  SET credits = v_new_balance,
      free_daily_used = CASE
        WHEN v_is_freemium THEN uc.free_daily_used + deduct_credits.amount
        ELSE uc.free_daily_used
      END,
      updated_at = NOW()
  WHERE uc.user_id = deduct_credits.user_id;

  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
  VALUES (deduct_credits.user_id, 'usage', -deduct_credits.amount, v_new_balance, 'Credits used for generation');

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Correct existing over-credited free users: cap to daily quota.
UPDATE public.user_credits uc
SET credits = 10,
    updated_at = NOW()
WHERE credits > 10
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = uc.user_id
      AND s.status = 'active'
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );

REVOKE ALL ON FUNCTION public.refresh_freemium_credits(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_freemium_credits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_freemium_credits(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.deduct_credits(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER) TO service_role;
