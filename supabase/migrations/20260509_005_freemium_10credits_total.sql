-- =============================================
-- Restore stable freemium policy
--
-- Policy:
-- - 10 free credits total per account (given at signup, never refilled)
-- - 10 free credits max per UTC day (daily usage cap)
-- - Once 10 credits are spent, user must upgrade
-- - Admins and paid users bypass freemium restrictions
--
-- This migration is forward-only and intended to replace the recent
-- no-free-credits / hotfix chain with one stable behavior.
-- =============================================

ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS free_daily_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_daily_date DATE NOT NULL DEFAULT (timezone('utc', now())::date);

-- Remove legacy trial-day tracking column (used in 20260505_003, dropped in 20260508_006, never needed again)
ALTER TABLE public.user_credits
  DROP COLUMN IF EXISTS free_bonus_days_used;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
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

  INSERT INTO public.user_credits (
    user_id,
    credits,
    lifetime_credits,
    free_daily_used,
    free_daily_date
  )
  VALUES (NEW.id, 10, 10, 0, timezone('utc', now())::date)
  ON CONFLICT (user_id) DO NOTHING;

  BEGIN
    INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
    VALUES (NEW.id, 'bonus', 10, 10, 'Free credits granted - 10 credits');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    IF to_regclass('public.notifications') IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (
        NEW.id,
        'system',
        'Welcome to Lumivids! 🎉',
        'You have 10 free credits to get started. Once used, upgrade to keep creating.'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP FUNCTION IF EXISTS public.deduct_credits(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.refresh_freemium_credits(UUID);

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
  v_is_admin BOOLEAN := FALSE;
  v_current_credits INTEGER := 0;
  v_current_used INTEGER := 0;
  v_current_date DATE := v_today;
  v_caller_role TEXT := COALESCE(auth.role(), '');
  v_caller_uid UUID := auth.uid();
BEGIN
  IF v_caller_role = 'authenticated' AND v_caller_uid IS NOT NULL AND v_caller_uid <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = p_user_id
      AND p.role = 'admin'
  ) INTO v_is_admin;

  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = p_user_id
      AND s.status = 'active'
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ) INTO v_is_paid;

  v_is_paid := v_is_paid OR v_is_admin;

  INSERT INTO public.user_credits (
    user_id,
    credits,
    lifetime_credits,
    free_daily_used,
    free_daily_date
  )
  VALUES (p_user_id, 10, 10, 0, v_today)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT uc.credits,
         uc.free_daily_used,
         uc.free_daily_date
    INTO v_current_credits,
         v_current_used,
         v_current_date
  FROM public.user_credits uc
  WHERE uc.user_id = p_user_id
  FOR UPDATE;

  -- Reset daily usage counter on new UTC day (no credit top-up — credits are one-time)
  IF v_current_date IS DISTINCT FROM v_today THEN
    v_current_used := 0;

    UPDATE public.user_credits uc
    SET free_daily_used = 0,
        free_daily_date = v_today,
        updated_at = NOW()
    WHERE uc.user_id = p_user_id;
  END IF;

  RETURN QUERY
  SELECT
    v_current_credits,
    v_quota,
    v_current_used,
    LEAST(v_current_credits, GREATEST(v_quota - v_current_used, 0)),
    NOT v_is_paid,
    ((date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day') AT TIME ZONE 'utc')::timestamptz;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

  IF v_caller_role = 'authenticated' AND v_caller_uid IS NOT NULL AND v_caller_uid <> deduct_credits.user_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT rf.credits, rf.free_daily_limit, rf.free_daily_used, rf.is_freemium
    INTO v_current_credits, v_free_daily_limit, v_free_daily_used, v_is_freemium
  FROM public.refresh_freemium_credits(deduct_credits.user_id) rf;

  IF v_current_credits IS NULL THEN
    RETURN FALSE;
  END IF;

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

REVOKE ALL ON FUNCTION public.refresh_freemium_credits(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_freemium_credits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_freemium_credits(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.deduct_credits(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER) TO service_role;