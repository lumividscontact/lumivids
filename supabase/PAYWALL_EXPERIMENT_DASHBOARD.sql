-- Paywall experiment dashboard queries
-- Run in Supabase SQL Editor after applying migration 20260510_001_paywall_conversion_events.sql

-- 1) Funnel summary by variant/source/reason (last 30 days)
WITH scoped AS (
  SELECT *
  FROM public.conversion_events
  WHERE created_at >= NOW() - INTERVAL '30 days'
    AND event_name IN ('intent_paywall_view', 'intent_paywall_checkout_click')
),
views AS (
  SELECT
    experiment_variant,
    source,
    reason,
    COUNT(*) AS views,
    COUNT(DISTINCT user_id) AS view_users
  FROM scoped
  WHERE event_name = 'intent_paywall_view'
  GROUP BY experiment_variant, source, reason
),
checkouts AS (
  SELECT
    experiment_variant,
    source,
    reason,
    COUNT(*) AS checkout_clicks,
    COUNT(DISTINCT user_id) AS checkout_users
  FROM scoped
  WHERE event_name = 'intent_paywall_checkout_click'
  GROUP BY experiment_variant, source, reason
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
FROM views v
FULL OUTER JOIN checkouts c
  ON v.experiment_variant = c.experiment_variant
 AND v.source = c.source
 AND v.reason = c.reason
ORDER BY source, reason, experiment_variant;

-- 2) Daily trend by variant (views and checkout clicks)
WITH scoped AS (
  SELECT
    date_trunc('day', created_at)::date AS day,
    experiment_variant,
    event_name,
    COUNT(*) AS events
  FROM public.conversion_events
  WHERE created_at >= NOW() - INTERVAL '30 days'
    AND event_name IN ('intent_paywall_view', 'intent_paywall_checkout_click')
  GROUP BY 1, 2, 3
)
SELECT
  day,
  COALESCE(experiment_variant, 'unknown') AS experiment_variant,
  SUM(CASE WHEN event_name = 'intent_paywall_view' THEN events ELSE 0 END) AS views,
  SUM(CASE WHEN event_name = 'intent_paywall_checkout_click' THEN events ELSE 0 END) AS checkout_clicks,
  CASE
    WHEN SUM(CASE WHEN event_name = 'intent_paywall_view' THEN events ELSE 0 END) = 0 THEN 0
    ELSE ROUND(
      (
        SUM(CASE WHEN event_name = 'intent_paywall_checkout_click' THEN events ELSE 0 END)::numeric
        /
        SUM(CASE WHEN event_name = 'intent_paywall_view' THEN events ELSE 0 END)::numeric
      ) * 100,
      2
    )
  END AS click_through_rate
FROM scoped
GROUP BY day, COALESCE(experiment_variant, 'unknown')
ORDER BY day ASC, experiment_variant ASC;

-- 3) Best converting sources in treatment variant
WITH agg AS (
  SELECT
    source,
    reason,
    event_name,
    COUNT(*) AS events
  FROM public.conversion_events
  WHERE created_at >= NOW() - INTERVAL '30 days'
    AND experiment_variant = 'treatment_auto'
    AND event_name IN ('intent_paywall_view', 'intent_paywall_checkout_click')
  GROUP BY source, reason, event_name
)
SELECT
  source,
  reason,
  SUM(CASE WHEN event_name = 'intent_paywall_view' THEN events ELSE 0 END) AS views,
  SUM(CASE WHEN event_name = 'intent_paywall_checkout_click' THEN events ELSE 0 END) AS checkout_clicks,
  CASE
    WHEN SUM(CASE WHEN event_name = 'intent_paywall_view' THEN events ELSE 0 END) = 0 THEN 0
    ELSE ROUND(
      (
        SUM(CASE WHEN event_name = 'intent_paywall_checkout_click' THEN events ELSE 0 END)::numeric
        /
        SUM(CASE WHEN event_name = 'intent_paywall_view' THEN events ELSE 0 END)::numeric
      ) * 100,
      2
    )
  END AS click_through_rate
FROM agg
GROUP BY source, reason
ORDER BY click_through_rate DESC, views DESC;
