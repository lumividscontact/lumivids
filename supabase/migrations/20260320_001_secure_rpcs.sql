-- =============================================
-- Security Migration: Restrict RPC access
-- =============================================

-- complete_generation: Only service_role should call this
REVOKE ALL ON FUNCTION public.complete_generation(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_generation(UUID, TEXT, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_generation(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- increment_usage_stats: Only service_role should call this
REVOKE ALL ON FUNCTION public.increment_usage_stats(UUID, DATE, TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_usage_stats(UUID, DATE, TEXT, INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_usage_stats(UUID, DATE, TEXT, INTEGER, INTEGER) TO service_role;
