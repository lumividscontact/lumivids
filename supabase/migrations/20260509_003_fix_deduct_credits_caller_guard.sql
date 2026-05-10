-- =============================================
-- Hotfix: deduct_credits caller guard for Edge Functions
--
-- Symptom:
-- Edge Functions return 500 CREDITS_DEDUCTION_FAILED for all users.
--
-- Root cause:
-- Caller guard in deduct_credits can raise Forbidden for non-user JWT
-- contexts used by backend/internal calls, even when call is legitimate.
--
-- Fix:
-- Enforce ownership only for authenticated end-user calls.
-- Keep backend/internal roles allowed.
-- =============================================

CREATE OR REPLACE FUNCTION public.deduct_credits(
  user_id UUID,
  amount INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_credits INTEGER;
  v_lifetime_credits INTEGER;
  v_new_balance INTEGER;
  v_caller_role TEXT;
  v_caller_uid UUID;
  v_user_created_at TIMESTAMPTZ;
  v_bootstrap_credits INTEGER := 0;
BEGIN
  v_caller_role := COALESCE(auth.role(), '');
  v_caller_uid := auth.uid();

  -- Ownership check only for end-user calls.
  -- Backend/internal calls may not carry a user uid claim.
  IF v_caller_role = 'authenticated' AND v_caller_uid IS NOT NULL AND v_caller_uid <> deduct_credits.user_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT au.created_at
    INTO v_user_created_at
  FROM auth.users au
  WHERE au.id = deduct_credits.user_id;

  IF v_user_created_at IS NOT NULL AND v_user_created_at < TIMESTAMPTZ '2026-05-08 00:00:00+00' THEN
    v_bootstrap_credits := 10;
  END IF;

  -- Missing-row bootstrap (legacy: 10, new users: 0)
  INSERT INTO public.user_credits (user_id, credits, lifetime_credits)
  VALUES (deduct_credits.user_id, v_bootstrap_credits, v_bootstrap_credits)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT uc.credits, uc.lifetime_credits
    INTO v_current_credits, v_lifetime_credits
  FROM public.user_credits uc
  WHERE uc.user_id = deduct_credits.user_id
  FOR UPDATE;

  IF v_current_credits IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Runtime self-heal for legacy rows stuck at 0/0.
  IF v_bootstrap_credits = 10 AND v_current_credits = 0 AND COALESCE(v_lifetime_credits, 0) = 0 THEN
    v_current_credits := 10;
    v_lifetime_credits := 10;

    UPDATE public.user_credits uc
    SET credits = 10,
        lifetime_credits = 10,
        updated_at = NOW()
    WHERE uc.user_id = deduct_credits.user_id;

    INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
    VALUES (deduct_credits.user_id, 'bonus', 10, 10, 'Legacy entitlement restored during deduction');
  END IF;

  IF v_current_credits < amount THEN
    RETURN FALSE;
  END IF;

  v_new_balance := v_current_credits - amount;

  UPDATE public.user_credits uc
  SET credits = v_new_balance,
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
