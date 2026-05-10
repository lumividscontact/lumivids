-- =============================================
-- Fix deduct_credits error priority for freemium users.
--
-- Problem:
-- For freemium users, DAILY_LIMIT_REACHED was checked before
-- insufficient balance. This could return DAILY_LIMIT_REACHED
-- for brand-new users with 10 welcome credits when a request
-- cost exceeded their current balance.
--
-- Expected behavior:
-- 1) If balance is insufficient -> return FALSE (insufficient credits)
-- 2) If balance is enough but daily quota exceeded -> raise DAILY_LIMIT_REACHED
-- =============================================

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

  -- Prioritize insufficient balance over daily cap for correct UX/error semantics.
  IF v_current_credits < amount THEN
    RETURN FALSE;
  END IF;

  IF v_is_freemium AND (v_free_daily_used + amount) > v_free_daily_limit THEN
    RAISE EXCEPTION 'DAILY_LIMIT_REACHED' USING ERRCODE = 'P0001';
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

REVOKE ALL ON FUNCTION public.deduct_credits(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER) TO service_role;
