-- =============================================
-- Hotfix: make deduct_credits independent from auth.users reads
--
-- Symptom:
-- Global 500 CREDITS_DEDUCTION_FAILED on generation endpoints.
--
-- Rationale:
-- Previous versions read auth.users inside deduct_credits to infer
-- legacy bootstrap behavior. In some runtime contexts this can fail
-- and break every deduction call.
--
-- Policy preserved:
-- - No free credits for new users by default.
-- - Legacy repair remains handled by one-time migrations.
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
BEGIN
  v_caller_role := COALESCE(auth.role(), '');
  v_caller_uid := auth.uid();

  -- Ownership check only for authenticated end-user calls.
  IF v_caller_role = 'authenticated' AND v_caller_uid IS NOT NULL AND v_caller_uid <> deduct_credits.user_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Bootstrap missing rows with 0 (current policy).
  INSERT INTO public.user_credits (user_id, credits, lifetime_credits)
  VALUES (deduct_credits.user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT uc.credits
    INTO v_current_credits
  FROM public.user_credits uc
  WHERE uc.user_id = deduct_credits.user_id
  FOR UPDATE;

  IF v_current_credits IS NULL THEN
    RETURN FALSE;
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

-- Optional quick smoke test (run manually, replacing UUID):
-- SELECT public.deduct_credits('00000000-0000-0000-0000-000000000000'::uuid, 1);
