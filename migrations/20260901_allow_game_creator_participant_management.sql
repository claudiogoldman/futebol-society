-- Allow the game creator to add/remove members of the game's group.
-- The target user must still belong to the game's group.
DROP POLICY IF EXISTS game_confirmations_insert_self_or_group_admin ON public.game_confirmations;
CREATE POLICY game_confirmations_insert_self_or_group_admin
ON public.game_confirmations
FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = user_id AND is_game_member(game_id))
  OR EXISTS (
    SELECT 1
    FROM public.games g
    WHERE g.id = game_confirmations.game_id
      AND g.group_id IS NOT NULL
      AND (is_group_admin(g.group_id) OR g.created_by = auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.group_members gm
        WHERE gm.group_id = g.group_id
          AND gm.user_id = game_confirmations.user_id
      )
  )
);

DROP POLICY IF EXISTS game_confirmations_delete_self_or_group_admin ON public.game_confirmations;
CREATE POLICY game_confirmations_delete_self_or_group_admin
ON public.game_confirmations
FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.games g
    WHERE g.id = game_confirmations.game_id
      AND g.group_id IS NOT NULL
      AND (is_group_admin(g.group_id) OR g.created_by = auth.uid())
  )
);