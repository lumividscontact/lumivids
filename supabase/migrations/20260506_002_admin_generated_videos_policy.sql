-- Allow admins to read all generated_videos rows.
-- Required for admin generations view that joins generations -> generated_videos.

DROP POLICY IF EXISTS "Admins can view all generated videos" ON public.generated_videos;

CREATE POLICY "Admins can view all generated videos"
  ON public.generated_videos FOR SELECT
  USING (public.is_admin());
