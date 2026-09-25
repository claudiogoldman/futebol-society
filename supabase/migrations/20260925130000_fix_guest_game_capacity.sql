-- Guests are game participants, so they must respect the same game capacity as regular confirmations.
-- This closes the path where adding guests could create more confirmations than max_players,
-- after which the UI would only draw the first configured capacity.
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
  v_confirmed_count integer;
begin
  select * into v_game from public.games where id = p_game_id;
  if not found then raise exception 'Partida não encontrada'; end if;

  if not (
    v_game.created_by = auth.uid()
    or (v_game.group_id is not null and is_group_admin(v_game.group_id))
  ) then
    raise exception 'Sem permissão para adicionar participante';
  end if;

  if v_game.max_players is not null then
    select count(*) into v_confirmed_count
      from public.game_confirmations
     where game_id = p_game_id;

    if v_confirmed_count >= v_game.max_players then
      raise exception 'PARTIDA_LOTADA';
    end if;
  end if;

  insert into public.profiles (id,name,nationality_code,rating)
  values (v_profile_id,trim(p_name),coalesce(nullif(p_nationality_code,''),'BR'),3);

  insert into public.game_guests (game_id,name,email,nationality_code,created_by,profile_id)
  values (p_game_id,trim(p_name),nullif(lower(trim(p_email)),''),coalesce(nullif(p_nationality_code,''),'BR'),auth.uid(),v_profile_id)
  returning id into v_guest_id;

  insert into public.game_confirmations (game_id,user_id)
  values (p_game_id,v_profile_id);

  return query select v_profile_id,v_guest_id;
end;
$$;
