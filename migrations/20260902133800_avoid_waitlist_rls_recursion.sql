-- Avoid recursive RLS evaluation between games and game_waitlist.
CREATE OR REPLACE FUNCTION public.is_game_waitlisted(p_game_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.game_waitlist
    WHERE game_id = p_game_id AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_game_waitlisted(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_game_waitlisted(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_game_waitlisted(uuid) TO authenticated;

DROP POLICY IF EXISTS games_select_member ON public.games;
CREATE POLICY games_select_member ON public.games FOR SELECT
USING (is_game_member(id) OR created_by = auth.uid() OR public.is_game_waitlisted(id));
