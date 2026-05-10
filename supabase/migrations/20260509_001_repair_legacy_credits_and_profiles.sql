-- =============================================
-- Repair legacy users after no-free-credits policy rollout
--
-- Goals:
-- 1) Keep policy: new users receive 0 free credits.
-- 2) Preserve old entitlement: legacy users keep their unused 10 free credits.
-- 3) Repair missing profiles (prevents welcome-email 404 Profile not found).
-- 4) Restore balances for users accidentally zeroed by the legacy wipe script.
--
-- Safe to re-run (idempotent).
-- =============================================

-- Legacy policy cutoff: users created before this timestamp are entitled to the old 10 free credits
-- if they are missing a user_credits row.
-- Adjust only if your real cutover timestamp differs.
-- UTC

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
-- Step 2: restore users that were accidentally zeroed
-- by script marker: 'Legacy free credits removed (policy update: no free credits)'
-- ------------------------------------------------
WITH wipe_events AS (
  SELECT
    ct.user_id,
    MIN(ct.created_at) AS first_wipe_at
  FROM public.credit_transactions ct
  WHERE ct.description = 'Legacy free credits removed (policy update: no free credits)'
  GROUP BY ct.user_id
),
recoverable AS (
  SELECT
    we.user_id,
    uc.credits AS current_credits,
    prev.balance_after AS restored_credits
  FROM wipe_events we
  JOIN public.user_credits uc
    ON uc.user_id = we.user_id
  LEFT JOIN LATERAL (
    SELECT ct2.balance_after
    FROM public.credit_transactions ct2
    WHERE ct2.user_id = we.user_id
      AND ct2.created_at < we.first_wipe_at
    ORDER BY ct2.created_at DESC
    LIMIT 1
  ) prev ON TRUE
),
updated AS (
  UPDATE public.user_credits uc
  SET credits = r.restored_credits,
      lifetime_credits = GREATEST(uc.lifetime_credits, r.restored_credits),
      updated_at = NOW()
  FROM recoverable r
  WHERE uc.user_id = r.user_id
    AND r.restored_credits IS NOT NULL
    AND uc.credits <> r.restored_credits
  RETURNING uc.user_id, r.current_credits, r.restored_credits
)
INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
SELECT
  u.user_id,
  'bonus',
  (u.restored_credits - u.current_credits),
  u.restored_credits,
  'Credits restored after accidental zeroing'
FROM updated u
WHERE (u.restored_credits - u.current_credits) <> 0;

-- ------------------------------------------------
-- Step 3: bootstrap missing user_credits for legacy users only
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
-- Step 4: replace deduct_credits with legacy-safe bootstrap
-- New users: bootstrap 0 (no freebies)
-- Legacy users (created before cutoff): bootstrap 10 if row is missing
-- ------------------------------------------------
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
  v_user_created_at TIMESTAMPTZ;
  v_bootstrap_credits INTEGER := 0;
BEGIN
  v_caller_role := COALESCE(auth.role(), '');
  v_caller_uid := auth.uid();

  IF v_caller_role <> 'service_role' AND (v_caller_uid IS NULL OR v_caller_uid <> deduct_credits.user_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT au.created_at
    INTO v_user_created_at
  FROM auth.users au
  WHERE au.id = deduct_credits.user_id;

  IF v_user_created_at IS NOT NULL AND v_user_created_at < TIMESTAMPTZ '2026-05-08 00:00:00+00' THEN
    v_bootstrap_credits := 10;
  END IF;

  INSERT INTO public.user_credits (user_id, credits, lifetime_credits)
  VALUES (deduct_credits.user_id, v_bootstrap_credits, v_bootstrap_credits)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT credits INTO v_current_credits
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

-- Optional quick diagnostic
SELECT
  uc.user_id,
  uc.credits,
  uc.lifetime_credits,
  uc.updated_at
FROM public.user_credits uc
ORDER BY uc.updated_at DESC
LIMIT 30;
