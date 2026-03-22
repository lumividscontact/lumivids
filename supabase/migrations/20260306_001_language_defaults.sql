-- Align language defaults with the frontend locale detection rules.
-- Safe to run multiple times.

ALTER TABLE public.profiles
  ALTER COLUMN language SET DEFAULT 'en';

UPDATE public.profiles
SET language = 'en'
WHERE language IS NULL
   OR language NOT IN ('pt', 'en', 'es');
