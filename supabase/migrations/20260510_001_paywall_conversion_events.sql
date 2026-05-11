-- =============================================
-- Paywall conversion events for A/B funnel analysis
-- =============================================

CREATE TABLE IF NOT EXISTS public.conversion_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  event_name TEXT NOT NULL,
  source TEXT,
  reason TEXT,
  experiment_variant TEXT,
  plan_id TEXT,
  billing_period TEXT,
  required_credits INTEGER,
  current_credits INTEGER,
  credits_deficit INTEGER,
  value NUMERIC(10,2),
  currency TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversion_events_event_time
  ON public.conversion_events(event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversion_events_variant_time
  ON public.conversion_events(experiment_variant, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversion_events_user_time
  ON public.conversion_events(user_id, created_at DESC);

ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own conversion events" ON public.conversion_events;
CREATE POLICY "Users can insert their own conversion events"
  ON public.conversion_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own conversion events" ON public.conversion_events;
CREATE POLICY "Users can view their own conversion events"
  ON public.conversion_events FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all conversion events" ON public.conversion_events;
CREATE POLICY "Admins can view all conversion events"
  ON public.conversion_events FOR SELECT
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_paywall_experiment_funnel(
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  experiment_variant TEXT,
  source TEXT,
  reason TEXT,
  views BIGINT,
  view_users BIGINT,
  checkout_clicks BIGINT,
  checkout_users BIGINT,
  view_to_checkout_rate NUMERIC,
  view_user_to_checkout_user_rate NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped AS (
    SELECT *
    FROM public.conversion_events
    WHERE created_at >= NOW() - make_interval(days => GREATEST(p_days, 1))
      AND event_name IN ('intent_paywall_view', 'intent_paywall_checkout_click')
  )
  SELECT
    COALESCE(v.experiment_variant, c.experiment_variant, 'unknown') AS experiment_variant,
    COALESCE(v.source, c.source, 'unknown') AS source,
    COALESCE(v.reason, c.reason, 'unknown') AS reason,
    COALESCE(v.views, 0) AS views,
    COALESCE(v.view_users, 0) AS view_users,
    COALESCE(c.checkout_clicks, 0) AS checkout_clicks,
    COALESCE(c.checkout_users, 0) AS checkout_users,
    CASE
      WHEN COALESCE(v.views, 0) = 0 THEN 0
      ELSE ROUND((COALESCE(c.checkout_clicks, 0)::numeric / v.views::numeric) * 100, 2)
    END AS view_to_checkout_rate,
    CASE
      WHEN COALESCE(v.view_users, 0) = 0 THEN 0
      ELSE ROUND((COALESCE(c.checkout_users, 0)::numeric / v.view_users::numeric) * 100, 2)
    END AS view_user_to_checkout_user_rate
  FROM (
    SELECT
      experiment_variant,
      source,
      reason,
      COUNT(*) AS views,
      COUNT(DISTINCT user_id) AS view_users
    FROM scoped
    WHERE event_name = 'intent_paywall_view'
    GROUP BY experiment_variant, source, reason
  ) v
  FULL OUTER JOIN (
    SELECT
      experiment_variant,
      source,
      reason,
      COUNT(*) AS checkout_clicks,
      COUNT(DISTINCT user_id) AS checkout_users
    FROM scoped
    WHERE event_name = 'intent_paywall_checkout_click'
    GROUP BY experiment_variant, source, reason
  ) c
    ON v.experiment_variant = c.experiment_variant
   AND v.source = c.source
   AND v.reason = c.reason
  ORDER BY source, reason, experiment_variant;
$$;

REVOKE ALL ON FUNCTION public.admin_paywall_experiment_funnel(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_paywall_experiment_funnel(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_paywall_experiment_funnel(INTEGER) TO service_role;
