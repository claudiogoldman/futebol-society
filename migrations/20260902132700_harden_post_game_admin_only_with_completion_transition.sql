-- After a game is completed (both scores recorded), only group admins/owners
-- may change structural game data. The creator may still record the final scores.

CREATE OR REPLACE FUNCTION public.is_game_completed(p_game_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.games
    WHERE id = p_game_id
      AND score_a IS NOT NULL
      AND score_b IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_game_completed(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_game_completed(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_game_completed(uuid) TO authenticated;

DROP POLICY IF EXISTS games_update_owner_or_group_admin ON public.games;
CREATE POLICY games_update_owner_or_group_admin ON public.games FOR UPDATE
USING (created_by = auth.uid() OR (group_id IS NOT NULL AND public.is_group_admin(group_id)))
WITH CHECK (
  (created_by = auth.uid() OR (group_id IS NOT NULL AND public.is_group_admin(group_id)))
  AND (score_a IS NULL OR score_b IS NULL OR (group_id IS NOT NULL AND public.is_group_admin(group_id)))
);

DROP POLICY IF EXISTS games_delete_owner_or_group_admin ON public.games;
CREATE POLICY games_delete_owner_or_group_admin ON public.games FOR DELETE
USING (
  (created_by = auth.uid() OR (group_id IS NOT NULL AND public.is_group_admin(group_id)))
  AND (NOT public.is_game_completed(id) OR (group_id IS NOT NULL AND public.is_group_admin(group_id)))
);

DROP POLICY IF EXISTS game_confirmations_insert_self_or_group_admin ON public.game_confirmations;
CREATE POLICY game_confirmations_insert_self_or_group_admin ON public.game_confirmations FOR INSERT
WITH CHECK (
  (auth.uid() = user_id AND is_game_member(game_id) AND NOT public.is_game_completed(game_id))
  OR EXISTS (
    SELECT 1 FROM public.games g WHERE g.id = game_confirmations.game_id
      AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
  )
);

DROP POLICY IF EXISTS game_confirmations_delete_self_or_group_admin ON public.game_confirmations;
CREATE POLICY game_confirmations_delete_self_or_group_admin ON public.game_confirmations FOR DELETE
USING (
  (auth.uid() = user_id AND NOT public.is_game_completed(game_id))
  OR EXISTS (
    SELECT 1 FROM public.games g WHERE g.id = game_confirmations.game_id
      AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
  )
);

DROP POLICY IF EXISTS teams_insert_owner_or_group_admin ON public.game_teams;
CREATE POLICY teams_insert_owner_or_group_admin ON public.game_teams FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.games g WHERE g.id = game_teams.game_id
    AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
    AND (NOT public.is_game_completed(g.id) OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
));

DROP POLICY IF EXISTS teams_update_owner_or_group_admin ON public.game_teams;
CREATE POLICY teams_update_owner_or_group_admin ON public.game_teams FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.games g WHERE g.id = game_teams.game_id
    AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
    AND (NOT public.is_game_completed(g.id) OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.games g WHERE g.id = game_teams.game_id
    AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
    AND (NOT public.is_game_completed(g.id) OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
));

DROP POLICY IF EXISTS teams_delete_owner_or_group_admin ON public.game_teams;
CREATE POLICY teams_delete_owner_or_group_admin ON public.game_teams FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.games g WHERE g.id = game_teams.game_id
    AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
    AND (NOT public.is_game_completed(g.id) OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
));

DROP POLICY IF EXISTS game_guests_insert_group_admin ON public.game_guests;
CREATE POLICY game_guests_insert_group_admin ON public.game_guests FOR INSERT
WITH CHECK (created_by = auth.uid() AND EXISTS (
  SELECT 1 FROM public.games g WHERE g.id = game_guests.game_id
    AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
    AND (NOT public.is_game_completed(g.id) OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
));

DROP POLICY IF EXISTS game_guests_update_group_admin ON public.game_guests;
CREATE POLICY game_guests_update_group_admin ON public.game_guests FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.games g WHERE g.id = game_guests.game_id
    AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
    AND (NOT public.is_game_completed(g.id) OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.games g WHERE g.id = game_guests.game_id
    AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
    AND (NOT public.is_game_completed(g.id) OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
));

DROP POLICY IF EXISTS game_guests_delete_group_admin ON public.game_guests;
CREATE POLICY game_guests_delete_group_admin ON public.game_guests FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.games g WHERE g.id = game_guests.game_id
    AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
    AND (NOT public.is_game_completed(g.id) OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
));

DROP POLICY IF EXISTS goals_insert_self_or_owner_or_group_admin ON public.goals;
CREATE POLICY goals_insert_self_or_owner_or_group_admin ON public.goals FOR INSERT
WITH CHECK (
  (auth.uid() = user_id AND is_game_member(game_id) AND NOT public.is_game_completed(game_id))
  OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = goals.game_id
    AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id))))
);

DROP POLICY IF EXISTS goals_update_self_or_owner_or_group_admin ON public.goals;
CREATE POLICY goals_update_self_or_owner_or_group_admin ON public.goals FOR UPDATE
USING (
  (auth.uid() = user_id AND is_game_member(game_id) AND NOT public.is_game_completed(game_id))
  OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = goals.game_id
    AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id))))
)
WITH CHECK (
  (auth.uid() = user_id AND is_game_member(game_id) AND NOT public.is_game_completed(game_id))
  OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = goals.game_id
    AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id))))
);

DROP POLICY IF EXISTS goals_delete_owner_or_group_admin ON public.goals;
CREATE POLICY goals_delete_owner_or_group_admin ON public.goals FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.games g WHERE g.id = goals.game_id
    AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
    AND (NOT public.is_game_completed(g.id) OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
));

DROP POLICY IF EXISTS payments_insert_self_or_owner_or_group_admin ON public.payments;
CREATE POLICY payments_insert_self_or_owner_or_group_admin ON public.payments FOR INSERT
WITH CHECK (
  (auth.uid() = user_id AND NOT public.is_game_completed(game_id))
  OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = payments.game_id
    AND (g.created_by = auth.uid() OR g.pix_owner_id = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id))))
);

DROP POLICY IF EXISTS payments_update_self_or_owner_or_group_admin ON public.payments;
CREATE POLICY payments_update_self_or_owner_or_group_admin ON public.payments FOR UPDATE
USING (
  (auth.uid() = user_id AND NOT public.is_game_completed(game_id))
  OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = payments.game_id
    AND (g.created_by = auth.uid() OR g.pix_owner_id = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id))))
)
WITH CHECK (
  (auth.uid() = user_id AND NOT public.is_game_completed(game_id))
  OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = payments.game_id
    AND (g.created_by = auth.uid() OR g.pix_owner_id = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id))))
);

DROP POLICY IF EXISTS payments_delete_self_or_owner_or_group_admin ON public.payments;
CREATE POLICY payments_delete_self_or_owner_or_group_admin ON public.payments FOR DELETE
USING (
  (auth.uid() = user_id AND NOT public.is_game_completed(game_id))
  OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = payments.game_id
    AND (g.created_by = auth.uid() OR g.pix_owner_id = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id))))
);
