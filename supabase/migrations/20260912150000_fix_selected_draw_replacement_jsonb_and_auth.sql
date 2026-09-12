create or replace function public.adjust_game_draw_for_player_replacement(
  p_game_id uuid,
  p_draw_id bigint,
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
  v_source public.game_draw_history%rowtype;
  v_new_draw_id bigint;
  v_new_draw_number bigint;
  v_team_a_starters uuid[];
  v_team_b_starters uuid[];
  v_team_a_reserves uuid[];
  v_team_b_reserves uuid[];
  v_replaced boolean := false;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if v_game.organizer_id <> v_uid and not exists (select 1 from public.profiles where id = v_uid and is_admin = true) then raise exception 'FORBIDDEN'; end if;
  if p_out_user_id is null or p_in_user_id is null or p_out_user_id = p_in_user_id then raise exception 'INVALID_PLAYER_REPLACEMENT'; end if;

  select h.* into v_source
    from public.game_draw_history h
   where h.game_id = p_game_id and h.id = p_draw_id and not coalesce(h.is_valid, false)
   for update;
  if not found then raise exception 'DRAW_NOT_FOUND_OR_ALREADY_VALID'; end if;

  v_team_a_starters := coalesce(array(select jsonb_array_elements_text(v_source.team_a_starters)::uuid), '{}');
  v_team_b_starters := coalesce(array(select jsonb_array_elements_text(v_source.team_b_starters)::uuid), '{}');
  v_team_a_reserves := coalesce(array(select jsonb_array_elements_text(v_source.team_a_reserves)::uuid), '{}');
  v_team_b_reserves := coalesce(array(select jsonb_array_elements_text(v_source.team_b_reserves)::uuid), '{}');

  if p_out_user_id = any(v_team_a_starters) then
    v_team_a_starters := array_replace(v_team_a_starters, p_out_user_id, p_in_user_id); v_replaced := true;
  elsif p_out_user_id = any(v_team_b_starters) then
    v_team_b_starters := array_replace(v_team_b_starters, p_out_user_id, p_in_user_id); v_replaced := true;
  elsif p_out_user_id = any(v_team_a_reserves) then
    v_team_a_reserves := array_replace(v_team_a_reserves, p_out_user_id, p_in_user_id); v_replaced := true;
  elsif p_out_user_id = any(v_team_b_reserves) then
    v_team_b_reserves := array_replace(v_team_b_reserves, p_out_user_id, p_in_user_id); v_replaced := true;
  end if;

  if not v_replaced then raise exception 'PLAYER_TO_REPLACE_NOT_IN_SELECTED_DRAW'; end if;
  if p_in_user_id = any(v_team_a_starters) or p_in_user_id = any(v_team_b_starters) or p_in_user_id = any(v_team_a_reserves) or p_in_user_id = any(v_team_b_reserves) then raise exception 'NEW_PLAYER_ALREADY_IN_SELECTED_DRAW'; end if;
  if exists (select 1 from public.game_confirmations where game_id = p_game_id and user_id = p_out_user_id) then raise exception 'PLAYER_TO_REPLACE_IS_STILL_CONFIRMED'; end if;
  if not exists (select 1 from public.game_confirmations where game_id = p_game_id and user_id = p_in_user_id) then raise exception 'NEW_PLAYER_MUST_BE_CONFIRMED'; end if;

  select coalesce(max(draw_number), 0) + 1 into v_new_draw_number from public.game_draw_history where game_id = p_game_id;
  update public.game_draw_history set is_valid = false where game_id = p_game_id;
  insert into public.game_draw_history (game_id, draw_number, created_by, players_per_team, reserves_per_team, team_a_starters, team_b_starters, team_a_reserves, team_b_reserves, is_valid)
  values (p_game_id, v_new_draw_number, v_uid, v_source.players_per_team, v_source.reserves_per_team, to_jsonb(v_team_a_starters), to_jsonb(v_team_b_starters), to_jsonb(v_team_a_reserves), to_jsonb(v_team_b_reserves), true)
  returning id into v_new_draw_id;

  delete from public.game_teams where game_id = p_game_id;
  insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'A','starter' from unnest(v_team_a_starters) x;
  insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'B','starter' from unnest(v_team_b_starters) x;
  insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'A','reserve' from unnest(v_team_a_reserves) x;
  insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'B','reserve' from unnest(v_team_b_reserves) x;
  return v_new_draw_id;
end;
$$;

revoke execute on function public.adjust_game_draw_for_player_replacement(uuid,bigint,uuid,uuid) from public;
revoke execute on function public.adjust_game_draw_for_player_replacement(uuid,bigint,uuid,uuid) from anon;
grant execute on function public.adjust_game_draw_for_player_replacement(uuid,bigint,uuid,uuid) to authenticated;
