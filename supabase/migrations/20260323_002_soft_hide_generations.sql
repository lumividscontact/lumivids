-- =============================================
-- Soft-hide generations instead of deleting rows
-- =============================================

ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

DROP POLICY IF EXISTS "Users can delete their own generations" ON public.generations;

CREATE INDEX IF NOT EXISTS idx_generations_user_hidden_created_at
  ON public.generations(user_id, hidden_at, created_at DESC);