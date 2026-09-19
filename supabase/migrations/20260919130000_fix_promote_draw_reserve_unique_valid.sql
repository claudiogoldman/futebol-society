-- Fix promotion ordering: release the existing valid draw before inserting the replacement,
-- otherwise the partial unique index on one valid draw per game rejects the insert.
create or replace function public.promote_draw_reserve_to_starter(
  p_game_id uuid,
  p_draw_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_game public.games%rowtype;
  v_source public.game_draw_history%rowtype;
  v_new_draw_id bigint;
  v_new_draw_number integer;
  v_a jsonb;
  v_b jsonb;
  v_ra jsonb;
  v_rb jsonb;
  v_reserve_id uuid;
  v_target text;
  v_count integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;

  if not (
    v_game.organizer_id = v_uid
    or exists (select 1 from public.profiles p where p.id = v_uid and p.is_admin = true)
  ) then raise exception 'FORBIDDEN'; end if;

  if v_game.score_a is not null or v_game.score_b is not null then
    raise exception 'GAME_FINISHED';
  end if;

  select * into v_source
  from public.game_draw_history
  where id = p_draw_id and game_id = p_game_id
  for update;

  if not found then raise exception 'DRAW_NOT_FOUND'; end if;

  v_a := coalesce(v_source.team_a_starters, '[]'::jsonb);
  v_b := coalesce(v_source.team_b_starters, '[]'::jsonb);
  v_ra := coalesce(v_source.team_a_reserves, '[]'::jsonb);
  v_rb := coalesce(v_source.team_b_reserves, '[]'::jsonb);

  if jsonb_array_length(v_ra) + jsonb_array_length(v_rb) <> 1 then
    raise exception 'PROMOTION_REQUIRES_ONE_RESERVE';
  end if;

  if jsonb_array_length(v_a) + jsonb_array_length(v_b) <> (2 * coalesce(v_source.players_per_team, v_game.players_per_team)) - 1 then
    raise exception 'PROMOTION_REQUIRES_ONE_UNDERFILLED_STARTER_SLOT';
  end if;

  if jsonb_array_length(v_a) = coalesce(v_source.players_per_team, v_game.players_per_team) - 1
     and jsonb_array_length(v_b) = coalesce(v_source.players_per_team, v_game.players_per_team) then
    v_target := 'A';
  elsif jsonb_array_length(v_b) = coalesce(v_source.players_per_team, v_game.players_per_team) - 1
     and jsonb_array_length(v_a) = coalesce(v_source.players_per_team, v_game.players_per_team) then
    v_target := 'B';
  else
    raise exception 'PROMOTION_REQUIRES_ONE_UNDERFILLED_STARTER_SLOT';
  end if;

  v_reserve_id := (case when jsonb_array_length(v_ra) = 1 then v_ra->>0 else v_rb->>0 end)::uuid;

  if v_target = 'A' then
    v_a := v_a || jsonb_build_array(v_reserve_id);
    v_ra := '[]'::jsonb;
  else
    v_b := v_b || jsonb_build_array(v_reserve_id);
    v_rb := '[]'::jsonb;
  end if;

  select count(*) into v_count
  from (
    select jsonb_array_elements_text(v_a)
    union all select jsonb_array_elements_text(v_b)
    union all select jsonb_array_elements_text(v_ra)
    union all select jsonb_array_elements_text(v_rb)
  ) x;

  if v_count <> 2 * coalesce(v_source.players_per_team, v_game.players_per_team) then
    raise exception 'PROMOTION_INVALID_PLAYER_COUNT';
  end if;

  select coalesce(max(draw_number), 0) + 1
    into v_new_draw_number
    from public.game_draw_history
   where game_id = p_game_id;

  -- The partial unique index allows only one valid draw per game.
  -- Invalidate the current valid draw before inserting the corrected valid snapshot.
  update public.game_draw_history
     set is_valid = false
   where game_id = p_game_id
     and is_valid = true;

  insert into public.game_draw_history (
    game_id, draw_number, created_by, players_per_team, reserves_per_team,
    team_a_starters, team_b_starters, team_a_reserves, team_b_reserves, is_valid
  ) values (
    p_game_id, v_new_draw_number, v_uid, v_source.players_per_team, 0,
    v_a, v_b, v_ra, v_rb, true
  )
  returning id into v_new_draw_id;

  delete from public.game_teams where game_id = p_game_id;

  insert into public.game_teams(game_id,user_id,team,role)
    select p_game_id, x::uuid, 'A', 'starter'
    from jsonb_array_elements_text(v_a) x;

  insert into public.game_teams(game_id,user_id,team,role)
    select p_game_id, x::uuid, 'B', 'starter'
    from jsonb_array_elements_text(v_b) x;

  return v_new_draw_id;
end;
$function$;

revoke all on function public.promote_draw_reserve_to_starter(uuid, bigint) from public, anon;
grant execute on function public.promote_draw_reserve_to_starter(uuid, bigint) to authenticated;
