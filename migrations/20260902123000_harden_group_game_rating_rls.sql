-- Harden authorization for group membership, games, ratings and guest updates.
-- Owners are implicitly admins through is_group_admin(); admins may assign admin/member roles.

DROP POLICY IF EXISTS group_members_insert_self_or_admin ON public.group_members;
CREATE POLICY group_members_insert_self_or_admin
ON public.group_members
FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = user_id AND role = 'member')
  OR is_group_admin(group_id)
);

DROP POLICY IF EXISTS group_members_update_role_owner ON public.group_members;
CREATE POLICY group_members_update_role_owner
ON public.group_members
FOR UPDATE TO authenticated
USING (is_group_admin(group_id))
WITH CHECK (is_group_admin(group_id));

DROP POLICY IF EXISTS games_insert_auth ON public.games;
CREATE POLICY games_insert_auth
ON public.games
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (group_id IS NULL OR is_group_member(group_id))
);

DROP POLICY IF EXISTS ratings_update_own ON public.ratings;
CREATE POLICY ratings_update_own
ON public.ratings
FOR UPDATE TO authenticated
USING (auth.uid() = rater_id)
WITH CHECK (auth.uid() = rater_id);

DROP POLICY IF EXISTS game_guests_update_group_admin ON public.game_guests;
CREATE POLICY game_guests_update_group_admin
ON public.game_guests
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.games g
    WHERE g.id = game_guests.game_id
      AND (
        (g.group_id IS NOT NULL AND is_group_admin(g.group_id))
        OR g.created_by = auth.uid()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.games g
    WHERE g.id = game_guests.game_id
      AND (
        (g.group_id IS NOT NULL AND is_group_admin(g.group_id))
        OR g.created_by = auth.uid()
      )
  )
);