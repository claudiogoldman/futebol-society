CREATE OR REPLACE FUNCTION public.remove_game_participant_and_promote(p_game_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_game public.games%rowtype;
  v_is_admin boolean;
  v_capacity integer;
  v_confirmed integer;
  v_promote uuid;
  v_had_draw boolean;
  v_completed boolean;
  v_penalty_enabled boolean;
  v_penalty_hours integer;
  v_penalty_games integer;
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

  v_completed := v_game.score_a is not null or v_game.score_b is not null;

  select coalesce(participation_penalty_enabled,true),
         coalesce(participation_penalty_hours,24),
         coalesce(participation_penalty_games,1)
    into v_penalty_enabled, v_penalty_hours, v_penalty_games
    from public.groups where id=v_game.group_id;

  -- A penalidade é determinada pela antecedência em relação ao horário
  -- programado da partida no momento da retirada. "24 horas ou menos"
  -- inclui exatamente 24h, o horário de início (0h) e valores negativos
  -- quando a retirada só puder ser registrada após o início/fim da partida.
  if exists(select 1 from public.game_confirmations where game_id=p_game_id and user_id=p_user_id)
     and v_game.group_id is not null
     and v_penalty_enabled = true
     and public.game_start_at(v_game)-now() <= make_interval(hours => v_penalty_hours)
     and v_penalty_games > 0
     and not exists(select 1 from public.game_participation_penalties p where p.group_id=v_game.group_id and p.user_id=p_user_id and p.canceled_game_id=p_game_id and p.released_at is null) then
    insert into public.game_participation_penalties(group_id,user_id,canceled_game_id,reason)
    values(v_game.group_id,p_user_id,p_game_id,case when p_user_id=auth.uid() then 'late_cancellation' else 'late_admin_removal' end);
  end if;

  v_had_draw := exists(select 1 from public.game_teams where game_id=p_game_id)
    or exists(select 1 from public.game_draw_history where game_id=p_game_id and is_valid=true);

  delete from public.game_confirmations where game_id=p_game_id and user_id=p_user_id;
  if not found then return 'not_found'; end if;

  -- Alteração antes do término invalida o sorteio atual. Após a partida,
  -- a composição histórica não é alterada.
  if not v_completed then
    update public.game_draw_history set is_valid=false where game_id=p_game_id and is_valid=true;
    delete from public.game_teams where game_id=p_game_id;
  end if;

  v_capacity:=greatest(1,coalesce(v_game.players_per_team,5)+coalesce(v_game.reserves_per_team,0))*2;
  select count(*) into v_confirmed from public.game_confirmations where game_id=p_game_id;
  if v_confirmed<v_capacity then
    select w.user_id into v_promote from public.game_waitlist w where w.game_id=p_game_id order by w.queued_at asc,w.id asc limit 1;
    if v_promote is not null then
      insert into public.game_confirmations(game_id,user_id) values(p_game_id,v_promote) on conflict do nothing;
      delete from public.game_waitlist where game_id=p_game_id and user_id=v_promote;
      return case when v_had_draw and not v_completed then 'confirmed_removed_promoted_draw_invalidated' else 'confirmed_removed_promoted' end;
    end if;
  end if;

  return case when v_had_draw and not v_completed then 'confirmed_removed_draw_invalidated' else 'confirmed_removed' end;
end;
$function$;
