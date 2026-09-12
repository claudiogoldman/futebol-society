create or replace function public.adjust_game_draw_for_player_replacement(
  p_game_id uuid,
  p_out_user_id uuid,
  p_in_user_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games%rowtype;
  v_draw public.game_draw_history%rowtype;
  v_new_draw bigint;
  v_draw_ids uuid[];
  v_team_a uuid[];
  v_team_b uuid[];
  v_team_a_reserves uuid[];
  v_team_b_reserves uuid[];
  v_confirmed_count integer;
  v_expected_count integer;
  v_draw_count integer;
  v_total integer;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_game
  from public.games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'GAME_NOT_FOUND';
  end if;

  if v_game.score_a is not null or v_game.score_b is not null then
    raise exception 'GAME_FINISHED';
  end if;

  if v_game.organizer_id <> v_uid
     and not exists (
       select 1 from public.profiles
       where id = v_uid and is_admin = true
     ) then
    raise exception 'FORBIDDEN';
  end if;

  if p_out_user_id is null or p_in_user_id is null or p_out_user_id = p_in_user_id then
    raise exception 'INVALID_PLAYER_REPLACEMENT';
  end if;

  if exists (
    select 1 from public.game_confirmations
    where game_id = p_game_id and user_id = p_out_user_id
  ) then
    raise exception 'PLAYER_TO_REPLACE_IS_STILL_CONFIRMED';
  end if;

  if not exists (
    select 1 from public.game_confirmations
    where game_id = p_game_id and user_id = p_in_user_id
  ) then
    raise exception 'NEW_PLAYER_MUST_BE_CONFIRMED';
  end if;

  select * into v_draw
  from public.game_draw_history
  where game_id = p_game_id
  order by draw_number desc
  limit 1;

  if not found then
    raise exception 'DRAW_NOT_FOUND';
  end if;

  v_team_a := coalesce(array(
    select jsonb_array_elements_text(v_draw.team_a_starters)::uuid
  ), '{}');
  v_team_b := coalesce(array(
    select jsonb_array_elements_text(v_draw.team_b_starters)::uuid
  ), '{}');
  v_team_a_reserves := coalesce(array(
    select jsonb_array_elements_text(v_draw.team_a_reserves)::uuid
  ), '{}');
  v_team_b_reserves := coalesce(array(
    select jsonb_array_elements_text(v_draw.team_b_reserves)::uuid
  ), '{}');

  v_draw_ids := v_team_a || v_team_b || v_team_a_reserves || v_team_b_reserves;
  v_draw_count := coalesce(array_length(v_draw_ids, 1), 0);
  v_expected_count := 2 * (
    greatest(1, coalesce(v_game.players_per_team, 1))
    + coalesce(v_game.reserves_per_team, 0)
  );

  if v_draw_count <> v_expected_count then
    raise exception 'DRAW_SIZE_NO_LONGER_MATCHES_GAME';
  end if;

  if (select count(distinct x) from unnest(v_draw_ids) x) <> v_draw_count then
    raise exception 'DRAW_DUPLICATE_PLAYER';
  end if;

  if not (p_out_user_id = any(v_draw_ids)) then
    raise exception 'PLAYER_TO_REPLACE_NOT_IN_LAST_DRAW';
  end if;

  if p_in_user_id = any(v_draw_ids) then
    raise exception 'NEW_PLAYER_ALREADY_IN_DRAW';
  end if;

  select count(*) into v_confirmed_count
  from public.game_confirmations
  where game_id = p_game_id;

  if v_confirmed_count <> v_expected_count then
    raise exception 'REPLACEMENT_REQUIRES_FULL_ROSTER';
  end if;

  if exists (
    select 1
    from public.game_confirmations c
    where c.game_id = p_game_id
      and c.user_id <> p_in_user_id
      and c.user_id <> all(v_draw_ids)
  ) then
    raise exception 'ROSTER_HAS_MORE_THAN_ONE_CHANGE';
  end if;

  v_team_a := array_replace(v_team_a, p_out_user_id, p_in_user_id);
  v_team_b := array_replace(v_team_b, p_out_user_id, p_in_user_id);
  v_team_a_reserves := array_replace(v_team_a_reserves, p_out_user_id, p_in_user_id);
  v_team_b_reserves := array_replace(v_team_b_reserves, p_out_user_id, p_in_user_id);

  if not (
    p_in_user_id = any(v_team_a)
    or p_in_user_id = any(v_team_b)
    or p_in_user_id = any(v_team_a_reserves)
    or p_in_user_id = any(v_team_b_reserves)
  ) then
    raise exception 'PLAYER_REPLACEMENT_FAILED';
  end if;

  select coalesce(max(draw_number), 0) + 1
    into v_total
  from public.game_draw_history
  where game_id = p_game_id;

  update public.game_draw_history
  set is_valid = false
  where game_id = p_game_id;

  insert into public.game_draw_history (
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
  ) values (
    p_game_id,
    v_total,
    v_uid,
    v_game.players_per_team,
    v_game.reserves_per_team,
    to_jsonb(v_team_a),
    to_jsonb(v_team_b),
    to_jsonb(v_team_a_reserves),
    to_jsonb(v_team_b_reserves),
    true
  )
  returning id into v_new_draw;

  delete from public.game_teams
  where game_id = p_game_id;

  insert into public.game_teams(game_id, user_id, team, role)
    select p_game_id, x, 'A', 'starter' from unnest(v_team_a) x;
  insert into public.game_teams(game_id, user_id, team, role)
    select p_game_id, x, 'B', 'starter' from unnest(v_team_b) x;
  insert into public.game_teams(game_id, user_id, team, role)
    select p_game_id, x, 'A', 'reserve' from unnest(v_team_a_reserves) x;
  insert into public.game_teams(game_id, user_id, team, role)
    select p_game_id, x, 'B', 'reserve' from unnest(v_team_b_reserves) x;

  return v_new_draw;
end;
$$;

revoke execute on function public.adjust_game_draw_for_player_replacement(uuid, uuid, uuid) from public;
revoke execute on function public.adjust_game_draw_for_player_replacement(uuid, uuid, uuid) from anon;
grant execute on function public.adjust_game_draw_for_player_replacement(uuid, uuid, uuid) to authenticated;
