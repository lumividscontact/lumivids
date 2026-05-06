-- =============================================
-- Generated videos table
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_generated_videos_generation_id ON public.generated_videos(generation_id);