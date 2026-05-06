-- =============================================
-- Subscriptions, webhooks and edge rate limits
-- =============================================

-- =============================================
-- SUBSCRIPTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  plan TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own subscription" ON public.subscriptions;
CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;

DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can view all subscriptions"
  ON public.subscriptions FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can insert subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can update subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- STRIPE_WEBHOOK_EVENTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  stripe_created_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 1,
  last_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status ON public.stripe_webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received_at ON public.stripe_webhook_events(received_at DESC);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view stripe webhook events" ON public.stripe_webhook_events;
CREATE POLICY "Admins can view stripe webhook events"
  ON public.stripe_webhook_events FOR SELECT
  USING (public.is_admin());

-- =============================================
-- EDGE_RATE_LIMITS
-- =============================================
CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  id BIGSERIAL PRIMARY KEY,
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(identifier, action, window_start)
);

CREATE INDEX IF NOT EXISTS idx_edge_rate_limits_action_window
  ON public.edge_rate_limits(action, window_start DESC);

CREATE INDEX IF NOT EXISTS idx_edge_rate_limits_identifier_window
  ON public.edge_rate_limits(identifier, window_start DESC);

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view edge rate limits" ON public.edge_rate_limits;
CREATE POLICY "Admins can view edge rate limits"
  ON public.edge_rate_limits FOR SELECT
  USING (public.is_admin());

-- =============================================
-- RPC: Check and increment rate limit (atomic)
-- =============================================
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_action TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, retry_after INTEGER) AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  IF p_identifier IS NULL OR length(trim(p_identifier)) = 0 THEN
    RETURN QUERY SELECT false, 0, GREATEST(p_window_seconds, 1);
    RETURN;
  END IF;

  IF p_action IS NULL OR length(trim(p_action)) = 0 THEN
    RETURN QUERY SELECT false, 0, GREATEST(p_window_seconds, 1);
    RETURN;
  END IF;

  IF p_limit <= 0 THEN
    RETURN QUERY SELECT false, 0, GREATEST(p_window_seconds, 1);
    RETURN;
  END IF;

  IF p_window_seconds <= 0 THEN
    p_window_seconds := 60;
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.edge_rate_limits (identifier, action, window_start, request_count)
  VALUES (p_identifier, p_action, v_window_start, 1)
  ON CONFLICT (identifier, action, window_start)
  DO UPDATE SET
    request_count = edge_rate_limits.request_count + 1,
    updated_at = NOW()
  RETURNING request_count INTO v_count;

  allowed := v_count <= p_limit;
  remaining := GREATEST(p_limit - v_count, 0);
  retry_after := CASE
    WHEN allowed THEN 0
    ELSE p_window_seconds - (extract(epoch FROM now())::INTEGER % p_window_seconds)
  END;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RPC: Cleanup edge rate limit history
-- =============================================
CREATE OR REPLACE FUNCTION public.cleanup_edge_rate_limits(
  p_older_than_hours INTEGER DEFAULT 168,
  p_batch_limit INTEGER DEFAULT 100000
)
RETURNS INTEGER AS $$
DECLARE
  v_older_than_hours INTEGER := GREATEST(COALESCE(p_older_than_hours, 168), 1);
  v_batch_limit INTEGER := LEAST(GREATEST(COALESCE(p_batch_limit, 100000), 1), 1000000);
  v_deleted_count INTEGER := 0;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  WITH doomed AS (
    SELECT id
    FROM public.edge_rate_limits
    WHERE window_start < (NOW() - make_interval(hours => v_older_than_hours))
    ORDER BY window_start ASC
    LIMIT v_batch_limit
  )
  DELETE FROM public.edge_rate_limits erl
  USING doomed
  WHERE erl.id = doomed.id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN COALESCE(v_deleted_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.cleanup_edge_rate_limits(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_edge_rate_limits(INTEGER, INTEGER) TO service_role;