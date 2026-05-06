-- =============================================
-- Generations audit trail
-- =============================================

CREATE TABLE IF NOT EXISTS public.generations_audit (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID,
  user_id UUID,
  replicate_prediction_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('insert', 'update', 'delete')),
  actor_user_id UUID,
  actor_role TEXT,
  row_before JSONB,
  row_after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generations_audit_generation_id
  ON public.generations_audit(generation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generations_audit_prediction_id
  ON public.generations_audit(replicate_prediction_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generations_audit_user_id
  ON public.generations_audit(user_id, created_at DESC);

ALTER TABLE public.generations_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view generations audit" ON public.generations_audit;
CREATE POLICY "Admins can view generations audit"
  ON public.generations_audit FOR SELECT
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.audit_generations_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.generations_audit (
      generation_id,
      user_id,
      replicate_prediction_id,
      event_type,
      actor_user_id,
      actor_role,
      row_before,
      row_after
    )
    VALUES (
      NEW.id,
      NEW.user_id,
      NEW.replicate_prediction_id,
      'insert',
      auth.uid(),
      auth.role(),
      NULL,
      to_jsonb(NEW)
    );

    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.generations_audit (
      generation_id,
      user_id,
      replicate_prediction_id,
      event_type,
      actor_user_id,
      actor_role,
      row_before,
      row_after
    )
    VALUES (
      NEW.id,
      NEW.user_id,
      COALESCE(NEW.replicate_prediction_id, OLD.replicate_prediction_id),
      'update',
      auth.uid(),
      auth.role(),
      to_jsonb(OLD),
      to_jsonb(NEW)
    );

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.generations_audit (
      generation_id,
      user_id,
      replicate_prediction_id,
      event_type,
      actor_user_id,
      actor_role,
      row_before,
      row_after
    )
    VALUES (
      OLD.id,
      OLD.user_id,
      OLD.replicate_prediction_id,
      'delete',
      auth.uid(),
      auth.role(),
      to_jsonb(OLD),
      NULL
    );

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ language 'plpgsql' SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS audit_generations_changes ON public.generations;
CREATE TRIGGER audit_generations_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.generations
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_generations_changes();