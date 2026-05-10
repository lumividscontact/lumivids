-- =============================================
-- Rebuild free credits system from scratch
-- Policy: no free credits. Users must subscribe to get credits.
-- =============================================

-- Remove old freemium structures if they exist.
DROP FUNCTION IF EXISTS public.refresh_freemium_credits(UUID);

ALTER TABLE public.user_credits
  DROP COLUMN IF EXISTS free_daily_used,
  DROP COLUMN IF EXISTS free_daily_date,
  DROP COLUMN IF EXISTS free_bonus_days_used;

-- Robust signup trigger: guarantees profile + welcome credits row.
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

  INSERT INTO public.user_credits (user_id, credits, lifetime_credits)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  BEGIN
    INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
    VALUES (NEW.id, 'bonus', 0, 0, 'Account created - no free credits');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    IF to_regclass('public.notifications') IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (
        NEW.id,
        'system',
        'Bem-vindo ao Lumivids! 🎉',
        'Assine um plano para começar a criar vídeos e imagens com IA!'
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

-- Simple balance-only deduction with self-healing row bootstrap.
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

  IF v_caller_role <> 'service_role' AND (v_caller_uid IS NULL OR v_caller_uid <> deduct_credits.user_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- New users start with 0 credits; no auto-provision.
  INSERT INTO public.user_credits (user_id, credits, lifetime_credits)
  VALUES (deduct_credits.user_id, 0, 0)
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
