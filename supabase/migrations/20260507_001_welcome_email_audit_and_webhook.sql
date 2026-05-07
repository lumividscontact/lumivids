-- Welcome email observability fields for Resend automations/webhooks.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_email_event_name TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_email_event_id TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_email_provider_email_id TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_email_last_status TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_email_last_error TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_email_last_webhook_at TIMESTAMPTZ;