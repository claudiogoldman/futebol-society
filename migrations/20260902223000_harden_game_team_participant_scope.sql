-- Keep direct game_teams writes consistent with set_game_teams():
-- every player assigned to a team must be confirmed in that game.
-- This is an integrity/security hardening only; it does not change who may
-- manage teams (organizer/group admins before closure, group admins after closure).

DROP POLICY IF EXISTS teams_insert_owner_or_group_admin ON public.game_teams;
CREATE POLICY teams_insert_owner_or_group_admin ON public.game_teams FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.games g
    WHERE g.id = game_teams.game_id
      AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
      AND (NOT public.is_game_completed(g.id) OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
  )
  AND EXISTS (
    SELECT 1
    FROM public.game_confirmations c
    WHERE c.game_id = game_teams.game_id
      AND c.user_id = game_teams.user_id
  )
);

DROP POLICY IF EXISTS teams_update_owner_or_group_admin ON public.game_teams;
CREATE POLICY teams_update_owner_or_group_admin ON public.game_teams FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.games g
    WHERE g.id = game_teams.game_id
      AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
      AND (NOT public.is_game_completed(g.id) OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.games g
    WHERE g.id = game_teams.game_id
      AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
      AND (NOT public.is_game_completed(g.id) OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
  )
  AND EXISTS (
    SELECT 1
    FROM public.game_confirmations c
    WHERE c.game_id = game_teams.game_id
      AND c.user_id = game_teams.user_id
  )
);
