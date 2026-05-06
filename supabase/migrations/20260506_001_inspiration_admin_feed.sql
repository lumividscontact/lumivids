-- Expose inspiration feed from the admin account for public gallery consumption.
CREATE OR REPLACE FUNCTION public.get_inspiration_admin_feed()
RETURNS TABLE (
  id UUID,
  type TEXT,
  prompt TEXT,
  output_url TEXT,
  thumbnail_url TEXT,
  model_name TEXT,
  settings JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id,
    g.type,
    g.prompt,
    COALESCE(
      CASE
        WHEN gv.video_url IS NOT NULL
          AND gv.video_url <> ''
          AND gv.video_url NOT LIKE '%replicate.delivery%'
          AND gv.video_url NOT LIKE '%replicate.com%'
        THEN gv.video_url
      END,
      CASE
        WHEN g.output_url IS NOT NULL
          AND g.output_url <> ''
          AND g.output_url NOT LIKE '%replicate.delivery%'
          AND g.output_url NOT LIKE '%replicate.com%'
        THEN g.output_url
      END,
      gv.video_url,
      g.output_url
    ) AS output_url,
    COALESCE(
      CASE
        WHEN gv.thumbnail_url IS NOT NULL
          AND gv.thumbnail_url <> ''
          AND gv.thumbnail_url NOT LIKE '%replicate.delivery%'
          AND gv.thumbnail_url NOT LIKE '%replicate.com%'
        THEN gv.thumbnail_url
      END,
      CASE
        WHEN g.thumbnail_url IS NOT NULL
          AND g.thumbnail_url <> ''
          AND g.thumbnail_url NOT LIKE '%replicate.delivery%'
          AND g.thumbnail_url NOT LIKE '%replicate.com%'
        THEN g.thumbnail_url
      END,
      CASE
        WHEN gv.video_url IS NOT NULL
          AND gv.video_url <> ''
          AND gv.video_url NOT LIKE '%replicate.delivery%'
          AND gv.video_url NOT LIKE '%replicate.com%'
        THEN gv.video_url
      END,
      CASE
        WHEN g.output_url IS NOT NULL
          AND g.output_url <> ''
          AND g.output_url NOT LIKE '%replicate.delivery%'
          AND g.output_url NOT LIKE '%replicate.com%'
        THEN g.output_url
      END,
      gv.thumbnail_url,
      g.thumbnail_url,
      gv.video_url,
      g.output_url
    ) AS thumbnail_url,
    g.model_name,
    g.settings,
    g.created_at
  FROM public.generations g
  LEFT JOIN public.generated_videos gv ON gv.generation_id = g.id
  WHERE g.status = 'succeeded'
    AND g.hidden_at IS NULL
    AND g.user_id IN (
      SELECT p.user_id
      FROM public.profiles p
      WHERE lower(p.email) = lower('dev@lumivids.com')
    )
  ORDER BY g.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_inspiration_admin_feed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_inspiration_admin_feed() TO anon;
GRANT EXECUTE ON FUNCTION public.get_inspiration_admin_feed() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_inspiration_admin_feed() TO service_role;
