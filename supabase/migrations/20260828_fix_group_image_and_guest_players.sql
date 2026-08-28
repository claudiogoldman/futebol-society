-- Safe group-image authorization: storage paths must begin with the group UUID.
drop policy if exists "group_images_insert_admin" on storage.objects;
drop policy if exists "group_images_update_admin" on storage.objects;
drop policy if exists "group_images_delete_admin" on storage.objects;

create policy "group_images_insert_admin" on storage.objects
for insert to authenticated
with check (bucket_id = 'group-images' and exists (
  select 1 from public.groups g
  where split_part(name, '/', 1) = g.id::text
    and (g.created_by = auth.uid() or exists (
      select 1 from public.group_members gm
      where gm.group_id = g.id and gm.user_id = auth.uid() and gm.role = 'admin'
    ))
));

create policy "group_images_update_admin" on storage.objects
for update to authenticated
using (bucket_id = 'group-images' and exists (
  select 1 from public.groups g
  where split_part(name, '/', 1) = g.id::text
    and (g.created_by = auth.uid() or exists (
      select 1 from public.group_members gm
      where gm.group_id = g.id and gm.user_id = auth.uid() and gm.role = 'admin'
    ))
))
with check (bucket_id = 'group-images' and exists (
  select 1 from public.groups g
  where split_part(name, '/', 1) = g.id::text
    and (g.created_by = auth.uid() or exists (
      select 1 from public.group_members gm
      where gm.group_id = g.id and gm.user_id = auth.uid() and gm.role = 'admin'
    ))
));

create policy "group_images_delete_admin" on storage.objects
for delete to authenticated
using (bucket_id = 'group-images' and exists (
  select 1 from public.groups g
  where split_part(name, '/', 1) = g.id::text
    and (g.created_by = auth.uid() or exists (
      select 1 from public.group_members gm
      where gm.group_id = g.id and gm.user_id = auth.uid() and gm.role = 'admin'
    ))
));

create table if not exists public.game_guests (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  email text,
  nationality_code text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  profile_id uuid unique references public.profiles(id) on delete cascade,
  accepted_at timestamptz,
  unique (game_id, email)
);
alter table public.game_guests enable row level security;

create policy "game_guests_select_game_member" on public.game_guests
for select to authenticated using (is_game_member(game_id));

create policy "game_guests_insert_group_admin" on public.game_guests
for insert to authenticated with check (
  created_by = auth.uid() and exists (
    select 1 from public.games g where g.id = game_id
    and ((g.group_id is not null and is_group_admin(g.group_id)) or g.created_by = auth.uid())
  )
);

create policy "game_guests_delete_group_admin" on public.game_guests
for delete to authenticated using (exists (
  select 1 from public.games g where g.id = game_id
  and ((g.group_id is not null and is_group_admin(g.group_id)) or g.created_by = auth.uid())
));

create or replace function public.add_game_guest(
  p_game_id uuid,
  p_name text,
  p_email text default null,
  p_nationality_code text default 'BR'
)
returns table(profile_id uuid, guest_id uuid)
language plpgsql security definer set search_path = public
as $$
declare
  v_profile_id uuid := gen_random_uuid();
  v_guest_id uuid;
  v_game public.games;
begin
  select * into v_game from public.games where id = p_game_id;
  if not found then raise exception 'Partida não encontrada'; end if;
  if not (v_game.created_by = auth.uid() or (v_game.group_id is not null and is_group_admin(v_game.group_id))) then
    raise exception 'Sem permissão para adicionar participante';
  end if;
  insert into public.profiles (id,name,nationality_code,rating)
  values (v_profile_id,trim(p_name),coalesce(nullif(p_nationality_code,''),'BR'),3);
  insert into public.game_guests (game_id,name,email,nationality_code,created_by,profile_id)
  values (p_game_id,trim(p_name),nullif(lower(trim(p_email)),''),coalesce(nullif(p_nationality_code,''),'BR'),auth.uid(),v_profile_id)
  returning id into v_guest_id;
  insert into public.game_confirmations (game_id,user_id) values (p_game_id,v_profile_id);
  return query select v_profile_id,v_guest_id;
end;
$$;
grant execute on function public.add_game_guest(uuid,text,text,text) to authenticated;
