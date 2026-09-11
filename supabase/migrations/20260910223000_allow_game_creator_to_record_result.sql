-- The game creator is allowed to record the final score.
-- Group administrators retain their existing update authority.
drop policy if exists games_update_owner_or_group_admin on public.games;

create policy games_update_owner_or_group_admin
on public.games
for update
to authenticated
using (
  (created_by = auth.uid())
  or (group_id is not null and is_group_admin(group_id))
)
with check (
  (
    created_by = auth.uid()
    and (
      (score_a is null and score_b is null)
      or (
        score_a is not null
        and score_b is not null
        and score_a >= 0
        and score_b >= 0
      )
    )
  )
  or (group_id is not null and is_group_admin(group_id))
);
