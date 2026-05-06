-- =============================================
-- Usage stats table and generation RPCs
-- =============================================

-- =============================================
-- USAGE_STATS
-- =============================================
CREATE TABLE IF NOT EXISTS public.usage_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  generation_type TEXT NOT NULL,
  generation_count INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0,
  UNIQUE(user_id, date, generation_type)
);

ALTER TABLE public.usage_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own stats" ON public.usage_stats;
CREATE POLICY "Users can view their own stats"
  ON public.usage_stats FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all usage stats" ON public.usage_stats;
CREATE POLICY "Admins can view all usage stats"
  ON public.usage_stats FOR SELECT
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_usage_stats_user_date ON public.usage_stats(user_id, date);

-- =============================================
-- RPC: Increment usage stats (atomic upsert)
-- =============================================
CREATE OR REPLACE FUNCTION public.increment_usage_stats(
  p_user_id UUID,
  p_date DATE,
  p_generation_type TEXT,
  p_credits_used INTEGER,
  p_duration_seconds INTEGER DEFAULT 0
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO public.usage_stats (user_id, date, generation_type, generation_count, credits_used, total_duration_seconds)
  VALUES (p_user_id, p_date, p_generation_type, 1, p_credits_used, p_duration_seconds)
  ON CONFLICT (user_id, date, generation_type)
  DO UPDATE SET
    generation_count = usage_stats.generation_count + 1,
    credits_used = usage_stats.credits_used + EXCLUDED.credits_used,
    total_duration_seconds = usage_stats.total_duration_seconds + EXCLUDED.total_duration_seconds;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RPC: Complete generation
-- =============================================
CREATE OR REPLACE FUNCTION public.complete_generation(
  p_generation_id UUID,
  p_status TEXT,
  p_output_url TEXT DEFAULT NULL,
  p_thumbnail_url TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.generations
  SET
    status = p_status,
    output_url = COALESCE(p_output_url, output_url),
    thumbnail_url = COALESCE(p_thumbnail_url, thumbnail_url),
    error_message = p_error_message,
    completed_at = CASE WHEN p_status IN ('succeeded', 'failed', 'canceled') THEN NOW() ELSE NULL END
  WHERE id = p_generation_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;