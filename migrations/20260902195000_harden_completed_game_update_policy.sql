-- Keep completed games structurally locked for non-admin creators.
-- A game is completed when both score_a and score_b are present.
-- Before completion, the creator may maintain the game.
-- After completion, only a group admin may update it.

drop policy if exists games_update_owner_or_group_admin on public.games;

create policy games_update_owner_or_group_admin
on public.games
for update
to public
using (
  (created_by = auth.uid())
  or (group_id is not null and is_group_admin(group_id))
)
with check (
  (
    (group_id is not null and is_group_admin(group_id))
    or (
      created_by = auth.uid()
      and score_a is null
      and score_b is null
    )
  )
);
