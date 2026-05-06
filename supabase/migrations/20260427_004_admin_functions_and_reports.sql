-- =============================================
-- Admin functions and reports
-- =============================================

CREATE OR REPLACE FUNCTION public.admin_adjust_user_credits(
  p_user_id UUID,
  p_delta INTEGER,
  p_description TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  IF p_delta IS NULL OR p_delta = 0 THEN
    SELECT credits INTO v_new_balance
    FROM public.user_credits
    WHERE user_id = p_user_id;

    RETURN COALESCE(v_new_balance, 0);
  END IF;

  INSERT INTO public.user_credits (user_id, credits, updated_at)
  VALUES (p_user_id, GREATEST(p_delta, 0), NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    credits = GREATEST(0, user_credits.credits + p_delta),
    updated_at = NOW()
  RETURNING credits INTO v_new_balance;

  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    description,
    reference_id,
    metadata
  )
  VALUES (
    p_user_id,
    CASE WHEN p_delta >= 0 THEN 'bonus' ELSE 'refund' END,
    p_delta,
    v_new_balance,
    COALESCE(p_description, 'Ajuste manual de creditos (admin)'),
    'admin_adjust_credits',
    jsonb_build_object('admin_user_id', auth.uid())
  );

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_grant_bulk_credits(
  p_amount INTEGER,
  p_target_plan TEXT DEFAULT 'all',
  p_subscription_status TEXT DEFAULT 'all',
  p_description TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_updated_users INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'p_amount must be > 0';
  END IF;

  WITH target_users AS (
    SELECT p.user_id
    FROM public.profiles p
    LEFT JOIN public.subscriptions s ON s.user_id = p.user_id
    WHERE (
      p_target_plan = 'all'
      OR (p_target_plan = 'free' AND (s.user_id IS NULL OR s.plan IS NULL OR s.plan = 'free'))
      OR (p_target_plan <> 'free' AND s.plan = p_target_plan)
    )
    AND (
      p_subscription_status = 'all'
      OR COALESCE(s.status, 'canceled') = p_subscription_status
    )
  ),
  updated_credits AS (
    INSERT INTO public.user_credits (user_id, credits, updated_at)
    SELECT t.user_id, p_amount, NOW()
    FROM target_users t
    ON CONFLICT (user_id)
    DO UPDATE SET
      credits = user_credits.credits + p_amount,
      updated_at = NOW()
    RETURNING user_id, credits
  ),
  inserted_transactions AS (
    INSERT INTO public.credit_transactions (
      user_id,
      type,
      amount,
      balance_after,
      description,
      reference_id,
      metadata
    )
    SELECT
      u.user_id,
      'bonus',
      p_amount,
      u.credits,
      COALESCE(p_description, 'Promocao em massa (admin)'),
      'admin_bulk_credits',
      jsonb_build_object(
        'admin_user_id', auth.uid(),
        'target_plan', p_target_plan,
        'subscription_status', p_subscription_status
      )
    FROM updated_credits u
    RETURNING user_id
  ),
  inserted_notifications AS (
    INSERT INTO public.notifications (user_id, type, title, message)
    SELECT
      t.user_id,
      'system',
      'Bonus de creditos',
      format(
        '%s. Foram adicionados %s creditos a sua conta.',
        COALESCE(p_description, format('Promocao em massa (+%s creditos)', p_amount)),
        p_amount
      )
    FROM inserted_transactions t
    RETURNING user_id
  )
  SELECT COUNT(*)::INTEGER INTO v_updated_users
  FROM inserted_notifications;

  RETURN COALESCE(v_updated_users, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_send_bulk_notification(
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'system',
  p_target_plan TEXT DEFAULT 'all'
)
RETURNS INTEGER AS $$
DECLARE
  v_inserted_count INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'p_title is required';
  END IF;

  IF p_message IS NULL OR length(trim(p_message)) = 0 THEN
    RAISE EXCEPTION 'p_message is required';
  END IF;

  IF p_type IS NULL OR p_type NOT IN ('system', 'subscription', 'credits_low') THEN
    RAISE EXCEPTION 'p_type invalido';
  END IF;

  WITH target_users AS (
    SELECT p.user_id
    FROM public.profiles p
    LEFT JOIN public.subscriptions s ON s.user_id = p.user_id
    WHERE (
      p_target_plan = 'all'
      OR (p_target_plan = 'free' AND (s.user_id IS NULL OR s.plan IS NULL OR s.plan = 'free'))
      OR (p_target_plan <> 'free' AND s.plan = p_target_plan)
    )
  ),
  inserted_notifications AS (
    INSERT INTO public.notifications (user_id, type, title, message)
    SELECT
      t.user_id,
      p_type,
      trim(p_title),
      trim(p_message)
    FROM target_users t
    RETURNING user_id
  )
  SELECT COUNT(*)::INTEGER INTO v_inserted_count
  FROM inserted_notifications;

  RETURN COALESCE(v_inserted_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_force_logout_user(
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  UPDATE public.profiles
  SET force_logout_at = NOW()
  WHERE user_id = p_user_id;

  DELETE FROM auth.sessions
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  p_user_id UUID,
  p_role TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('user', 'admin') THEN
    RAISE EXCEPTION 'p_role must be user or admin';
  END IF;

  IF auth.uid() = p_user_id AND p_role <> 'admin' THEN
    RAISE EXCEPTION 'Cannot remove your own admin role';
  END IF;

  UPDATE public.profiles
  SET role = p_role
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_guard_password_reset(
  p_target_email TEXT,
  p_admin_limit INTEGER DEFAULT 20,
  p_target_limit INTEGER DEFAULT 3,
  p_window_seconds INTEGER DEFAULT 3600
)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_id UUID;
  v_email TEXT;
  v_window_start TIMESTAMPTZ;
  v_admin_count INTEGER;
  v_target_count INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin session required';
  END IF;

  v_email := lower(trim(p_target_email));
  IF v_email IS NULL OR length(v_email) = 0 THEN
    RAISE EXCEPTION 'p_target_email is required';
  END IF;

  IF p_admin_limit <= 0 OR p_target_limit <= 0 THEN
    RAISE EXCEPTION 'Limits must be > 0';
  END IF;

  IF p_window_seconds <= 0 THEN
    p_window_seconds := 3600;
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.edge_rate_limits (identifier, action, window_start, request_count)
  VALUES (v_admin_id::TEXT, 'admin_password_reset_by_admin', v_window_start, 1)
  ON CONFLICT (identifier, action, window_start)
  DO UPDATE SET
    request_count = edge_rate_limits.request_count + 1,
    updated_at = NOW()
  RETURNING request_count INTO v_admin_count;

  IF v_admin_count > p_admin_limit THEN
    RAISE EXCEPTION 'Admin reset password rate limit exceeded';
  END IF;

  INSERT INTO public.edge_rate_limits (identifier, action, window_start, request_count)
  VALUES (v_email, 'admin_password_reset_target', v_window_start, 1)
  ON CONFLICT (identifier, action, window_start)
  DO UPDATE SET
    request_count = edge_rate_limits.request_count + 1,
    updated_at = NOW()
  RETURNING request_count INTO v_target_count;

  IF v_target_count > p_target_limit THEN
    RAISE EXCEPTION 'Target email reset password rate limit exceeded';
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_generation_analytics(
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE(
  total BIGINT,
  succeeded BIGINT,
  failed BIGINT,
  processing BIGINT,
  canceled BIGINT,
  last_n_days BIGINT,
  credits_last_n_days BIGINT,
  top_models JSONB
) AS $$
DECLARE
  v_since TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  v_since := NOW() - make_interval(days => GREATEST(COALESCE(p_days, 7), 1));

  RETURN QUERY
  WITH model_counts AS (
    SELECT
      COALESCE(NULLIF(TRIM(g.model_name), ''), 'unknown') AS model,
      COUNT(*)::BIGINT AS count
    FROM public.generations g
    GROUP BY 1
    ORDER BY count DESC
    LIMIT 5
  )
  SELECT
    COUNT(*)::BIGINT AS total,
    COUNT(*) FILTER (WHERE g.status = 'succeeded')::BIGINT AS succeeded,
    COUNT(*) FILTER (WHERE g.status = 'failed')::BIGINT AS failed,
    COUNT(*) FILTER (WHERE g.status IN ('starting', 'processing'))::BIGINT AS processing,
    COUNT(*) FILTER (WHERE g.status = 'canceled')::BIGINT AS canceled,
    COUNT(*) FILTER (WHERE g.created_at >= v_since)::BIGINT AS last_n_days,
    COALESCE(SUM(CASE WHEN g.created_at >= v_since THEN COALESCE(g.credits_used, 0) ELSE 0 END), 0)::BIGINT AS credits_last_n_days,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('model', mc.model, 'count', mc.count) ORDER BY mc.count DESC)
      FROM model_counts mc
    ), '[]'::jsonb) AS top_models
  FROM public.generations g;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_stats_summary()
RETURNS TABLE(
  total_users BIGINT,
  active_subscriptions BIGINT,
  total_credits_in_circulation BIGINT,
  total_generations BIGINT
) AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::BIGINT FROM public.profiles) AS total_users,
    (SELECT COUNT(*)::BIGINT FROM public.subscriptions s WHERE s.status = 'active') AS active_subscriptions,
    (SELECT COALESCE(SUM(uc.credits), 0)::BIGINT FROM public.user_credits uc) AS total_credits_in_circulation,
    (SELECT COALESCE(SUM(us.generation_count), 0)::BIGINT FROM public.usage_stats us) AS total_generations;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

REVOKE ALL ON FUNCTION public.admin_adjust_user_credits(UUID, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_grant_bulk_credits(INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_send_bulk_notification(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_force_logout_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_generation_analytics(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_stats_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reports_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_user_role(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_guard_password_reset(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.admin_adjust_user_credits(UUID, INTEGER, TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_grant_bulk_credits(INTEGER, TEXT, TEXT, TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_send_bulk_notification(TEXT, TEXT, TEXT, TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_force_logout_user(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_generation_analytics(INTEGER) FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_stats_summary() FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_reports_summary() FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_update_user_role(UUID, TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_guard_password_reset(TEXT, INTEGER, INTEGER, INTEGER) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.admin_adjust_user_credits(UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_grant_bulk_credits(INTEGER, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_send_bulk_notification(TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_force_logout_user(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_generation_analytics(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_stats_summary() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reports_summary() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_guard_password_reset(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;