CREATE OR REPLACE FUNCTION public.set_valid_game_draw(p_game_id uuid, p_draw_id bigint)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_draw public.game_draw_history%rowtype;
  v_game public.games%rowtype;
  v_team_a uuid[];
  v_team_b uuid[];
  v_team_a_reserves uuid[];
  v_team_b_reserves uuid[];
  v_ids uuid[];
  v_count integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if v_game.score_a is not null or v_game.score_b is not null then raise exception 'GAME_FINISHED'; end if;
  if v_game.organizer_id<>v_uid and not exists(select 1 from public.profiles p where p.id=v_uid and p.is_admin=true) then raise exception 'FORBIDDEN'; end if;
  select * into v_draw from public.game_draw_history where id=p_draw_id and game_id=p_game_id for update;
  if not found then raise exception 'DRAW_NOT_FOUND'; end if;

  v_team_a:=coalesce(array(select jsonb_array_elements_text(v_draw.team_a_starters)::uuid),'{}');
  v_team_b:=coalesce(array(select jsonb_array_elements_text(v_draw.team_b_starters)::uuid),'{}');
  v_team_a_reserves:=coalesce(array(select jsonb_array_elements_text(v_draw.team_a_reserves)::uuid),'{}');
  v_team_b_reserves:=coalesce(array(select jsonb_array_elements_text(v_draw.team_b_reserves)::uuid),'{}');

  v_team_a:=coalesce(array(select x from unnest(v_team_a) x where exists(select 1 from public.game_confirmations c where c.game_id=p_game_id and c.user_id=x)),'{}');
  v_team_b:=coalesce(array(select x from unnest(v_team_b) x where exists(select 1 from public.game_confirmations c where c.game_id=p_game_id and c.user_id=x)),'{}');
  v_team_a_reserves:=coalesce(array(select x from unnest(v_team_a_reserves) x where exists(select 1 from public.game_confirmations c where c.game_id=p_game_id and c.user_id=x)),'{}');
  v_team_b_reserves:=coalesce(array(select x from unnest(v_team_b_reserves) x where exists(select 1 from public.game_confirmations c where c.game_id=p_game_id and c.user_id=x)),'{}');
  v_ids:=v_team_a||v_team_b||v_team_a_reserves||v_team_b_reserves;
  v_count:=coalesce(array_length(v_ids,1),0);
  if v_count < 2 then raise exception 'MIN_TWO_PLAYERS_REQUIRED'; end if;
  if (select count(distinct x) from unnest(v_ids) x)<>v_count then raise exception 'DRAW_DUPLICATE_PLAYER'; end if;

  update public.game_draw_history set is_valid=false where game_id=p_game_id;
  update public.game_draw_history
    set is_valid=true,
        team_a_starters=to_jsonb(v_team_a),
        team_b_starters=to_jsonb(v_team_b),
        team_a_reserves=to_jsonb(v_team_a_reserves),
        team_b_reserves=to_jsonb(v_team_b_reserves)
    where id=p_draw_id;

  delete from public.game_teams where game_id=p_game_id;
  insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'A','starter' from unnest(v_team_a) x;
  insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'B','starter' from unnest(v_team_b) x;
  insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'A','reserve' from unnest(v_team_a_reserves) x;
  insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'B','reserve' from unnest(v_team_b_reserves) x;
  return p_draw_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.remove_game_participant_and_promote(p_game_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_game public.games%rowtype;
  v_is_admin boolean;
  v_capacity integer;
  v_confirmed integer;
  v_promote uuid;
  v_had_draw boolean;
  v_draw_id bigint;
  v_a uuid[];
  v_b uuid[];
  v_ar uuid[];
  v_br uuid[];
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if not found then raise exception 'Partida não encontrada'; end if;
  v_is_admin := v_game.created_by=auth.uid() or (v_game.group_id is not null and public.is_group_admin(v_game.group_id));
  if p_user_id<>auth.uid() and not v_is_admin then raise exception 'Sem permissão para remover outro jogador'; end if;
  if exists(select 1 from public.game_waitlist where game_id=p_game_id and user_id=p_user_id) then
    delete from public.game_waitlist where game_id=p_game_id and user_id=p_user_id;
    return 'waitlist_removed';
  end if;
  if exists(select 1 from public.game_confirmations where game_id=p_game_id and user_id=p_user_id)
     and v_game.group_id is not null and public.game_start_at(v_game)>now()
     and (select participation_penalty_enabled from public.groups where id=v_game.group_id)=true
     and public.game_start_at(v_game)-now() < make_interval(hours => (select participation_penalty_hours from public.groups where id=v_game.group_id))
     and (select participation_penalty_games from public.groups where id=v_game.group_id)>0
     and not exists(select 1 from public.game_participation_penalties p where p.group_id=v_game.group_id and p.user_id=p_user_id and p.canceled_game_id=p_game_id and p.released_at is null) then
    insert into public.game_participation_penalties(group_id,user_id,canceled_game_id,reason)
    values(v_game.group_id,p_user_id,p_game_id,case when p_user_id=auth.uid() then 'late_cancellation' else 'late_admin_removal' end);
  end if;

  v_had_draw:=exists(select 1 from public.game_teams where game_id=p_game_id) or exists(select 1 from public.game_draw_history where game_id=p_game_id and is_valid=true);
  delete from public.game_confirmations where game_id=p_game_id and user_id=p_user_id;
  if not found then return 'not_found'; end if;

  select id into v_draw_id from public.game_draw_history where game_id=p_game_id and is_valid=true order by id desc limit 1;
  if v_draw_id is not null then
    select coalesce(array(select jsonb_array_elements_text(team_a_starters)::uuid),'{}'),
           coalesce(array(select jsonb_array_elements_text(team_b_starters)::uuid),'{}'),
           coalesce(array(select jsonb_array_elements_text(team_a_reserves)::uuid),'{}'),
           coalesce(array(select jsonb_array_elements_text(team_b_reserves)::uuid),'{}')
      into v_a,v_b,v_ar,v_br from public.game_draw_history where id=v_draw_id;
    v_a:=array(select x from unnest(v_a) x where x<>p_user_id);
    v_b:=array(select x from unnest(v_b) x where x<>p_user_id);
    v_ar:=array(select x from unnest(v_ar) x where x<>p_user_id);
    v_br:=array(select x from unnest(v_br) x where x<>p_user_id);
    update public.game_draw_history set team_a_starters=to_jsonb(v_a),team_b_starters=to_jsonb(v_b),team_a_reserves=to_jsonb(v_ar),team_b_reserves=to_jsonb(v_br) where id=v_draw_id;
    delete from public.game_teams where game_id=p_game_id;
    insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'A','starter' from unnest(v_a) x;
    insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'B','starter' from unnest(v_b) x;
    insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'A','reserve' from unnest(v_ar) x;
    insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'B','reserve' from unnest(v_br) x;
  end if;

  v_capacity:=greatest(1,coalesce(v_game.players_per_team,5)+coalesce(v_game.reserves_per_team,0))*2;
  select count(*) into v_confirmed from public.game_confirmations where game_id=p_game_id;
  if v_confirmed<v_capacity then
    select w.user_id into v_promote from public.game_waitlist w where w.game_id=p_game_id order by w.queued_at asc,w.id asc limit 1;
    if v_promote is not null then
      insert into public.game_confirmations(game_id,user_id) values(p_game_id,v_promote) on conflict do nothing;
      delete from public.game_waitlist where game_id=p_game_id and user_id=v_promote;
      return case when v_had_draw then 'confirmed_removed_promoted_draw_kept_valid' else 'confirmed_removed_promoted' end;
    end if;
  end if;
  return case when v_had_draw then 'confirmed_removed_draw_kept_valid' else 'confirmed_removed' end;
end;
$function$;
