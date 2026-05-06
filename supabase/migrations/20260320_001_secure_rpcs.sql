-- =============================================
-- Security Migration: Restrict RPC access
-- =============================================

-- complete_generation: Only service_role should call this
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE n.nspname = 'public'
			AND p.proname = 'complete_generation'
			AND pg_get_function_identity_arguments(p.oid) = 'p_generation_id uuid, p_status text, p_output_url text, p_thumbnail_url text, p_error_message text'
	) THEN
		REVOKE ALL ON FUNCTION public.complete_generation(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
		REVOKE ALL ON FUNCTION public.complete_generation(UUID, TEXT, TEXT, TEXT, TEXT) FROM authenticated;
		GRANT EXECUTE ON FUNCTION public.complete_generation(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;
	END IF;
END;
$$;

-- increment_usage_stats: Only service_role should call this
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE n.nspname = 'public'
			AND p.proname = 'increment_usage_stats'
			AND pg_get_function_identity_arguments(p.oid) = 'p_user_id uuid, p_date date, p_generation_type text, p_credits_used integer, p_duration_seconds integer'
	) THEN
		REVOKE ALL ON FUNCTION public.increment_usage_stats(UUID, DATE, TEXT, INTEGER, INTEGER) FROM PUBLIC;
		REVOKE ALL ON FUNCTION public.increment_usage_stats(UUID, DATE, TEXT, INTEGER, INTEGER) FROM authenticated;
		GRANT EXECUTE ON FUNCTION public.increment_usage_stats(UUID, DATE, TEXT, INTEGER, INTEGER) TO service_role;
	END IF;
END;
$$;
