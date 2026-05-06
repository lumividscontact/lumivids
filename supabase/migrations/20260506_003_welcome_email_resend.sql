-- Track welcome email delivery and mark new users for initial send.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_email_pending BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email, welcome_email_pending)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    true
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
