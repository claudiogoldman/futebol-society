alter table public.game_draw_history add column if not exists is_valid boolean not null default false;

create unique index if not exists game_draw_history_one_valid_per_game
  on public.game_draw_history(game_id)
  where is_valid;

create index if not exists game_draw_history_game_draw_idx
  on public.game_draw_history(game_id, draw_number desc);

create or replace function public.persist_game_draw(
  p_game_id uuid,
  p_team_a uuid[],
  p_team_b uuid[],
  p_team_a_reserves uuid[] default '{}'::uuid[],
  p_team_b_reserves uuid[] default '{}'::uuid[]
) returns bigint
language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games%rowtype;
  v_draw bigint;
  v_expected integer;
  v_ids uuid[];
  v_count integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if v_game.organizer_id<>v_uid and not exists(select 1 from public.profiles where id=v_uid and is_admin=true) then raise exception 'FORBIDDEN'; end if;
  v_expected:=greatest(1,coalesce(v_game.players_per_team,1));
  if coalesce(array_length(p_team_a,1),0)<>v_expected or coalesce(array_length(p_team_b,1),0)<>v_expected then raise exception 'INVALID_STARTER_COUNT'; end if;
  if coalesce(array_length(p_team_a_reserves,1),0)<>coalesce(v_game.reserves_per_team,0) or coalesce(array_length(p_team_b_reserves,1),0)<>coalesce(v_game.reserves_per_team,0) then raise exception 'INVALID_RESERVE_COUNT'; end if;
  v_ids:=coalesce(p_team_a,'{}')||coalesce(p_team_b,'{}')||coalesce(p_team_a_reserves,'{}')||coalesce(p_team_b_reserves,'{}');
  v_count:=coalesce(array_length(v_ids,1),0);
  if v_count<>2*(v_expected+coalesce(v_game.reserves_per_team,0)) then raise exception 'INVALID_TEAM_SIZE'; end if;
  if (select count(distinct x) from unnest(v_ids) x)<>v_count then raise exception 'DUPLICATE_PLAYER'; end if;
  if exists(select 1 from unnest(v_ids) x where not exists(select 1 from public.game_confirmations c where c.game_id=p_game_id and c.user_id=x)) then raise exception 'PLAYER_NOT_CONFIRMED'; end if;
  select coalesce(max(draw_number),0)+1 into v_draw from public.game_draw_history where game_id=p_game_id;
  update public.game_draw_history set is_valid=false where game_id=p_game_id;
  insert into public.game_draw_history(game_id,draw_number,created_by,players_per_team,reserves_per_team,team_a_starters,team_b_starters,team_a_reserves,team_b_reserves,is_valid)
  values(p_game_id,v_draw,v_uid,v_game.players_per_team,v_game.reserves_per_team,to_jsonb(p_team_a),to_jsonb(p_team_b),to_jsonb(p_team_a_reserves),to_jsonb(p_team_b_reserves),true)
  returning id into v_draw;
  delete from public.game_teams where game_id=p_game_id;
  insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'A','starter' from unnest(p_team_a) x;
  insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'B','starter' from unnest(p_team_b) x;
  insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'A','reserve' from unnest(p_team_a_reserves) x;
  insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'B','reserve' from unnest(p_team_b_reserves) x;
  return v_draw;
end; $$;

create or replace function public.set_valid_game_draw(p_game_id uuid,p_draw_id bigint) returns bigint
language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid; v_draw public.game_draw_history%rowtype;
begin
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_draw from public.game_draw_history where id=p_draw_id and game_id=p_game_id;
  if not found then raise exception 'DRAW_NOT_FOUND'; end if;
  if not exists(select 1 from public.games g where g.id=p_game_id and (g.organizer_id=v_uid or exists(select 1 from public.profiles p where p.id=v_uid and p.is_admin=true))) then raise exception 'FORBIDDEN'; end if;
  update public.game_draw_history set is_valid=false where game_id=p_game_id;
  update public.game_draw_history set is_valid=true where id=p_draw_id;
  delete from public.game_teams where game_id=p_game_id;
  insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'A','starter' from jsonb_array_elements_text(v_draw.team_a_starters) x;
  insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'B','starter' from jsonb_array_elements_text(v_draw.team_b_starters) x;
  insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'A','reserve' from jsonb_array_elements_text(v_draw.team_a_reserves) x;
  insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'B','reserve' from jsonb_array_elements_text(v_draw.team_b_reserves) x;
  return p_draw_id;
end; $$;

revoke all on function public.persist_game_draw(uuid,uuid[],uuid[],uuid[],uuid[]) from public,anon;
grant execute on function public.persist_game_draw(uuid,uuid[],uuid[],uuid[],uuid[]) to authenticated;
revoke all on function public.set_valid_game_draw(uuid,bigint) from public,anon;
grant execute on function public.set_valid_game_draw(uuid,bigint) to authenticated;
