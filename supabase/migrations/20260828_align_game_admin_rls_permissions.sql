-- Align RLS with the existing game-management UI: group admins are
-- authorized to manage teams, goals/results and payment status for games
-- belonging to their group. Owners retain the same permissions.

DROP POLICY IF EXISTS "teams_delete_owner_only" ON public.game_teams;
DROP POLICY IF EXISTS "teams_insert_owner_only" ON public.game_teams;
DROP POLICY IF EXISTS "teams_update_owner_only" ON public.game_teams;

CREATE POLICY "teams_delete_owner_or_group_admin"
ON public.game_teams FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = game_teams.game_id
      AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
  )
);

CREATE POLICY "teams_insert_owner_or_group_admin"
ON public.game_teams FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = game_teams.game_id
      AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
  )
);

CREATE POLICY "teams_update_owner_or_group_admin"
ON public.game_teams FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = game_teams.game_id
      AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = game_teams.game_id
      AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
  )
);

DROP POLICY IF EXISTS "goals_delete_owner_only" ON public.goals;
DROP POLICY IF EXISTS "goals_insert_owner_only" ON public.goals;
DROP POLICY IF EXISTS "goals_update_owner_only" ON public.goals;

CREATE POLICY "goals_delete_owner_or_group_admin"
ON public.goals FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = goals.game_id
      AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
  )
);

CREATE POLICY "goals_insert_owner_or_group_admin"
ON public.goals FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = goals.game_id
      AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
  )
);

CREATE POLICY "goals_update_owner_or_group_admin"
ON public.goals FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = goals.game_id
      AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = goals.game_id
      AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
  )
);

DROP POLICY IF EXISTS "payments_insert_self_or_owner" ON public.payments;
DROP POLICY IF EXISTS "payments_update_self_or_owner" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_self_or_owner" ON public.payments;

CREATE POLICY "payments_insert_self_or_owner_or_group_admin"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = payments.game_id
      AND (g.created_by = auth.uid() OR g.pix_owner_id = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
  )
);

CREATE POLICY "payments_update_self_or_owner_or_group_admin"
ON public.payments FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = payments.game_id
      AND (g.created_by = auth.uid() OR g.pix_owner_id = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
  )
)
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = payments.game_id
      AND (g.created_by = auth.uid() OR g.pix_owner_id = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
  )
);

CREATE POLICY "payments_delete_self_or_owner_or_group_admin"
ON public.payments FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = payments.game_id
      AND (g.created_by = auth.uid() OR g.pix_owner_id = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
  )
);
