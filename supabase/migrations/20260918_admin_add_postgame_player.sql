create or replace function public.admin_add_postgame_player(
  p_game_id uuid,
  p_user_id uuid,
  p_team text
)
returns uuid
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_game public.games%rowtype;
begin
  if not public.is_global_admin() then
    raise exception 'ADMIN_ONLY';
  end if;

  if p_game_id is null or p_user_id is null then
    raise exception 'INVALID_INPUT';
  end if;

  if p_team not in ('A','B') then
    raise exception 'INVALID_TEAM';
  end if;

  select * into v_game
  from public.games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'GAME_NOT_FOUND';
  end if;

  if v_game.score_a is null or v_game.score_b is null then
    raise exception 'GAME_NOT_FINISHED';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  if exists (
    select 1 from public.game_confirmations
    where game_id = p_game_id and user_id = p_user_id
  ) then
    raise exception 'PLAYER_ALREADY_IN_GAME';
  end if;

  if exists (
    select 1 from public.game_teams
    where game_id = p_game_id and user_id = p_user_id
  ) then
    raise exception 'PLAYER_ALREADY_IN_GAME';
  end if;

  insert into public.game_confirmations(game_id, user_id)
  values (p_game_id, p_user_id);

  insert into public.game_teams(game_id, user_id, team, role)
  values (p_game_id, p_user_id, p_team, 'starter');

  return p_user_id;
end;
$$;

grant execute on function public.admin_add_postgame_player(uuid, uuid, text) to authenticated;
