-- =============================================
-- Fix legacy users stuck with 0/0 credits rows
--
-- Problem:
-- Some legacy users (created before policy cutoff) already have a
-- user_credits row with credits=0 and lifetime_credits=0.
-- In this case, missing-row bootstrap does not run, and they stay blocked.
--
-- This migration:
-- 1) Backfills missing profiles for existing users.
-- 2) Backfills missing user_credits rows for legacy users to 10/10.
-- 3) Backfills legacy 0/0 rows to 10/10 once.
-- 4) Hardens deduct_credits to auto-repair these edge cases at runtime.
--
-- Safe to re-run (idempotent).
-- =============================================

-- Policy cutoff (UTC)
-- Users created before this timestamp are legacy users.

-- ------------------------------------------------
-- Step 1: backfill missing profiles for existing auth users
-- ------------------------------------------------
INSERT INTO public.profiles (
  user_id,
  display_name,
  email,
  welcome_email_pending
)
SELECT
  au.id,
  COALESCE(
    au.raw_user_meta_data->>'display_name',
    au.raw_user_meta_data->>'name',
    split_part(COALESCE(au.email, ''), '@', 1)
  ),
  au.email,
  false
FROM auth.users au
LEFT JOIN public.profiles p
  ON p.user_id = au.id
WHERE p.user_id IS NULL;

-- ------------------------------------------------
-- Step 2: bootstrap missing user_credits rows for legacy users
-- ------------------------------------------------
WITH inserted AS (
  INSERT INTO public.user_credits (user_id, credits, lifetime_credits)
  SELECT
    au.id,
    10,
    10
  FROM auth.users au
  LEFT JOIN public.user_credits uc
    ON uc.user_id = au.id
  WHERE uc.user_id IS NULL
    AND au.created_at < TIMESTAMPTZ '2026-05-08 00:00:00+00'
  RETURNING user_id, credits
)
INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
SELECT
  i.user_id,
  'bonus',
  i.credits,
  i.credits,
  'Legacy bootstrap credits restored (missing row repair)'
FROM inserted i;

-- ------------------------------------------------
-- Step 3: one-time backfill of legacy 0/0 rows
-- ------------------------------------------------
WITH repaired AS (
  UPDATE public.user_credits uc
  SET credits = 10,
      lifetime_credits = 10,
      updated_at = NOW()
  FROM auth.users au
  WHERE uc.user_id = au.id
    AND au.created_at < TIMESTAMPTZ '2026-05-08 00:00:00+00'
    AND uc.credits = 0
    AND uc.lifetime_credits = 0
  RETURNING uc.user_id
)
INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
SELECT
  r.user_id,
  'bonus',
  10,
  10,
  'Legacy entitlement restored (0/0 row repair)'
FROM repaired r;

-- ------------------------------------------------
-- Step 4: harden deduct_credits for legacy edge cases
-- ------------------------------------------------
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

  IF v_caller_role NOT IN ('service_role', 'supabase_admin', 'postgres')
     AND (v_caller_uid IS NULL OR v_caller_uid <> deduct_credits.user_id) THEN
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

  -- Runtime self-heal for legacy rows that are stuck at 0/0.
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

-- Quick check for the affected user example (optional)
-- SELECT au.id, au.created_at, uc.credits, uc.lifetime_credits
-- FROM auth.users au
-- LEFT JOIN public.user_credits uc ON uc.user_id = au.id
-- WHERE au.id = '8b3cfdb9-809a-471a-8834-5cad1638ef26';

-- Optional quick diagnostic (latest balances)
-- SELECT
--   uc.user_id,
--   uc.credits,
--   uc.lifetime_credits,
--   uc.updated_at
-- FROM public.user_credits uc
-- ORDER BY uc.updated_at DESC
-- LIMIT 30;
