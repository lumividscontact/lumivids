-- Ensure starter plan is included in admin revenue reports
-- and has a concurrency limit configured.

CREATE OR REPLACE FUNCTION public.admin_reports_summary()
RETURNS TABLE(
  generations_per_day JSONB,
  new_users_per_week JSONB,
  monthly_mrr JSONB,
  conversion_rate NUMERIC,
  top_models JSONB,
  top_users_by_credits JSONB,
  current_mrr NUMERIC
) AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_date_30_start DATE := (NOW() - INTERVAL '29 days')::DATE;
  v_date_84_start TIMESTAMPTZ := NOW() - INTERVAL '84 days';
  v_date_90_start TIMESTAMPTZ := NOW() - INTERVAL '90 days';
  v_month_start DATE := date_trunc('month', NOW())::DATE;
  v_month_12_start DATE := (date_trunc('month', NOW()) - INTERVAL '11 months')::DATE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  WITH
  day_series AS (
    SELECT generate_series(v_date_30_start, v_now::DATE, INTERVAL '1 day')::DATE AS day
  ),
  day_counts AS (
    SELECT g.created_at::DATE AS day, COUNT(*)::BIGINT AS count
    FROM public.generations g
    WHERE g.created_at >= v_date_30_start
    GROUP BY 1
  ),
  generations_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'label', to_char(ds.day, 'MM-DD'),
          'value', COALESCE(dc.count, 0)
        )
        ORDER BY ds.day
      ),
      '[]'::JSONB
    ) AS value
    FROM day_series ds
    LEFT JOIN day_counts dc ON dc.day = ds.day
  ),
  week_series AS (
    SELECT generate_series(
      (date_trunc('week', v_now)::DATE - INTERVAL '11 weeks')::DATE,
      date_trunc('week', v_now)::DATE,
      INTERVAL '1 week'
    )::DATE AS week_start
  ),
  week_counts AS (
    SELECT date_trunc('week', p.created_at)::DATE AS week_start, COUNT(*)::BIGINT AS count
    FROM public.profiles p
    WHERE p.created_at >= v_date_84_start
    GROUP BY 1
  ),
  users_week_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'label', to_char(ws.week_start, 'MM-DD'),
          'value', COALESCE(wc.count, 0)
        )
        ORDER BY ws.week_start
      ),
      '[]'::JSONB
    ) AS value
    FROM week_series ws
    LEFT JOIN week_counts wc ON wc.week_start = ws.week_start
  ),
  month_series AS (
    SELECT generate_series(v_month_12_start, v_month_start, INTERVAL '1 month')::DATE AS month_start
  ),
  revenue_raw AS (
    SELECT
      date_trunc('month', COALESCE(s.current_period_start, s.created_at))::DATE AS month_start,
      SUM(
        CASE
          WHEN s.plan = 'starter' THEN CASE WHEN COALESCE(s.stripe_price_id, '') ~* '(annual|year)' THEN 6.3 ELSE 7.9 END
          WHEN s.plan = 'creator' THEN CASE WHEN COALESCE(s.stripe_price_id, '') ~* '(annual|year)' THEN 11.9 ELSE 14.9 END
          WHEN s.plan = 'studio' THEN CASE WHEN COALESCE(s.stripe_price_id, '') ~* '(annual|year)' THEN 23.9 ELSE 29.9 END
          WHEN s.plan = 'director' THEN CASE WHEN COALESCE(s.stripe_price_id, '') ~* '(annual|year)' THEN 55.9 ELSE 69.9 END
          ELSE 0
        END
      )::NUMERIC AS value
    FROM public.subscriptions s
    WHERE s.plan IS NOT NULL
      AND s.status IN ('active', 'trialing', 'past_due')
      AND COALESCE(s.current_period_start, s.created_at) >= v_month_12_start
    GROUP BY 1
  ),
  month_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'month', to_char(ms.month_start, 'YYYY-MM'),
          'value', ROUND(COALESCE(rr.value, 0), 2)
        )
        ORDER BY ms.month_start
      ),
      '[]'::JSONB
    ) AS value
    FROM month_series ms
    LEFT JOIN revenue_raw rr ON rr.month_start = ms.month_start
  ),
  current_mrr_cte AS (
    SELECT ROUND(COALESCE(rr.value, 0), 2) AS value
    FROM month_series ms
    LEFT JOIN revenue_raw rr ON rr.month_start = ms.month_start
    ORDER BY ms.month_start DESC
    LIMIT 1
  ),
  paid_users AS (
    SELECT COUNT(DISTINCT s.user_id)::NUMERIC AS count
    FROM public.subscriptions s
    WHERE s.plan IS NOT NULL
      AND s.status IN ('active', 'trialing', 'past_due')
  ),
  total_users AS (
    SELECT COUNT(*)::NUMERIC AS count
    FROM public.profiles
  ),
  top_models_cte AS (
    SELECT
      COALESCE(NULLIF(TRIM(g.model_name), ''), 'unknown') AS model,
      COUNT(*)::BIGINT AS count
    FROM public.generations g
    WHERE g.created_at >= v_date_90_start
    GROUP BY 1
    ORDER BY count DESC
    LIMIT 10
  ),
  top_models_json AS (
    SELECT COALESCE(
      jsonb_agg(jsonb_build_object('model', tm.model, 'count', tm.count) ORDER BY tm.count DESC),
      '[]'::JSONB
    ) AS value
    FROM top_models_cte tm
  ),
  credits_30d AS (
    SELECT us.user_id, SUM(COALESCE(us.credits_used, 0))::BIGINT AS credits_used
    FROM public.usage_stats us
    WHERE us.date >= v_date_30_start
    GROUP BY us.user_id
    ORDER BY credits_used DESC
    LIMIT 10
  ),
  top_users_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'userId', c.user_id,
          'name', COALESCE(p.display_name, '-'),
          'email', COALESCE(p.email, '-'),
          'creditsUsed', c.credits_used
        )
        ORDER BY c.credits_used DESC
      ),
      '[]'::JSONB
    ) AS value
    FROM credits_30d c
    LEFT JOIN public.profiles p ON p.user_id = c.user_id
  )
  SELECT
    (SELECT value FROM generations_json),
    (SELECT value FROM users_week_json),
    (SELECT value FROM month_json),
    (
      CASE
        WHEN (SELECT count FROM total_users) > 0
          THEN ROUND(((SELECT count FROM paid_users) / (SELECT count FROM total_users)) * 100, 2)
        ELSE 0
      END
    )::NUMERIC,
    (SELECT value FROM top_models_json),
    (SELECT value FROM top_users_json),
    COALESCE((SELECT value FROM current_mrr_cte), 0)::NUMERIC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure starter plan has a concurrency limit entry.
INSERT INTO public.plan_limits (plan, max_concurrent_generations)
VALUES ('starter', 1)
ON CONFLICT (plan) DO UPDATE
SET max_concurrent_generations = EXCLUDED.max_concurrent_generations,
    updated_at = NOW();
