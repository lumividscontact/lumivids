-- =============================================
-- Freemium daily credits + clear daily limit
-- =============================================

-- Add per-day freemium usage tracking columns.
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS free_daily_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_daily_date DATE NOT NULL DEFAULT (timezone('utc', now())::date);

ALTER TABLE public.user_credits
  DROP CONSTRAINT IF EXISTS user_credits_free_daily_used_check;

ALTER TABLE public.user_credits
  ADD CONSTRAINT user_credits_free_daily_used_check CHECK (free_daily_used >= 0);

-- Ensure existing rows are normalized.
UPDATE public.user_credits
SET free_daily_used = COALESCE(free_daily_used, 0),
    free_daily_date = COALESCE(free_daily_date, timezone('utc', now())::date)
WHERE free_daily_used IS NULL
   OR free_daily_date IS NULL;

-- Returns one row with refreshed freemium status for user.
-- Free users: top up daily balance to quota if below threshold.
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
  v_quota CONSTANT INTEGER := 20;
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
  VALUES (p_user_id, 10, 10, 0, v_today)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT uc.credits, uc.lifetime_credits, uc.free_daily_used, uc.free_daily_date
    INTO v_current_credits, v_current_lifetime, v_current_used, v_current_date
  FROM public.user_credits uc
  WHERE uc.user_id = p_user_id
  FOR UPDATE;

  IF v_current_date IS DISTINCT FROM v_today THEN
    v_current_used := 0;
    v_current_date := v_today;

    UPDATE public.user_credits uc
    SET free_daily_used = 0,
        free_daily_date = v_today,
        updated_at = NOW()
    WHERE uc.user_id = p_user_id;
  END IF;

  -- Free users get daily top-up up to quota.
  IF NOT v_is_paid AND v_current_credits < v_quota THEN
    v_topup := v_quota - v_current_credits;

    UPDATE public.user_credits uc
    SET credits = uc.credits + v_topup,
        lifetime_credits = uc.lifetime_credits + v_topup,
        updated_at = NOW()
    WHERE uc.user_id = p_user_id;

    v_current_credits := v_current_credits + v_topup;
    v_current_lifetime := v_current_lifetime + v_topup;

    INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
    VALUES (p_user_id, 'daily_bonus', v_topup, v_current_credits, 'Daily freemium credits top-up');
  END IF;

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

-- Deduct credits with freemium daily cap for non-paying users.
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
  v_free_daily_limit INTEGER := 20;
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

REVOKE ALL ON FUNCTION public.refresh_freemium_credits(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_freemium_credits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_freemium_credits(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.deduct_credits(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER) TO service_role;
