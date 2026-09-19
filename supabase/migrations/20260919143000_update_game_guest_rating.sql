-- Allow the organizer/admin to adjust the base rating of a guest profile.
-- Guests are scoped to a game, so the authorization is checked against that game.
create or replace function public.update_game_guest_rating(
  p_game_id uuid,
  p_guest_id uuid,
  p_rating integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_game public.games%rowtype;
  v_guest public.game_guests%rowtype;
  v_rating integer := greatest(1, least(5, p_rating));
begin
  select * into v_game
  from public.games
  where id = p_game_id;

  if not found then
    raise exception 'Partida não encontrada';
  end if;

  if not (
    v_game.created_by = auth.uid()
    or v_game.organizer_id = auth.uid()
    or (v_game.group_id is not null and public.is_group_admin(v_game.group_id))
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_admin = true
    )
  ) then
    raise exception 'Sem permissão para ajustar o perfil do convidado';
  end if;

  select * into v_guest
  from public.game_guests
  where id = p_guest_id
    and game_id = p_game_id;

  if not found then
    raise exception 'Convidado não encontrado nesta partida';
  end if;

  if v_guest.profile_id is null then
    raise exception 'Convidado sem perfil';
  end if;

  update public.profiles
     set rating = v_rating
   where id = v_guest.profile_id;

  return v_rating;
end;
$function$;

revoke all on function public.update_game_guest_rating(uuid, uuid, integer) from public, anon;
grant execute on function public.update_game_guest_rating(uuid, uuid, integer) to authenticated;
