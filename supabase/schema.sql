-- =============================================
-- Supabase Schema for Lumivids
-- Execute this in the Supabase SQL Editor
-- Version: 3.0 - Simplified & Compatible
-- =============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROFILES
-- =============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  notifications_enabled BOOLEAN DEFAULT true,
  role TEXT NOT NULL DEFAULT 'user',
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  suspended_reason TEXT,
  must_reset_password BOOLEAN NOT NULL DEFAULT false,
  force_logout_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS force_logout_at TIMESTAMPTZ;
ALTER TABLE public.profiles ALTER COLUMN language SET DEFAULT 'en';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================
-- SUBSCRIPTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  plan TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own subscription" ON public.subscriptions;
CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;

DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can view all subscriptions"
  ON public.subscriptions FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can insert subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can update subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================
-- STRIPE_WEBHOOK_EVENTS (idempotency + replay protection audit)
-- =============================================
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  stripe_created_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 1,
  last_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status ON public.stripe_webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received_at ON public.stripe_webhook_events(received_at DESC);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view stripe webhook events" ON public.stripe_webhook_events;
CREATE POLICY "Admins can view stripe webhook events"
  ON public.stripe_webhook_events FOR SELECT
  USING (public.is_admin());

-- =============================================
-- EDGE_RATE_LIMITS (Edge Functions protection)
-- =============================================
CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  id BIGSERIAL PRIMARY KEY,
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(identifier, action, window_start)
);

CREATE INDEX IF NOT EXISTS idx_edge_rate_limits_action_window
  ON public.edge_rate_limits(action, window_start DESC);

CREATE INDEX IF NOT EXISTS idx_edge_rate_limits_identifier_window
  ON public.edge_rate_limits(identifier, window_start DESC);

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view edge rate limits" ON public.edge_rate_limits;
CREATE POLICY "Admins can view edge rate limits"
  ON public.edge_rate_limits FOR SELECT
  USING (public.is_admin());

-- =============================================
-- USER_CREDITS
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_credits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  credits INTEGER DEFAULT 10 NOT NULL CHECK (credits >= 0),
  lifetime_credits INTEGER DEFAULT 10 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own credits" ON public.user_credits;
CREATE POLICY "Users can view their own credits"
  ON public.user_credits FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Users can update their own credits" ON public.user_credits;

DROP POLICY IF EXISTS "Admins can view all credits" ON public.user_credits;
CREATE POLICY "Admins can view all credits"
  ON public.user_credits FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all credits" ON public.user_credits;
CREATE POLICY "Admins can update all credits"
  ON public.user_credits FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================
-- CREDIT_TRANSACTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  reference_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own transactions" ON public.credit_transactions;
CREATE POLICY "Users can view their own transactions"
  ON public.credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all transactions" ON public.credit_transactions;
CREATE POLICY "Admins can view all transactions"
  ON public.credit_transactions FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.credit_transactions;
CREATE POLICY "Users can insert their own transactions"
  ON public.credit_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);

-- =============================================
-- GENERATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.generations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'starting' NOT NULL,
  prompt TEXT,
  negative_prompt TEXT,
  input_image_url TEXT,
  output_url TEXT,
  thumbnail_url TEXT,
  model_id TEXT NOT NULL,
  model_name TEXT,
  settings JSONB DEFAULT '{}',
  credits_used INTEGER DEFAULT 0,
  replicate_prediction_id TEXT,
  error_message TEXT,
  is_public BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own generations" ON public.generations;
CREATE POLICY "Users can view their own generations"
  ON public.generations FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

DROP POLICY IF EXISTS "Admins can view all generations" ON public.generations;
CREATE POLICY "Admins can view all generations"
  ON public.generations FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users can insert their own generations" ON public.generations;
CREATE POLICY "Users can insert their own generations"
  ON public.generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own generations" ON public.generations;
CREATE POLICY "Users can update their own generations"
  ON public.generations FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update all generations" ON public.generations;
CREATE POLICY "Admins can update all generations"
  ON public.generations FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can delete their own generations" ON public.generations;
CREATE POLICY "Users can delete their own generations"
  ON public.generations FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_generations_user_id ON public.generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_status ON public.generations(status);
CREATE INDEX IF NOT EXISTS idx_generations_type ON public.generations(type);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON public.generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_replicate_id ON public.generations(replicate_prediction_id);
CREATE INDEX IF NOT EXISTS idx_generations_model_id ON public.generations(model_id);
CREATE INDEX IF NOT EXISTS idx_generations_user_created_at ON public.generations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_user_replicate_id ON public.generations(user_id, replicate_prediction_id);
CREATE INDEX IF NOT EXISTS idx_generations_stale_cleanup
  ON public.generations(status, updated_at)
  WHERE status IN ('starting', 'processing');

-- =============================================
-- GENERATED_VIDEOS
-- =============================================
CREATE TABLE IF NOT EXISTS public.generated_videos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  generation_id UUID REFERENCES public.generations(id) ON DELETE CASCADE NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  resolution TEXT,
  aspect_ratio TEXT,
  file_size_bytes BIGINT,
  format TEXT DEFAULT 'mp4',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.generated_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own videos" ON public.generated_videos;
CREATE POLICY "Users can view their own videos"
  ON public.generated_videos FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own videos" ON public.generated_videos;
CREATE POLICY "Users can insert their own videos"
  ON public.generated_videos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own videos" ON public.generated_videos;
CREATE POLICY "Users can delete their own videos"
  ON public.generated_videos FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_generated_videos_user_id ON public.generated_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_videos_generation_id ON public.generated_videos(generation_id);

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
-- CONTENT_FLAGS (Reports / moderation queue)
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
-- PROMPT_BLACKLIST (Blocked prompts)
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
-- SYSTEM_SETTINGS (maintenance mode, etc)
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
-- SUPPORT_MESSAGES (chat)
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

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_credits_updated_at ON public.user_credits;
CREATE TRIGGER update_user_credits_updated_at
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_generations_updated_at ON public.generations;
CREATE TRIGGER update_generations_updated_at
  BEFORE UPDATE ON public.generations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_saved_prompts_updated_at ON public.saved_prompts;
CREATE TRIGGER update_saved_prompts_updated_at
  BEFORE UPDATE ON public.saved_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- AUTO-CREATE PROFILE & CREDITS ON SIGNUP
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );

  INSERT INTO public.user_credits (user_id, credits, lifetime_credits)
  VALUES (NEW.id, 10, 10);

  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
  VALUES (NEW.id, 'bonus', 10, 10, 'Welcome bonus - 10 credits');

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (
    NEW.id,
    'system',
    'Welcome to Lumivids! 🎉',
    'You received 10 bonus credits to start creating amazing AI videos and images!'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- RPC: Deduct credits
-- =============================================
CREATE OR REPLACE FUNCTION public.deduct_credits(
  user_id UUID,
  amount INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_credits INTEGER;
  v_new_balance INTEGER;
  v_caller_role TEXT;
  v_caller_uid UUID;
BEGIN
  v_caller_role := COALESCE(auth.role(), '');
  v_caller_uid := auth.uid();

  IF v_caller_role <> 'service_role' AND (v_caller_uid IS NULL OR v_caller_uid <> deduct_credits.user_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT credits INTO v_current_credits
  FROM public.user_credits uc
  WHERE uc.user_id = deduct_credits.user_id
  FOR UPDATE;

  IF v_current_credits IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_current_credits < amount THEN
    RETURN FALSE;
  END IF;

  v_new_balance := v_current_credits - amount;

  UPDATE public.user_credits uc
  SET credits = v_new_balance,
      updated_at = NOW()
  WHERE uc.user_id = deduct_credits.user_id;

  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
  VALUES (deduct_credits.user_id, 'usage', -deduct_credits.amount, v_new_balance, 'Credits used for generation');

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RPC: Add credits
-- =============================================
CREATE OR REPLACE FUNCTION public.add_credits(
  user_id UUID,
  amount INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_current_credits INTEGER;
  v_new_balance INTEGER;
  v_caller_role TEXT;
BEGIN
  v_caller_role := COALESCE(auth.role(), '');

  IF v_caller_role <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT credits INTO v_current_credits
  FROM public.user_credits uc
  WHERE uc.user_id = add_credits.user_id
  FOR UPDATE;

  IF v_current_credits IS NULL THEN
    INSERT INTO public.user_credits (user_id, credits, lifetime_credits)
    VALUES (add_credits.user_id, add_credits.amount, add_credits.amount)
    ON CONFLICT (user_id) DO UPDATE SET
      credits = user_credits.credits + add_credits.amount,
      lifetime_credits = user_credits.lifetime_credits + add_credits.amount;
    v_new_balance := add_credits.amount;
  ELSE
    v_new_balance := v_current_credits + add_credits.amount;

    UPDATE public.user_credits uc
    SET credits = v_new_balance,
        lifetime_credits = lifetime_credits + add_credits.amount,
        updated_at = NOW()
    WHERE uc.user_id = add_credits.user_id;
  END IF;

  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
  VALUES (add_credits.user_id, 'purchase', add_credits.amount, v_new_balance, 'Credits added');

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RPC: Refund credits (accounting-safe)
-- =============================================
CREATE OR REPLACE FUNCTION public.refund_credits(
  user_id UUID,
  amount INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_current_credits INTEGER;
  v_new_balance INTEGER;
  v_caller_role TEXT;
BEGIN
  v_caller_role := COALESCE(auth.role(), '');

  IF v_caller_role <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT credits INTO v_current_credits
  FROM public.user_credits uc
  WHERE uc.user_id = refund_credits.user_id
  FOR UPDATE;

  IF v_current_credits IS NULL THEN
    INSERT INTO public.user_credits (user_id, credits, lifetime_credits)
    VALUES (refund_credits.user_id, refund_credits.amount, 0)
    ON CONFLICT (user_id) DO UPDATE SET
      credits = user_credits.credits + refund_credits.amount;
    v_new_balance := refund_credits.amount;
  ELSE
    v_new_balance := v_current_credits + refund_credits.amount;

    UPDATE public.user_credits uc
    SET credits = v_new_balance,
        updated_at = NOW()
    WHERE uc.user_id = refund_credits.user_id;
  END IF;

  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
  VALUES (refund_credits.user_id, 'refund', refund_credits.amount, v_new_balance, 'Credits refunded');

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RPC: Claim generation refundable credits (atomic)
-- =============================================
CREATE OR REPLACE FUNCTION public.claim_generation_refund_credits(
  p_user_id UUID,
  p_prediction_id TEXT,
  p_status TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_refund_amount INTEGER := 0;
BEGIN
  WITH target AS (
    SELECT g.id, g.credits_used
    FROM public.generations g
    WHERE g.user_id = p_user_id
      AND g.replicate_prediction_id = p_prediction_id
      AND g.credits_used > 0
    FOR UPDATE
  ), updated AS (
    UPDATE public.generations g
    SET
      credits_used = 0,
      status = COALESCE(p_status, g.status),
      updated_at = NOW(),
      completed_at = CASE
        WHEN COALESCE(p_status, g.status) IN ('succeeded', 'failed', 'canceled') THEN COALESCE(g.completed_at, NOW())
        ELSE g.completed_at
      END
    FROM target t
    WHERE g.id = t.id
    RETURNING t.credits_used AS refund_amount
  )
  SELECT COALESCE(SUM(refund_amount), 0) INTO v_refund_amount
  FROM updated;

  RETURN COALESCE(v_refund_amount, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RPC: Cleanup stale generations + auto-refund
-- =============================================
CREATE OR REPLACE FUNCTION public.cleanup_stale_generations(
  p_stale_after_minutes INTEGER DEFAULT 45,
  p_batch_limit INTEGER DEFAULT 100
)
RETURNS TABLE(processed_count INTEGER, refunded_total INTEGER) AS $$
DECLARE
  v_stale_after_minutes INTEGER := GREATEST(COALESCE(p_stale_after_minutes, 45), 5);
  v_batch_limit INTEGER := LEAST(GREATEST(COALESCE(p_batch_limit, 100), 1), 1000);
  v_now TIMESTAMPTZ := NOW();
  v_processed INTEGER := 0;
  v_refunded INTEGER := 0;
  v_claim_amount INTEGER := 0;
  rec RECORD;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  FOR rec IN
    SELECT g.user_id, g.replicate_prediction_id
    FROM public.generations g
    WHERE g.status IN ('starting', 'processing')
      AND g.replicate_prediction_id IS NOT NULL
      AND COALESCE(g.updated_at, g.created_at) < (v_now - make_interval(mins => v_stale_after_minutes))
    ORDER BY COALESCE(g.updated_at, g.created_at) ASC
    LIMIT v_batch_limit
  LOOP
    SELECT public.claim_generation_refund_credits(
      rec.user_id,
      rec.replicate_prediction_id,
      'failed'
    )
    INTO v_claim_amount;

    IF COALESCE(v_claim_amount, 0) > 0 THEN
      PERFORM public.refund_credits(rec.user_id, v_claim_amount);
      v_refunded := v_refunded + v_claim_amount;
    ELSE
      UPDATE public.generations g
      SET
        status = 'failed',
        error_message = COALESCE(g.error_message, 'Generation timed out waiting for provider callback'),
        completed_at = COALESCE(g.completed_at, v_now),
        updated_at = v_now
      WHERE g.user_id = rec.user_id
        AND g.replicate_prediction_id = rec.replicate_prediction_id
        AND g.status IN ('starting', 'processing');
    END IF;

    v_processed := v_processed + 1;
  END LOOP;

  processed_count := v_processed;
  refunded_total := v_refunded;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

REVOKE ALL ON FUNCTION public.increment_usage_stats(UUID, DATE, TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_usage_stats(UUID, DATE, TEXT, INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_usage_stats(UUID, DATE, TEXT, INTEGER, INTEGER) TO service_role;

-- =============================================
-- RPC: Check and increment rate limit (atomic)
-- =============================================
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_action TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, retry_after INTEGER) AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  IF p_identifier IS NULL OR length(trim(p_identifier)) = 0 THEN
    RETURN QUERY SELECT false, 0, GREATEST(p_window_seconds, 1);
    RETURN;
  END IF;

  IF p_action IS NULL OR length(trim(p_action)) = 0 THEN
    RETURN QUERY SELECT false, 0, GREATEST(p_window_seconds, 1);
    RETURN;
  END IF;

  IF p_limit <= 0 THEN
    RETURN QUERY SELECT false, 0, GREATEST(p_window_seconds, 1);
    RETURN;
  END IF;

  IF p_window_seconds <= 0 THEN
    p_window_seconds := 60;
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.edge_rate_limits (identifier, action, window_start, request_count)
  VALUES (p_identifier, p_action, v_window_start, 1)
  ON CONFLICT (identifier, action, window_start)
  DO UPDATE SET
    request_count = edge_rate_limits.request_count + 1,
    updated_at = NOW()
  RETURNING request_count INTO v_count;

  allowed := v_count <= p_limit;
  remaining := GREATEST(p_limit - v_count, 0);
  retry_after := CASE
    WHEN allowed THEN 0
    ELSE p_window_seconds - (extract(epoch FROM now())::INTEGER % p_window_seconds)
  END;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RPC: Cleanup edge rate limit history
-- =============================================
CREATE OR REPLACE FUNCTION public.cleanup_edge_rate_limits(
  p_older_than_hours INTEGER DEFAULT 168,
  p_batch_limit INTEGER DEFAULT 100000
)
RETURNS INTEGER AS $$
DECLARE
  v_older_than_hours INTEGER := GREATEST(COALESCE(p_older_than_hours, 168), 1);
  v_batch_limit INTEGER := LEAST(GREATEST(COALESCE(p_batch_limit, 100000), 1), 1000000);
  v_deleted_count INTEGER := 0;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  WITH doomed AS (
    SELECT id
    FROM public.edge_rate_limits
    WHERE window_start < (NOW() - make_interval(hours => v_older_than_hours))
    ORDER BY window_start ASC
    LIMIT v_batch_limit
  )
  DELETE FROM public.edge_rate_limits erl
  USING doomed
  WHERE erl.id = doomed.id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN COALESCE(v_deleted_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RPC: Admin adjust credits atomically
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
    COALESCE(p_description, 'Ajuste manual de créditos (admin)'),
    'admin_adjust_credits',
    jsonb_build_object('admin_user_id', auth.uid())
  );

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RPC: Admin bulk credit grant (single SQL batch)
-- =============================================
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
      COALESCE(p_description, 'Promoção em massa (admin)'),
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
      'Bônus de créditos',
      format(
        '%s. Foram adicionados %s créditos à sua conta.',
        COALESCE(p_description, format('Promoção em massa (+%s créditos)', p_amount)),
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
    RAISE EXCEPTION 'p_type inválido';
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

-- =============================================
-- RPC: Admin force logout user + revoke sessions
-- =============================================
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
          'name', COALESCE(p.display_name, '—'),
          'email', COALESCE(p.email, '—'),
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

GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.add_credits(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deduct_credits(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_generation_refund_credits(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_stale_generations(INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_edge_rate_limits(INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_credits(UUID, INTEGER) FROM PUBLIC;
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

GRANT EXECUTE ON FUNCTION public.add_credits(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_generation_refund_credits(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_generations(INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_edge_rate_limits(INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_credits(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_adjust_user_credits(UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_grant_bulk_credits(INTEGER, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_send_bulk_notification(TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_force_logout_user(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_generation_analytics(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_stats_summary() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reports_summary() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_guard_password_reset(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;

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

REVOKE ALL ON FUNCTION public.complete_generation(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_generation(UUID, TEXT, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_generation(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- =============================================
-- STORAGE BUCKET (optional)
-- =============================================
-- Run this in Storage settings if needed:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('generations', 'generations', true)
-- ON CONFLICT (id) DO NOTHING;

-- =============================================
-- REALTIME
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND c.relname = 'generations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.generations;
  END IF;

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
END $$;