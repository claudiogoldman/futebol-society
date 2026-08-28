-- Security and performance hardening identified by Supabase advisors.
-- Keep SECURITY DEFINER helpers callable only internally; RPC entry points
-- remain available only to authenticated users where the frontend requires them.

revoke execute on function public.is_game_member(uuid) from public, anon, authenticated;
revoke execute on function public.is_group_admin(uuid) from public, anon, authenticated;
revoke execute on function public.is_group_member(uuid) from public, anon, authenticated;
revoke execute on function public.is_group_owner(uuid) from public, anon, authenticated;
revoke execute on function public.apply_group_defaults_to_game() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.add_game_guest(uuid,text,text,text) from public, anon;
grant execute on function public.add_game_guest(uuid,text,text,text) to authenticated;
revoke execute on function public.join_game_by_token(uuid) from public, anon;
grant execute on function public.join_game_by_token(uuid) to authenticated;
revoke execute on function public.join_group_by_token(uuid) from public, anon;
grant execute on function public.join_group_by_token(uuid) to authenticated;

create index if not exists idx_game_confirmations_user_id on public.game_confirmations(user_id);
create index if not exists idx_game_guests_created_by on public.game_guests(created_by);
create index if not exists idx_game_teams_user_id on public.game_teams(user_id);
create index if not exists idx_games_created_by on public.games(created_by);
create index if not exists idx_games_group_id on public.games(group_id);
create index if not exists idx_games_pix_owner_id on public.games(pix_owner_id);
create index if not exists idx_goals_user_id on public.goals(user_id);
create index if not exists idx_group_members_user_id on public.group_members(user_id);
create index if not exists idx_groups_created_by on public.groups(created_by);
create index if not exists idx_groups_default_pix_owner_id on public.groups(default_pix_owner_id);
create index if not exists idx_payments_user_id on public.payments(user_id);
create index if not exists idx_ratings_rated_id on public.ratings(rated_id);
create index if not exists idx_ratings_rater_id on public.ratings(rater_id);

-- game_confirmations: consolidate overlapping INSERT/DELETE policies.
drop policy if exists confirmations_delete_own on public.game_confirmations;
drop policy if exists confirmations_insert_own on public.game_confirmations;
drop policy if exists game_confirmations_delete_self_or_group_admin on public.game_confirmations;
drop policy if exists game_confirmations_insert_self_or_group_admin on public.game_confirmations;
create policy game_confirmations_delete_self_or_group_admin on public.game_confirmations
for delete to authenticated using (
  ((select auth.uid()) = user_id)
  or exists (select 1 from public.games g where g.id = game_confirmations.game_id and g.group_id is not null and public.is_group_admin(g.group_id))
);
create policy game_confirmations_insert_self_or_group_admin on public.game_confirmations
for insert to authenticated with check (
  ((select auth.uid()) = user_id)
  or exists (select 1 from public.games g where g.id = game_confirmations.game_id and g.group_id is not null and public.is_group_admin(g.group_id))
);

-- game_teams: explicit write policies prevent the ALL policy from also granting SELECT.
drop policy if exists teams_select_member on public.game_teams;
drop policy if exists teams_write_owner_only on public.game_teams;
create policy teams_select_member on public.game_teams
for select to authenticated using (public.is_game_member(game_id));
create policy teams_insert_owner_only on public.game_teams
for insert to authenticated with check (exists (select 1 from public.games g where g.id = game_teams.game_id and g.created_by = (select auth.uid())));
create policy teams_update_owner_only on public.game_teams
for update to authenticated using (exists (select 1 from public.games g where g.id = game_teams.game_id and g.created_by = (select auth.uid())))
with check (exists (select 1 from public.games g where g.id = game_teams.game_id and g.created_by = (select auth.uid())));
create policy teams_delete_owner_only on public.game_teams
for delete to authenticated using (exists (select 1 from public.games g where g.id = game_teams.game_id and g.created_by = (select auth.uid())));

-- goals: same SELECT/write separation.
drop policy if exists goals_select_member on public.goals;
drop policy if exists goals_write_owner_only on public.goals;
create policy goals_select_member on public.goals
for select to authenticated using (public.is_game_member(game_id));
create policy goals_insert_owner_only on public.goals
for insert to authenticated with check (exists (select 1 from public.games g where g.id = goals.game_id and g.created_by = (select auth.uid())));
create policy goals_update_owner_only on public.goals
for update to authenticated using (exists (select 1 from public.games g where g.id = goals.game_id and g.created_by = (select auth.uid())))
with check (exists (select 1 from public.games g where g.id = goals.game_id and g.created_by = (select auth.uid())));
create policy goals_delete_owner_only on public.goals
for delete to authenticated using (exists (select 1 from public.games g where g.id = goals.game_id and g.created_by = (select auth.uid())));

-- payments: same SELECT/write separation.
drop policy if exists payments_select_member on public.payments;
drop policy if exists payments_write_self_or_owner on public.payments;
create policy payments_select_member on public.payments
for select to authenticated using (public.is_game_member(game_id));
create policy payments_insert_self_or_owner on public.payments
for insert to authenticated with check (
  ((select auth.uid()) = user_id)
  or exists (select 1 from public.games g where g.id = payments.game_id and (g.created_by = (select auth.uid()) or g.pix_owner_id = (select auth.uid())))
);
create policy payments_update_self_or_owner on public.payments
for update to authenticated using (
  ((select auth.uid()) = user_id)
  or exists (select 1 from public.games g where g.id = payments.game_id and (g.created_by = (select auth.uid()) or g.pix_owner_id = (select auth.uid())))
) with check (
  ((select auth.uid()) = user_id)
  or exists (select 1 from public.games g where g.id = payments.game_id and (g.created_by = (select auth.uid()) or g.pix_owner_id = (select auth.uid())))
);
create policy payments_delete_self_or_owner on public.payments
for delete to authenticated using (
  ((select auth.uid()) = user_id)
  or exists (select 1 from public.games g where g.id = payments.game_id and (g.created_by = (select auth.uid()) or g.pix_owner_id = (select auth.uid())))
);

-- profiles: merge the two UPDATE policies into one.
drop policy if exists profiles_update_by_admin on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own_or_admin on public.profiles
for update to authenticated
using (
  (select auth.uid()) = id
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin)
)
with check (
  (select auth.uid()) = id
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin)
);

-- Remaining policies flagged for auth.uid() per-row evaluation.
drop policy if exists games_delete_owner_or_group_admin on public.games;
create policy games_delete_owner_or_group_admin on public.games
for delete to authenticated using (((select auth.uid()) = created_by) or ((group_id is not null) and public.is_group_admin(group_id)));

drop policy if exists games_select_member on public.games;
create policy games_select_member on public.games
for select to authenticated using (public.is_game_member(id) or ((select auth.uid()) = created_by));

drop policy if exists games_update_owner_or_group_admin on public.games;
create policy games_update_owner_or_group_admin on public.games
for update to authenticated using (((select auth.uid()) = created_by) or ((group_id is not null) and public.is_group_admin(group_id)))
with check (((select auth.uid()) = created_by) or ((group_id is not null) and public.is_group_admin(group_id)));

drop policy if exists group_members_delete_self_or_admin on public.group_members;
create policy group_members_delete_self_or_admin on public.group_members
for delete to authenticated using (((select auth.uid()) = user_id) or public.is_group_admin(group_id));

drop policy if exists group_members_insert_self_or_admin on public.group_members;
create policy group_members_insert_self_or_admin on public.group_members
for insert to authenticated with check (((select auth.uid()) = user_id) or public.is_group_admin(group_id));

drop policy if exists groups_delete_owner on public.groups;
create policy groups_delete_owner on public.groups
for delete to authenticated using ((select auth.uid()) = created_by);

drop policy if exists groups_insert_auth on public.groups;
create policy groups_insert_auth on public.groups
for insert to authenticated with check ((select auth.uid()) = created_by);

drop policy if exists groups_select_member on public.groups;
create policy groups_select_member on public.groups
for select to authenticated using (public.is_group_member(id) or ((select auth.uid()) = created_by));

drop policy if exists game_guests_insert_group_admin on public.game_guests;
create policy game_guests_insert_group_admin on public.game_guests
for insert to authenticated with check (
  created_by = (select auth.uid()) and exists (
    select 1 from public.games g where g.id = game_guests.game_id
      and (((g.group_id is not null) and public.is_group_admin(g.group_id)) or g.created_by = (select auth.uid()))
  )
);

drop policy if exists game_guests_delete_group_admin on public.game_guests;
create policy game_guests_delete_group_admin on public.game_guests
for delete to authenticated using (exists (
  select 1 from public.games g where g.id = game_guests.game_id
    and (((g.group_id is not null) and public.is_group_admin(g.group_id)) or g.created_by = (select auth.uid()))
));

drop policy if exists ratings_insert_own on public.ratings;
create policy ratings_insert_own on public.ratings
for insert to authenticated with check ((select auth.uid()) = rater_id);

drop policy if exists ratings_update_own on public.ratings;
create policy ratings_update_own on public.ratings
for update to authenticated using ((select auth.uid()) = rater_id);
