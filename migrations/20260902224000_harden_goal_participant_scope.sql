-- Keep player statistics scoped to confirmed participants.
-- A regular member may record only their own statistics when they are
-- confirmed in the game. Owners/group admins retain management access.
-- This closes a direct-table write path; it does not introduce a new UI rule.

DROP POLICY IF EXISTS goals_insert_self_or_owner_or_group_admin ON public.goals;
CREATE POLICY goals_insert_self_or_owner_or_group_admin ON public.goals FOR INSERT
WITH CHECK (
  (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.game_confirmations c
      WHERE c.game_id = goals.game_id
        AND c.user_id = auth.uid()
    )
    AND NOT public.is_game_completed(game_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.games g
    WHERE g.id = goals.game_id
      AND (
        g.created_by = auth.uid()
        OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id))
      )
      AND (
        NOT public.is_game_completed(g.id)
        OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id))
      )
  )
);

DROP POLICY IF EXISTS goals_update_self_or_owner_or_group_admin ON public.goals;
CREATE POLICY goals_update_self_or_owner_or_group_admin ON public.goals FOR UPDATE
USING (
  (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.game_confirmations c
      WHERE c.game_id = goals.game_id
        AND c.user_id = auth.uid()
    )
    AND NOT public.is_game_completed(game_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.games g
    WHERE g.id = goals.game_id
      AND (
        g.created_by = auth.uid()
        OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id))
      )
      AND (
        NOT public.is_game_completed(g.id)
        OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id))
      )
  )
)
WITH CHECK (
  (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.game_confirmations c
      WHERE c.game_id = goals.game_id
        AND c.user_id = auth.uid()
    )
    AND NOT public.is_game_completed(game_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.games g
    WHERE g.id = goals.game_id
      AND (
        g.created_by = auth.uid()
        OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id))
      )
      AND (
        NOT public.is_game_completed(g.id)
        OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id))
      )
  )
);
