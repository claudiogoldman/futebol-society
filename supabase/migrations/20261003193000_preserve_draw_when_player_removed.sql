create or replace function public.remove_game_participant_and_promote(p_game_id uuid, p_user_id uuid default auth.uid())
returns text
language plpgsql
security definer
set search_path = ''
as $function$
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
  v_payment_enabled boolean;
  v_payment_mode text;
  v_paying_count integer;
  v_charge numeric(12,2);
  v_penalty_id uuid;
  v_draw public.game_draw_history%rowtype;
  v_team_a uuid[];
  v_team_b uuid[];
  v_team_a_reserves uuid[];
  v_team_b_reserves uuid[];
  v_replacement_done boolean := false;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if not found then raise exception 'Partida não encontrada'; end if;
  v_is_admin := v_game.created_by=auth.uid()
    or (v_game.group_id is not null and public.is_group_admin(v_game.group_id));
  if p_user_id<>auth.uid() and not v_is_admin then raise exception 'Sem permissão para remover outro jogador'; end if;

  if exists(select 1 from public.game_waitlist where game_id=p_game_id and user_id=p_user_id) then
    delete from public.game_waitlist where game_id=p_game_id and user_id=p_user_id;
    return 'waitlist_removed';
  end if;

  v_completed := v_game.score_a is not null or v_game.score_b is not null;

  select coalesce(participation_penalty_enabled,true),
         coalesce(participation_penalty_hours,24),
         coalesce(participation_penalty_payment_enabled,true),
         coalesce(participation_penalty_payment_mode,'caixa')
    into v_penalty_enabled,v_penalty_hours,v_payment_enabled,v_payment_mode
    from public.groups where id=v_game.group_id;

  if exists(select 1 from public.game_confirmations where game_id=p_game_id and user_id=p_user_id)
     and v_game.group_id is not null
     and v_penalty_enabled
     and public.game_start_at(v_game)-now() <= make_interval(hours => v_penalty_hours)
     and coalesce((select participation_penalty_unpaid_games from public.groups where id=v_game.group_id),2) > 0
     and v_payment_enabled
     and not exists(
       select 1 from public.game_participation_penalties p
       where p.group_id=v_game.group_id and p.user_id=p_user_id
         and p.canceled_game_id=p_game_id and p.released_at is null
     ) then
    select count(*) into v_paying_count
      from public.game_confirmations gc
      join public.profiles pr on pr.id=gc.user_id
     where gc.game_id=p_game_id
       and (v_game.goalkeeper_pays=true or not ('goleiro'=any(coalesce(pr.positions,'{}'::text[]))));
    v_charge := case when v_paying_count > 0 then round(coalesce(v_game.cost,0)/v_paying_count,2) else 0 end;
    insert into public.game_participation_penalties(
      group_id,user_id,canceled_game_id,reason,charge_amount,payment_mode,included_in_rateio
    ) values(
      v_game.group_id,p_user_id,p_game_id,
      case when p_user_id=auth.uid() then 'late_cancellation' else 'late_admin_removal' end,
      v_charge,v_payment_mode,v_payment_mode='rateio'
    ) returning id into v_penalty_id;
  end if;

  select * into v_draw
    from public.game_draw_history
   where game_id=p_game_id and is_valid=true
   order by draw_number desc
   limit 1
   for update;
  v_had_draw := found;

  delete from public.game_confirmations where game_id=p_game_id and user_id=p_user_id;
  if not found then return 'not_found'; end if;

  if not v_completed and v_had_draw then
    v_capacity:=greatest(1,coalesce(v_game.players_per_team,5)+coalesce(v_game.reserves_per_team,0))*2;
    select count(*) into v_confirmed from public.game_confirmations where game_id=p_game_id;

    if v_confirmed<v_capacity then
      select w.user_id into v_promote
        from public.game_waitlist w
       where w.game_id=p_game_id
       order by w.queued_at,w.id
       limit 1;
      if v_promote is not null then
        insert into public.game_confirmations(game_id,user_id)
        values(p_game_id,v_promote)
        on conflict do nothing;
        if found then
          delete from public.game_waitlist where game_id=p_game_id and user_id=v_promote;
          v_replacement_done := true;
        else
          v_promote := null;
        end if;
      end if;
    end if;

    v_team_a := coalesce(array(select jsonb_array_elements_text(v_draw.team_a_starters)::uuid),'{}');
    v_team_b := coalesce(array(select jsonb_array_elements_text(v_draw.team_b_starters)::uuid),'{}');
    v_team_a_reserves := coalesce(array(select jsonb_array_elements_text(v_draw.team_a_reserves)::uuid),'{}');
    v_team_b_reserves := coalesce(array(select jsonb_array_elements_text(v_draw.team_b_reserves)::uuid),'{}');

    if v_replacement_done then
      if p_user_id = any(v_team_a) then v_team_a := array_replace(v_team_a,p_user_id,v_promote);
      elsif p_user_id = any(v_team_b) then v_team_b := array_replace(v_team_b,p_user_id,v_promote);
      elsif p_user_id = any(v_team_a_reserves) then v_team_a_reserves := array_replace(v_team_a_reserves,p_user_id,v_promote);
      elsif p_user_id = any(v_team_b_reserves) then v_team_b_reserves := array_replace(v_team_b_reserves,p_user_id,v_promote);
      else v_replacement_done := false;
      end if;
    end if;

    if not v_replacement_done then
      v_team_a := array_remove(v_team_a,p_user_id);
      v_team_b := array_remove(v_team_b,p_user_id);
      v_team_a_reserves := array_remove(v_team_a_reserves,p_user_id);
      v_team_b_reserves := array_remove(v_team_b_reserves,p_user_id);
    end if;

    update public.game_draw_history
       set team_a_starters=to_jsonb(v_team_a),
           team_b_starters=to_jsonb(v_team_b),
           team_a_reserves=to_jsonb(v_team_a_reserves),
           team_b_reserves=to_jsonb(v_team_b_reserves),
           is_valid=true
     where id=v_draw.id;

    delete from public.game_teams where game_id=p_game_id;
    insert into public.game_teams(game_id,user_id,team,role)
      select p_game_id,x,'A','starter' from unnest(v_team_a) x;
    insert into public.game_teams(game_id,user_id,team,role)
      select p_game_id,x,'B','starter' from unnest(v_team_b) x;
    insert into public.game_teams(game_id,user_id,team,role)
      select p_game_id,x,'A','reserve' from unnest(v_team_a_reserves) x;
    insert into public.game_teams(game_id,user_id,team,role)
      select p_game_id,x,'B','reserve' from unnest(v_team_b_reserves) x;

    if v_replacement_done then return 'confirmed_removed_replaced_in_draw'; end if;
    return 'confirmed_removed_draw_preserved';
  end if;

  if not v_completed then
    update public.game_draw_history set is_valid=false where game_id=p_game_id and is_valid=true;
    delete from public.game_teams where game_id=p_game_id;
  end if;

  return case when v_had_draw and not v_completed then 'confirmed_removed_draw_invalidated' else 'confirmed_removed' end;
end;
$function$;

revoke all on function public.remove_game_participant_and_promote(uuid, uuid) from public, anon;
grant execute on function public.remove_game_participant_and_promote(uuid, uuid) to authenticated;