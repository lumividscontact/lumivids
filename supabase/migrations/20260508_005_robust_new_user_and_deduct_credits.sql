-- =============================================
-- Fix: new users cannot generate despite having 10 welcome credits.
--
-- Root causes:
-- 1. handle_new_user trigger has no exception handling. If any step
--    fails (e.g. notifications insert), the entire trigger rolls back
--    and the user_credits row is never created.
-- 2. deduct_credits (schema.sql / pre-freemium versions) returns FALSE
--    immediately when no user_credits row exists, instead of creating it.
--
-- This migration:
-- A. Rewrites handle_new_user to isolate each INSERT in its own
--    BEGIN/EXCEPTION block. Profile + user_credits are required;
--    credit_transactions and notifications are best-effort.
-- B. Rewrites deduct_credits to auto-provision 10 welcome credits when
--    no row exists, so users are never blocked by a missing row.
--
-- Safe to re-run (idempotent).
-- =============================================

-- -----------------------------------------------
-- A. Robust handle_new_user trigger
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Create profile (hard requirement).
  INSERT INTO public.profiles (user_id, display_name, email, welcome_email_pending)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    true
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- 2. Create user_credits with 10 welcome credits (hard requirement).
  INSERT INTO public.user_credits (user_id, credits, lifetime_credits)
  VALUES (NEW.id, 10, 10)
  ON CONFLICT (user_id) DO NOTHING;

  -- 3. Record bonus transaction (best-effort).
  BEGIN
    INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
    VALUES (NEW.id, 'bonus', 10, 10, 'Welcome bonus - 10 credits');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Non-critical, do not block user creation.
  END;

  -- 4. Send welcome notification (best-effort).
  BEGIN
    IF to_regclass('public.notifications') IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (
        NEW.id,
        'system',
        'Welcome to Lumivids! 🎉',
        'You received 10 bonus credits to start creating amazing AI videos and images!'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Non-critical, do not block user creation.
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger is registered (idempotent).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- -----------------------------------------------
-- B. Self-healing deduct_credits
--    Works regardless of whether the freemium
--    migrations (001-004) have been applied.
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.deduct_credits(
  user_id UUID,
  amount INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_credits INTEGER;
  v_new_balance     INTEGER;
  v_caller_role     TEXT;
  v_caller_uid      UUID;
  v_is_freemium     BOOLEAN  := FALSE;
  v_free_daily_limit INTEGER := 10;
  v_free_daily_used  INTEGER := 0;
  v_free_daily_date  DATE;
  v_today            DATE    := timezone('utc', now())::date;
BEGIN
  v_caller_role := COALESCE(auth.role(), '');
  v_caller_uid  := auth.uid();

  IF v_caller_role <> 'service_role'
     AND (v_caller_uid IS NULL OR v_caller_uid <> deduct_credits.user_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Auto-provision 10 welcome credits for users whose row is missing
  -- (trigger may have failed or user pre-dates the credits system).
  INSERT INTO public.user_credits (user_id, credits, lifetime_credits)
  VALUES (deduct_credits.user_id, 10, 10)
  ON CONFLICT (user_id) DO NOTHING;

  -- Read current balance (with row lock for atomicity).
  SELECT uc.credits
    INTO v_current_credits
  FROM public.user_credits uc
  WHERE uc.user_id = deduct_credits.user_id
  FOR UPDATE;

  IF v_current_credits IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check whether this user is freemium (no active paid subscription,
  -- not an admin). Fall back gracefully if columns/tables don't exist.
  BEGIN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = deduct_credits.user_id
        AND s.status = 'active'
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = deduct_credits.user_id AND p.role = 'admin'
    )
    INTO v_is_freemium;
  EXCEPTION WHEN OTHERS THEN
    v_is_freemium := FALSE; -- If query fails, skip freemium gate.
  END;

  -- Read freemium daily tracking columns when they exist.
  BEGIN
    EXECUTE format(
      'SELECT free_daily_used, free_daily_date FROM public.user_credits WHERE user_id = %L',
      deduct_credits.user_id
    ) INTO v_free_daily_used, v_free_daily_date;

    -- Reset daily counter when the date has changed.
    IF v_free_daily_date IS DISTINCT FROM v_today THEN
      v_free_daily_used := 0;
      UPDATE public.user_credits uc
         SET free_daily_used = 0,
             free_daily_date = v_today,
             updated_at      = NOW()
       WHERE uc.user_id = deduct_credits.user_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_free_daily_used := 0; -- Columns may not exist in older schemas.
  END;

  -- Prioritise insufficient balance over daily cap (better UX).
  IF v_current_credits < amount THEN
    RETURN FALSE;
  END IF;

  IF v_is_freemium AND (v_free_daily_used + amount) > v_free_daily_limit THEN
    RAISE EXCEPTION 'DAILY_LIMIT_REACHED' USING ERRCODE = 'P0001';
  END IF;

  v_new_balance := v_current_credits - amount;

  -- Update credits balance.
  UPDATE public.user_credits uc
     SET credits    = v_new_balance,
         updated_at = NOW()
   WHERE uc.user_id = deduct_credits.user_id;

  -- Update daily usage counter when the column exists (freemium only).
  IF v_is_freemium THEN
    BEGIN
      UPDATE public.user_credits uc
         SET free_daily_used = COALESCE(v_free_daily_used, 0) + deduct_credits.amount
       WHERE uc.user_id = deduct_credits.user_id;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Column may not exist in legacy schemas; ignore safely.
    END;
  END IF;

  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
  VALUES (
    deduct_credits.user_id,
    'usage',
    -deduct_credits.amount,
    v_new_balance,
    'Credits used for generation'
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.deduct_credits(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER) TO service_role;
