-- Players may confirm themselves in a game they belong to, and group admins
-- may add only users who are members of that game's group.
-- Guest creation remains handled by the dedicated SECURITY DEFINER guest RPC.

DROP POLICY IF EXISTS "game_confirmations_insert_self_or_group_admin" ON public.game_confirmations;
CREATE POLICY "game_confirmations_insert_self_or_group_admin"
ON public.game_confirmations
FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = user_id AND is_game_member(game_id))
  OR EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = game_confirmations.game_id
      AND g.group_id IS NOT NULL
      AND is_group_admin(g.group_id)
      AND EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = g.group_id
          AND gm.user_id = game_confirmations.user_id
      )
  )
);

-- A player can submit/correct only their own goals/assists. The game owner
-- and group admins retain correction rights.
DROP POLICY IF EXISTS "goals_insert_owner_or_group_admin" ON public.goals;
CREATE POLICY "goals_insert_self_or_owner_or_group_admin"
ON public.goals
FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = user_id AND is_game_member(game_id))
  OR EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = goals.game_id
      AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND is_group_admin(g.group_id)))
  )
);

DROP POLICY IF EXISTS "goals_update_owner_or_group_admin" ON public.goals;
CREATE POLICY "goals_update_self_or_owner_or_group_admin"
ON public.goals
FOR UPDATE TO authenticated
USING (
  (auth.uid() = user_id AND is_game_member(game_id))
  OR EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = goals.game_id
      AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND is_group_admin(g.group_id)))
  )
)
WITH CHECK (
  (auth.uid() = user_id AND is_game_member(game_id))
  OR EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = goals.game_id
      AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND is_group_admin(g.group_id)))
  )
);
