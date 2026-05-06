-- =============================================
-- Product features: favorites, prompts, notifications, support and flags
-- =============================================

-- =============================================
-- FAVORITES
-- =============================================
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  generation_id UUID REFERENCES public.generations(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, generation_id)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own favorites" ON public.favorites;
CREATE POLICY "Users can view their own favorites"
  ON public.favorites FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own favorites" ON public.favorites;
CREATE POLICY "Users can insert their own favorites"
  ON public.favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own favorites" ON public.favorites;
CREATE POLICY "Users can delete their own favorites"
  ON public.favorites FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_generation_id ON public.favorites(generation_id);

-- =============================================
-- SAVED_PROMPTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.saved_prompts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  category TEXT,
  tags TEXT[],
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.saved_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own prompts" ON public.saved_prompts;
CREATE POLICY "Users can manage their own prompts"
  ON public.saved_prompts FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_saved_prompts_user_id ON public.saved_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_prompts_category ON public.saved_prompts(category);

DROP TRIGGER IF EXISTS update_saved_prompts_updated_at ON public.saved_prompts;
CREATE TRIGGER update_saved_prompts_updated_at
  BEFORE UPDATE ON public.saved_prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- API_KEYS
-- =============================================
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  permissions JSONB DEFAULT '{"read": true, "write": true}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own API keys" ON public.api_keys;
CREATE POLICY "Users can manage their own API keys"
  ON public.api_keys FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash);

-- =============================================
-- NOTIFICATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own notifications" ON public.notifications;
CREATE POLICY "Users can manage their own notifications"
  ON public.notifications FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;
CREATE POLICY "Admins can view all notifications"
  ON public.notifications FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- =============================================
-- CONTENT_FLAGS
-- =============================================
CREATE TABLE IF NOT EXISTS public.content_flags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  generation_id UUID REFERENCES public.generations(id) ON DELETE CASCADE NOT NULL,
  reporter_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'dismissed', 'removed')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.content_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create content flags" ON public.content_flags;
CREATE POLICY "Users can create content flags"
  ON public.content_flags FOR INSERT
  WITH CHECK (reporter_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own content flags" ON public.content_flags;
CREATE POLICY "Users can view own content flags"
  ON public.content_flags FOR SELECT
  USING (reporter_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all content flags" ON public.content_flags;
CREATE POLICY "Admins can view all content flags"
  ON public.content_flags FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update content flags" ON public.content_flags;
CREATE POLICY "Admins can update content flags"
  ON public.content_flags FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_content_flags_status ON public.content_flags(status);
CREATE INDEX IF NOT EXISTS idx_content_flags_created_at ON public.content_flags(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_flags_generation_id ON public.content_flags(generation_id);

-- =============================================
-- PROMPT_BLACKLIST
-- =============================================
CREATE TABLE IF NOT EXISTS public.prompt_blacklist (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pattern TEXT NOT NULL,
  reason TEXT,
  is_regex BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.prompt_blacklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view active blacklist" ON public.prompt_blacklist;
CREATE POLICY "Authenticated can view active blacklist"
  ON public.prompt_blacklist FOR SELECT
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage prompt blacklist" ON public.prompt_blacklist;
CREATE POLICY "Admins can manage prompt blacklist"
  ON public.prompt_blacklist FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_prompt_blacklist_active ON public.prompt_blacklist(is_active);

-- =============================================
-- AI_MODEL_SETTINGS
-- =============================================
CREATE TABLE IF NOT EXISTS public.ai_model_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  model_id TEXT UNIQUE NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  credit_cost_override INTEGER,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_model_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view model settings" ON public.ai_model_settings;
CREATE POLICY "Authenticated can view model settings"
  ON public.ai_model_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage model settings" ON public.ai_model_settings;
CREATE POLICY "Admins can manage model settings"
  ON public.ai_model_settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================
-- PLAN_LIMITS
-- =============================================
CREATE TABLE IF NOT EXISTS public.plan_limits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  plan TEXT UNIQUE NOT NULL,
  max_concurrent_generations INTEGER NOT NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view plan limits" ON public.plan_limits;
CREATE POLICY "Authenticated can view plan limits"
  ON public.plan_limits FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage plan limits" ON public.plan_limits;
CREATE POLICY "Admins can manage plan limits"
  ON public.plan_limits FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================
-- SYSTEM_SETTINGS
-- =============================================
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view system settings" ON public.system_settings;
CREATE POLICY "Authenticated can view system settings"
  ON public.system_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage system settings" ON public.system_settings;
CREATE POLICY "Admins can manage system settings"
  ON public.system_settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================
-- FEATURE_FLAGS
-- =============================================
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view feature flags" ON public.feature_flags;
CREATE POLICY "Authenticated can view feature flags"
  ON public.feature_flags FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage feature flags" ON public.feature_flags;
CREATE POLICY "Admins can manage feature flags"
  ON public.feature_flags FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================
-- SUPPORT_TICKETS
-- =============================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_by_admin BOOLEAN NOT NULL DEFAULT false,
  assigned_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tickets" ON public.support_tickets;
CREATE POLICY "Users can view own tickets"
  ON public.support_tickets FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own tickets" ON public.support_tickets;
CREATE POLICY "Users can create own tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage support tickets" ON public.support_tickets;
CREATE POLICY "Admins can manage support tickets"
  ON public.support_tickets FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);

-- =============================================
-- SUPPORT_MESSAGES
-- =============================================
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin', 'system')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own ticket messages" ON public.support_messages;
CREATE POLICY "Users can view own ticket messages"
  ON public.support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can add own ticket messages" ON public.support_messages;
CREATE POLICY "Users can add own ticket messages"
  ON public.support_messages FOR INSERT
  WITH CHECK (
    sender_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage support messages" ON public.support_messages;
CREATE POLICY "Admins can manage support messages"
  ON public.support_messages FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON public.support_messages(ticket_id);

-- =============================================
-- USER_INTERNAL_NOTES
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_internal_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_internal_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage internal notes" ON public.user_internal_notes;
CREATE POLICY "Admins can manage internal notes"
  ON public.user_internal_notes FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_user_internal_notes_user_id ON public.user_internal_notes(user_id);

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_publication p ON p.oid = pr.prpubid
      WHERE p.pubname = 'supabase_realtime'
        AND c.relname = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_publication p ON p.oid = pr.prpubid
      WHERE p.pubname = 'supabase_realtime'
        AND c.relname = 'user_credits'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.user_credits;
    END IF;
  END IF;
END $$;