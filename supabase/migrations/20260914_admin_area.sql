-- Global administration: all destructive operations are restricted to profiles.is_admin.

create or replace function public.get_admin_groups()
returns table (
  id uuid,
  name text,
  created_at timestamptz,
  created_by uuid,
  created_by_name text,
  member_count bigint,
  game_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_global_admin() then
    raise exception 'ADMIN_ONLY';
  end if;

  return query
  select
    g.id,
    g.name,
    g.created_at,
    g.created_by,
    p.name as created_by_name,
    (select count(*) from public.group_members gm where gm.group_id = g.id) as member_count,
    (select count(*) from public.games ga where ga.group_id = g.id) as game_count
  from public.groups g
  left join public.profiles p on p.id = g.created_by
  order by g.created_at desc, lower(g.name);
end;
$$;

grant execute on function public.get_admin_groups() to authenticated;

create or replace function public.admin_delete_group(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  if not public.is_global_admin() then
    raise exception 'ADMIN_ONLY';
  end if;

  select g.id into v_group_id
  from public.groups g
  where g.id = p_group_id;

  if v_group_id is null then
    raise exception 'GROUP_NOT_FOUND';
  end if;

  -- games.group_id is NO ACTION, so remove games first; all game-owned
  -- records use CASCADE from games and are removed atomically with them.
  delete from public.games where group_id = p_group_id;
  delete from public.groups where id = p_group_id;

  return p_group_id;
end;
$$;

grant execute on function public.admin_delete_group(uuid) to authenticated;

create or replace function public.admin_delete_user(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_is_admin boolean;
  v_owned_groups bigint;
begin
  if not public.is_global_admin() then
    raise exception 'ADMIN_ONLY';
  end if;

  if p_user_id is null then
    raise exception 'USER_NOT_FOUND';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'CANNOT_DELETE_SELF';
  end if;

  select p.id, coalesce(p.is_admin, false)
    into v_user_id, v_is_admin
  from public.profiles p
  where p.id = p_user_id;

  if v_user_id is null then
    raise exception 'USER_NOT_FOUND';
  end if;

  if v_is_admin then
    raise exception 'CANNOT_DELETE_ADMIN';
  end if;

  select count(*) into v_owned_groups
  from public.groups g
  where g.created_by = p_user_id;

  if v_owned_groups > 0 then
    raise exception 'USER_OWNS_GROUPS';
  end if;

  -- Preserve historical games/groups owned by other users while removing the
  -- account. These columns are nullable in the current schema.
  update public.games
     set created_by = case when created_by = p_user_id then null else created_by end,
         organizer_id = case when organizer_id = p_user_id then null else organizer_id end,
         pix_owner_id = case when pix_owner_id = p_user_id then null else pix_owner_id end
   where created_by = p_user_id
      or organizer_id = p_user_id
      or pix_owner_id = p_user_id;

  update public.groups
     set default_organizer_id = case when default_organizer_id = p_user_id then null else default_organizer_id end,
         default_pix_owner_id = case when default_pix_owner_id = p_user_id then null else default_pix_owner_id end
   where default_organizer_id = p_user_id
      or default_pix_owner_id = p_user_id;

  update public.group_locations
     set created_by = null
   where created_by = p_user_id;

  -- Profile-owned records with CASCADE FKs are removed with the profile.
  delete from public.profiles where id = p_user_id;

  -- auth.users is intentionally removed last so the login is invalidated too.
  delete from auth.users where id = p_user_id;

  return p_user_id;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;
