-- Business rule: a draw is available whenever there are at least 2
-- confirmed players, even when the configured team capacity is not full.
-- Teams must remain non-empty and as balanced as possible (size difference <= 1).

create or replace function public.persist_game_draw(
  p_game_id uuid,
  p_team_a uuid[],
  p_team_b uuid[],
  p_team_a_reserves uuid[] default '{}'::uuid[],
  p_team_b_reserves uuid[] default '{}'::uuid[]
) returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games%rowtype;
  v_draw bigint;
  v_total integer;
  v_capacity integer;
  v_expected_starters integer;
  v_ids uuid[];
  v_count integer;
  v_confirmed_count integer;
  v_team_a_count integer;
  v_team_b_count integer;
  v_team_a_reserves integer;
  v_team_b_reserves integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;

  if v_game.organizer_id <> v_uid
     and not exists(select 1 from public.profiles where id = v_uid and is_admin = true) then
    raise exception 'FORBIDDEN';
  end if;

  v_expected_starters := greatest(1, coalesce(v_game.players_per_team, 1));
  v_capacity := 2 * (v_expected_starters + coalesce(v_game.reserves_per_team, 0));

  v_team_a_count := coalesce(array_length(p_team_a, 1), 0);
  v_team_b_count := coalesce(array_length(p_team_b, 1), 0);
  v_team_a_reserves := coalesce(array_length(p_team_a_reserves, 1), 0);
  v_team_b_reserves := coalesce(array_length(p_team_b_reserves, 1), 0);

  if v_team_a_count = 0 or v_team_b_count = 0 then
    raise exception 'MIN_TWO_PLAYERS_REQUIRED';
  end if;

  if abs(v_team_a_count - v_team_b_count) > 1 then
    raise exception 'UNBALANCED_TEAM_SIZE';
  end if;

  if v_team_a_count > v_expected_starters or v_team_b_count > v_expected_starters then
    raise exception 'INVALID_STARTER_COUNT';
  end if;

  if v_team_a_reserves > coalesce(v_game.reserves_per_team, 0)
     or v_team_b_reserves > coalesce(v_game.reserves_per_team, 0) then
    raise exception 'INVALID_RESERVE_COUNT';
  end if;

  v_ids := coalesce(p_team_a, '{}')
    || coalesce(p_team_b, '{}')
    || coalesce(p_team_a_reserves, '{}')
    || coalesce(p_team_b_reserves, '{}');
  v_count := coalesce(array_length(v_ids, 1), 0);

  if v_count < 2 then raise exception 'MIN_TWO_PLAYERS_REQUIRED'; end if;
  if v_count > v_capacity then raise exception 'INVALID_TEAM_SIZE'; end if;

  select count(*) into v_confirmed_count
    from public.game_confirmations c
    where c.game_id = p_game_id;
  if v_count <> v_confirmed_count then
    raise exception 'DRAW_MUST_INCLUDE_ALL_CONFIRMED_PLAYERS';
  end if;

  if (select count(distinct x) from unnest(v_ids) x) <> v_count then
    raise exception 'DUPLICATE_PLAYER';
  end if;

  if exists(
    select 1
    from unnest(v_ids) x
    where not exists(
      select 1 from public.game_confirmations c
      where c.game_id = p_game_id and c.user_id = x
    )
  ) then
    raise exception 'PLAYER_NOT_CONFIRMED';
  end if;

  select coalesce(max(draw_number), 0) + 1
    into v_total
    from public.game_draw_history
    where game_id = p_game_id;

  update public.game_draw_history set is_valid = false where game_id = p_game_id;

  insert into public.game_draw_history(
    game_id,
    draw_number,
    created_by,
    players_per_team,
    reserves_per_team,
    team_a_starters,
    team_b_starters,
    team_a_reserves,
    team_b_reserves,
    is_valid
  ) values(
    p_game_id,
    v_total,
    v_uid,
    v_game.players_per_team,
    v_game.reserves_per_team,
    to_jsonb(p_team_a),
    to_jsonb(p_team_b),
    to_jsonb(p_team_a_reserves),
    to_jsonb(p_team_b_reserves),
    true
  ) returning id into v_draw;

  delete from public.game_teams where game_id = p_game_id;
  insert into public.game_teams(game_id, user_id, team, role)
    select p_game_id, x, 'A', 'starter' from unnest(p_team_a) x;
  insert into public.game_teams(game_id, user_id, team, role)
    select p_game_id, x, 'B', 'starter' from unnest(p_team_b) x;
  insert into public.game_teams(game_id, user_id, team, role)
    select p_game_id, x, 'A', 'reserve' from unnest(p_team_a_reserves) x;
  insert into public.game_teams(game_id, user_id, team, role)
    select p_game_id, x, 'B', 'reserve' from unnest(p_team_b_reserves) x;

  return v_draw;
end;
$$;

grant execute on function public.persist_game_draw(uuid, uuid[], uuid[], uuid[], uuid[]) to authenticated;
