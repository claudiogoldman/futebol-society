-- Configuração da penalidade por grupo.
-- Cada grupo define se a regra está ativa, quantas horas antes do jogo
-- caracterizam cancelamento tardio e quantos jogos ficam bloqueados.

alter table public.groups
  add column if not exists participation_penalty_enabled boolean not null default true;

alter table public.groups
  add column if not exists participation_penalty_hours integer not null default 24;

alter table public.groups
  add column if not exists participation_penalty_games integer not null default 1;

alter table public.groups drop constraint if exists groups_participation_penalty_hours_check;
alter table public.groups
  add constraint groups_participation_penalty_hours_check
  check (participation_penalty_hours >= 0 and participation_penalty_hours <= 168);

alter table public.groups drop constraint if exists groups_participation_penalty_games_check;
alter table public.groups
  add constraint groups_participation_penalty_games_check
  check (participation_penalty_games >= 0 and participation_penalty_games <= 10);

create or replace function public.has_active_game_participation_penalty(p_game_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.game_participation_penalties p
    join public.games canceled on canceled.id = p.canceled_game_id
    join public.groups cg on cg.id = canceled.group_id
    where p.user_id = p_user_id
      and p.released_at is null
      and canceled.group_id is not null
      and canceled.group_id = (select g.group_id from public.games g where g.id = p_game_id)
      and p_game_id <> canceled.id
      and cg.participation_penalty_enabled = true
      and cg.participation_penalty_games > 0
      and public.game_start_at(canceled) < public.game_start_at((select g from public.games g where g.id = p_game_id))
      and (
        select count(*)
        from public.games between_games
        where between_games.group_id = canceled.group_id
          and public.game_start_at(between_games) > public.game_start_at(canceled)
          and public.game_start_at(between_games) < public.game_start_at((select g from public.games g where g.id = p_game_id))
      ) < cg.participation_penalty_games
  );
$$;

create or replace function public.join_game_participant(p_game_id uuid, p_user_id uuid default auth.uid())
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games%rowtype;
  v_confirmed integer;
  v_capacity integer;
  v_is_admin boolean;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'Partida não encontrada'; end if;
  if v_game.score_a is not null or v_game.score_b is not null then raise exception 'Partida encerrada'; end if;
  v_is_admin := v_game.created_by = auth.uid() or (v_game.group_id is not null and public.is_group_admin(v_game.group_id));
  if p_user_id <> auth.uid() and not v_is_admin then raise exception 'Sem permissão para adicionar outro jogador'; end if;
  if v_game.group_id is not null and not exists (select 1 from public.group_members gm where gm.group_id = v_game.group_id and gm.user_id = p_user_id) and p_user_id <> v_game.created_by then raise exception 'O jogador precisa pertencer ao grupo da partida'; end if;
  if v_game.group_id is not null and public.has_active_game_participation_penalty(p_game_id, p_user_id) then
    raise exception 'PARTICIPATION_BLOCKED: Participação bloqueada neste jogo por cancelamento ou remoção dentro do prazo de penalidade. A participação será liberada após o número de jogos configurado pelo grupo, ou antes por um administrador.';
  end if;
  if exists (select 1 from public.game_confirmations where game_id = p_game_id and user_id = p_user_id) then return 'confirmed'; end if;
  if exists (select 1 from public.game_waitlist where game_id = p_game_id and user_id = p_user_id) then return 'waitlist'; end if;
  v_capacity := greatest(1, coalesce(v_game.players_per_team, 5) + coalesce(v_game.reserves_per_team, 0)) * 2;
  select count(*) into v_confirmed from public.game_confirmations where game_id = p_game_id;
  if v_confirmed < v_capacity then
    insert into public.game_confirmations(game_id,user_id) values (p_game_id,p_user_id);
    return 'confirmed';
  end if;
  insert into public.game_waitlist(game_id,user_id) values (p_game_id,p_user_id);
  return 'waitlist';
end;
$$;

create or replace function public.remove_game_participant_and_promote(p_game_id uuid, p_user_id uuid default auth.uid())
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games%rowtype;
  v_is_admin boolean;
  v_capacity integer;
  v_confirmed integer;
  v_promote uuid;
  v_had_draw boolean;
  v_group public.groups%rowtype;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if not found then raise exception 'Partida não encontrada'; end if;
  v_is_admin := v_game.created_by=auth.uid() or (v_game.group_id is not null and public.is_group_admin(v_game.group_id));
  if p_user_id<>auth.uid() and not v_is_admin then raise exception 'Sem permissão para remover outro jogador'; end if;
  if exists (select 1 from public.game_waitlist where game_id=p_game_id and user_id=p_user_id) then
    delete from public.game_waitlist where game_id=p_game_id and user_id=p_user_id;
    return 'waitlist_removed';
  end if;
  if v_game.group_id is not null then
    select * into v_group from public.groups where id=v_game.group_id;
  end if;
  if exists (select 1 from public.game_confirmations where game_id=p_game_id and user_id=p_user_id)
     and v_game.group_id is not null
     and public.game_start_at(v_game)>now()
     and v_group.participation_penalty_enabled = true
     and v_group.participation_penalty_games > 0
     and public.game_start_at(v_game)-now() < make_interval(hours => v_group.participation_penalty_hours)
     and not exists (select 1 from public.game_participation_penalties p where p.group_id=v_game.group_id and p.user_id=p_user_id and p.canceled_game_id=p_game_id and p.released_at is null)
  then
    insert into public.game_participation_penalties(group_id,user_id,canceled_game_id,reason)
    values(v_game.group_id,p_user_id,p_game_id,case when p_user_id=auth.uid() then 'late_cancellation' else 'late_admin_removal' end);
  end if;
  v_had_draw := exists(select 1 from public.game_teams where game_id=p_game_id) or exists(select 1 from public.game_draw_history where game_id=p_game_id and is_valid=true);
  delete from public.game_confirmations where game_id=p_game_id and user_id=p_user_id;
  if not found then return 'not_found'; end if;
  if v_had_draw then
    delete from public.game_teams where game_id=p_game_id;
    update public.game_draw_history set is_valid=false where game_id=p_game_id and is_valid=true;
  end if;
  v_capacity:=greatest(1,coalesce(v_game.players_per_team,5)+coalesce(v_game.reserves_per_team,0))*2;
  select count(*) into v_confirmed from public.game_confirmations where game_id=p_game_id;
  if v_confirmed<v_capacity then
    select w.user_id into v_promote from public.game_waitlist w where w.game_id=p_game_id order by w.queued_at asc,w.id asc limit 1;
    if v_promote is not null then
      insert into public.game_confirmations(game_id,user_id) values(p_game_id,v_promote) on conflict do nothing;
      delete from public.game_waitlist where game_id=p_game_id and user_id=v_promote;
      return case when v_had_draw then 'confirmed_removed_promoted_draw_invalidated' else 'confirmed_removed_promoted' end;
    end if;
  end if;
  return case when v_had_draw then 'confirmed_removed_draw_invalidated' else 'confirmed_removed' end;
end;
$$;

grant execute on function public.has_active_game_participation_penalty(uuid,uuid) to authenticated;
grant execute on function public.join_game_participant(uuid,uuid) to authenticated;
grant execute on function public.remove_game_participant_and_promote(uuid,uuid) to authenticated;
