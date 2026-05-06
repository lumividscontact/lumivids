-- =============================================
-- Credits system core
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- USER_CREDITS
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_credits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  credits INTEGER DEFAULT 10 NOT NULL CHECK (credits >= 0),
  lifetime_credits INTEGER DEFAULT 10 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own credits" ON public.user_credits;
CREATE POLICY "Users can view their own credits"
  ON public.user_credits FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Users can update their own credits" ON public.user_credits;

DROP POLICY IF EXISTS "Admins can view all credits" ON public.user_credits;
CREATE POLICY "Admins can view all credits"
  ON public.user_credits FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all credits" ON public.user_credits;
CREATE POLICY "Admins can update all credits"
  ON public.user_credits FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS update_user_credits_updated_at ON public.user_credits;
CREATE TRIGGER update_user_credits_updated_at
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- CREDIT_TRANSACTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  reference_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own transactions" ON public.credit_transactions;
CREATE POLICY "Users can view their own transactions"
  ON public.credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all transactions" ON public.credit_transactions;
CREATE POLICY "Admins can view all transactions"
  ON public.credit_transactions FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.credit_transactions;
CREATE POLICY "Users can insert their own transactions"
  ON public.credit_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);

-- =============================================
-- AUTO-CREATE PROFILE & CREDITS ON SIGNUP
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_credits (user_id, credits, lifetime_credits)
  VALUES (NEW.id, 10, 10)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
  VALUES (NEW.id, 'bonus', 10, 10, 'Welcome bonus - 10 credits');

  -- notifications may be migrated later; avoid breaking signup trigger meanwhile.
  IF to_regclass('public.notifications') IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      NEW.id,
      'system',
      'Welcome to Lumivids! 🎉',
      'You received 10 bonus credits to start creating amazing AI videos and images!'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- RPC: Deduct credits
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

  IF v_caller_role <> 'service_role' AND (v_caller_uid IS NULL OR v_caller_uid <> deduct_credits.user_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

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

-- =============================================
-- RPC: Add credits
-- =============================================
CREATE OR REPLACE FUNCTION public.add_credits(
  user_id UUID,
  amount INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_current_credits INTEGER;
  v_new_balance INTEGER;
  v_caller_role TEXT;
BEGIN
  v_caller_role := COALESCE(auth.role(), '');

  IF v_caller_role <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT credits INTO v_current_credits
  FROM public.user_credits uc
  WHERE uc.user_id = add_credits.user_id
  FOR UPDATE;

  IF v_current_credits IS NULL THEN
    INSERT INTO public.user_credits (user_id, credits, lifetime_credits)
    VALUES (add_credits.user_id, add_credits.amount, add_credits.amount)
    ON CONFLICT (user_id) DO UPDATE SET
      credits = user_credits.credits + add_credits.amount,
      lifetime_credits = user_credits.lifetime_credits + add_credits.amount;
    v_new_balance := add_credits.amount;
  ELSE
    v_new_balance := v_current_credits + add_credits.amount;

    UPDATE public.user_credits uc
    SET credits = v_new_balance,
        lifetime_credits = lifetime_credits + add_credits.amount,
        updated_at = NOW()
    WHERE uc.user_id = add_credits.user_id;
  END IF;

  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
  VALUES (add_credits.user_id, 'purchase', add_credits.amount, v_new_balance, 'Credits added');

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RPC: Refund credits (accounting-safe)
-- =============================================
CREATE OR REPLACE FUNCTION public.refund_credits(
  user_id UUID,
  amount INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_current_credits INTEGER;
  v_new_balance INTEGER;
  v_caller_role TEXT;
BEGIN
  v_caller_role := COALESCE(auth.role(), '');

  IF v_caller_role <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT credits INTO v_current_credits
  FROM public.user_credits uc
  WHERE uc.user_id = refund_credits.user_id
  FOR UPDATE;

  IF v_current_credits IS NULL THEN
    INSERT INTO public.user_credits (user_id, credits, lifetime_credits)
    VALUES (refund_credits.user_id, refund_credits.amount, 0)
    ON CONFLICT (user_id) DO UPDATE SET
      credits = user_credits.credits + refund_credits.amount;
    v_new_balance := refund_credits.amount;
  ELSE
    v_new_balance := v_current_credits + refund_credits.amount;

    UPDATE public.user_credits uc
    SET credits = v_new_balance,
        updated_at = NOW()
    WHERE uc.user_id = refund_credits.user_id;
  END IF;

  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
  VALUES (refund_credits.user_id, 'refund', refund_credits.amount, v_new_balance, 'Credits refunded');

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RPC: Claim generation refundable credits (atomic)
-- =============================================
CREATE OR REPLACE FUNCTION public.claim_generation_refund_credits(
  p_user_id UUID,
  p_prediction_id TEXT,
  p_status TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_refund_amount INTEGER := 0;
BEGIN
  WITH target AS (
    SELECT g.id, g.credits_used
    FROM public.generations g
    WHERE g.user_id = p_user_id
      AND g.replicate_prediction_id = p_prediction_id
      AND g.credits_used > 0
    FOR UPDATE
  ), updated AS (
    UPDATE public.generations g
    SET
      credits_used = 0,
      status = COALESCE(p_status, g.status),
      updated_at = NOW(),
      completed_at = CASE
        WHEN COALESCE(p_status, g.status) IN ('succeeded', 'failed', 'canceled') THEN COALESCE(g.completed_at, NOW())
        ELSE g.completed_at
      END
    FROM target t
    WHERE g.id = t.id
    RETURNING t.credits_used AS refund_amount
  )
  SELECT COALESCE(SUM(refund_amount), 0) INTO v_refund_amount
  FROM updated;

  RETURN COALESCE(v_refund_amount, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RPC: Cleanup stale generations + auto-refund
-- =============================================
CREATE OR REPLACE FUNCTION public.cleanup_stale_generations(
  p_stale_after_minutes INTEGER DEFAULT 45,
  p_batch_limit INTEGER DEFAULT 100
)
RETURNS TABLE(processed_count INTEGER, refunded_total INTEGER) AS $$
DECLARE
  v_stale_after_minutes INTEGER := GREATEST(COALESCE(p_stale_after_minutes, 45), 5);
  v_batch_limit INTEGER := LEAST(GREATEST(COALESCE(p_batch_limit, 100), 1), 1000);
  v_now TIMESTAMPTZ := NOW();
  v_processed INTEGER := 0;
  v_refunded INTEGER := 0;
  v_claim_amount INTEGER := 0;
  rec RECORD;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  FOR rec IN
    SELECT g.user_id, g.replicate_prediction_id
    FROM public.generations g
    WHERE g.status IN ('starting', 'processing')
      AND g.replicate_prediction_id IS NOT NULL
      AND COALESCE(g.updated_at, g.created_at) < (v_now - make_interval(mins => v_stale_after_minutes))
    ORDER BY COALESCE(g.updated_at, g.created_at) ASC
    LIMIT v_batch_limit
  LOOP
    SELECT public.claim_generation_refund_credits(
      rec.user_id,
      rec.replicate_prediction_id,
      'failed'
    )
    INTO v_claim_amount;

    IF COALESCE(v_claim_amount, 0) > 0 THEN
      PERFORM public.refund_credits(rec.user_id, v_claim_amount);
      v_refunded := v_refunded + v_claim_amount;
    ELSE
      UPDATE public.generations g
      SET
        status = 'failed',
        error_message = COALESCE(g.error_message, 'Generation timed out waiting for provider callback'),
        completed_at = COALESCE(g.completed_at, v_now),
        updated_at = v_now
      WHERE g.user_id = rec.user_id
        AND g.replicate_prediction_id = rec.replicate_prediction_id
        AND g.status IN ('starting', 'processing');
    END IF;

    v_processed := v_processed + 1;
  END LOOP;

  processed_count := v_processed;
  refunded_total := v_refunded;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.add_credits(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deduct_credits(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_generation_refund_credits(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_stale_generations(INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_credits(UUID, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.add_credits(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_generation_refund_credits(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_generations(INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_credits(UUID, INTEGER) TO service_role;