create or replace function public.update_game_guest_profile(
  p_game_id uuid,
  p_guest_id uuid,
  p_rating integer,
  p_position text
)
returns table(rating integer, positions text[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game record;
  v_guest record;
  v_is_admin boolean := false;
  v_rating integer;
  v_position text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select g.created_by, g.organizer_id, g.group_id
    into v_game
    from public.games g
   where g.id = p_game_id;

  if not found then
    raise exception 'GAME_NOT_FOUND';
  end if;

  select coalesce(p.is_admin, false)
    into v_is_admin
    from public.profiles p
   where p.id = auth.uid();

  if auth.uid() <> v_game.created_by
     and auth.uid() is distinct from v_game.organizer_id
     and not exists (
       select 1 from public.group_members gm
        where gm.group_id = v_game.group_id
          and gm.user_id = auth.uid()
          and gm.role = 'admin'
     )
     and not v_is_admin then
    raise exception 'FORBIDDEN';
  end if;

  select gg.profile_id
    into v_guest
    from public.game_guests gg
   where gg.id = p_guest_id
     and gg.game_id = p_game_id;

  if not found or v_guest.profile_id is null then
    raise exception 'GUEST_NOT_FOUND';
  end if;

  v_rating := greatest(1, least(5, coalesce(p_rating, 3)));
  v_position := nullif(trim(coalesce(p_position, '')), '');

  if v_position is not null and v_position not in (
    'goleiro','fixo','libero','meio','ala_esquerdo','ala_direito','pivo'
  ) then
    raise exception 'INVALID_POSITION';
  end if;

  update public.profiles
     set rating = v_rating,
         positions = case
           when v_position is null then coalesce(positions, '{}')
           else array[v_position]
         end
   where id = v_guest.profile_id;

  return query
  select p.rating, coalesce(p.positions, '{}')
    from public.profiles p
   where p.id = v_guest.profile_id;
end;
$$;

revoke all on function public.update_game_guest_profile(uuid, uuid, integer, text) from public, anon;
grant execute on function public.update_game_guest_profile(uuid, uuid, integer, text) to authenticated;
