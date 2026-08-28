-- Group roles approved on 2026-08-28.
-- Owner remains groups.created_by. Additional administrators are stored in group_members.role.

alter table public.group_members add column if not exists role text not null default 'member' check (role in ('admin','member'));

create or replace function public.is_group_owner(p_group_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.groups g where g.id = p_group_id and g.created_by = auth.uid());
$$;

create or replace function public.is_group_admin(p_group_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_group_owner(p_group_id) or exists (
    select 1 from public.group_members gm where gm.group_id = p_group_id and gm.user_id = auth.uid() and gm.role = 'admin'
  );
$$;

drop policy if exists groups_update_owner on public.groups;
create policy groups_update_admin on public.groups for update to authenticated using (public.is_group_admin(id)) with check (public.is_group_admin(id));

drop policy if exists group_members_insert_self on public.group_members;
create policy group_members_insert_self_or_admin on public.group_members for insert to authenticated with check (auth.uid() = user_id or public.is_group_admin(group_id));

drop policy if exists group_members_delete_self_or_owner on public.group_members;
create policy group_members_delete_self_or_admin on public.group_members for delete to authenticated using (auth.uid() = user_id or public.is_group_admin(group_id));

create policy group_members_update_role_owner on public.group_members for update to authenticated using (public.is_group_owner(group_id)) with check (public.is_group_owner(group_id));

drop policy if exists games_update_owner_only on public.games;
create policy games_update_owner_or_group_admin on public.games for update to authenticated using (auth.uid() = created_by or (group_id is not null and public.is_group_admin(group_id))) with check (auth.uid() = created_by or (group_id is not null and public.is_group_admin(group_id)));

drop policy if exists games_delete_owner_only on public.games;
create policy games_delete_owner_or_group_admin on public.games for delete to authenticated using (auth.uid() = created_by or (group_id is not null and public.is_group_admin(group_id)));
