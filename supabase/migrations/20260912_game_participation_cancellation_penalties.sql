-- Regra: cancelamento/remoção com menos de 24h bloqueia o jogador no próximo jogo do mesmo grupo.
-- O bloqueio dura exatamente um jogo e pode ser liberado por administrador geral ou administrador do grupo.

create table if not exists public.game_participation_penalties (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  canceled_game_id uuid not null references public.games(id) on delete cascade,
  reason text not null default 'late_cancellation',
  created_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references auth.users(id),
  constraint game_participation_penalties_release_pair check ((released_at is null and released_by is null) or (released_at is not null and released_by is not null))
);

create index if not exists idx_game_participation_penalties_user_group on public.game_participation_penalties(user_id, group_id, created_at desc);
create index if not exists idx_game_participation_penalties_canceled_game on public.game_participation_penalties(canceled_game_id);

alter table public.game_participation_penalties enable row level security;

drop policy if exists game_participation_penalties_select_self_or_admin on public.game_participation_penalties;
create policy game_participation_penalties_select_self_or_admin
on public.game_participation_penalties for select to authenticated
using (auth.uid() = user_id or public.is_group_admin(group_id) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create or replace function public.game_start_at(p_game public.games)
returns timestamptz
language sql stable
set search_path = public
as $$
  select ((p_game.date::text || ' ' || coalesce(nullif(g.default_time,''),'00:00') || ':00')::timestamp at time zone 'America/Sao_Paulo')
  from public.groups g
  where g.id = p_game.group_id
  union all
  select (p_game.date::timestamp at time zone 'America/Sao_Paulo')
  where p_game.group_id is null
  limit 1;
$$;

grant execute on function public.game_start_at(public.games) to authenticated;

create or replace function public.has_active_game_participation_penalty(p_game_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.game_participation_penalties p
    join public.games canceled on canceled.id = p.canceled_game_id
    where p.user_id = p_user_id
      and p.released_at is null
      and canceled.group_id is not null
      and canceled.group_id = (select g.group_id from public.games g where g.id = p_game_id)
      and p_game_id <> canceled.id
      and public.game_start_at(canceled) < public.game_start_at((select g from public.games g where g.id = p_game_id))
      and not exists (
        select 1
        from public.games between_games
        where between_games.group_id = canceled.group_id
          and public.game_start_at(between_games) > public.game_start_at(canceled)
          and public.game_start_at(between_games) < public.game_start_at((select g from public.games g where g.id = p_game_id))
      )
  );
$$;

grant execute on function public.has_active_game_participation_penalty(uuid, uuid) to authenticated;

create or replace function public.release_game_participation_penalty(p_penalty_id uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_is_admin boolean;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  select group_id into v_group_id from public.game_participation_penalties where id = p_penalty_id for update;
  if not found then raise exception 'Bloqueio não encontrado'; end if;
  v_is_admin := exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true) or public.is_group_admin(v_group_id);
  if not v_is_admin then raise exception 'Sem permissão para liberar este bloqueio'; end if;
  update public.game_participation_penalties set released_at = now(), released_by = auth.uid() where id = p_penalty_id;
  return 'released';
end;
$$;

grant execute on function public.release_game_participation_penalty(uuid) to authenticated;

create or replace function public.join_game_participant(p_game_id uuid, p_user_id uuid default auth.uid())
returns text language plpgsql security definer set search_path = public as $$
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
  if v_game.group_id is not null and public.has_active_game_participation_penalty(p_game_id, p_user_id) then raise exception 'PARTICIPATION_BLOCKED: Participação bloqueada neste jogo por cancelamento ou remoção com menos de 24 horas de antecedência. A participação será liberada no jogo seguinte, ou antes por um administrador.'; end if;
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

grant execute on function public.join_game_participant(uuid,uuid) to authenticated;

create or replace function public.remove_game_participant_and_promote(p_game_id uuid, p_user_id uuid default auth.uid())
returns text language plpgsql security definer set search_path = public as $$
declare
  v_game public.games%rowtype;
  v_is_admin boolean;
  v_capacity integer;
  v_confirmed integer;
  v_promote uuid;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'Partida não encontrada'; end if;
  v_is_admin := v_game.created_by = auth.uid() or (v_game.group_id is not null and public.is_group_admin(v_game.group_id));
  if p_user_id <> auth.uid() and not v_is_admin then raise exception 'Sem permissão para remover outro jogador'; end if;
  if exists (select 1 from public.game_waitlist where game_id=p_game_id and user_id=p_user_id) then
    delete from public.game_waitlist where game_id=p_game_id and user_id=p_user_id;
    return 'waitlist_removed';
  end if;
  if exists (select 1 from public.game_confirmations where game_id=p_game_id and user_id=p_user_id)
     and v_game.group_id is not null
     and public.game_start_at(v_game) > now()
     and public.game_start_at(v_game) - now() < interval '24 hours'
     and not exists (select 1 from public.game_participation_penalties p where p.group_id=v_game.group_id and p.user_id=p_user_id and p.canceled_game_id=p_game_id and p.released_at is null)
  then
    insert into public.game_participation_penalties(group_id,user_id,canceled_game_id,reason)
    values (v_game.group_id,p_user_id,p_game_id,case when p_user_id=auth.uid() then 'late_cancellation' else 'late_admin_removal' end);
  end if;
  delete from public.game_confirmations where game_id=p_game_id and user_id=p_user_id;
  if not found then return 'not_found'; end if;
  v_capacity := greatest(1, coalesce(v_game.players_per_team, 5) + coalesce(v_game.reserves_per_team, 0)) * 2;
  select count(*) into v_confirmed from public.game_confirmations where game_id=p_game_id;
  if v_confirmed < v_capacity then
    select w.user_id into v_promote from public.game_waitlist w where w.game_id=p_game_id order by w.queued_at asc, w.id asc limit 1;
    if v_promote is not null then
      insert into public.game_confirmations(game_id,user_id) values (p_game_id,v_promote) on conflict do nothing;
      delete from public.game_waitlist where game_id=p_game_id and user_id=v_promote;
      return 'confirmed_removed_promoted';
    end if;
  end if;
  return 'confirmed_removed';
end;
$$;

grant execute on function public.remove_game_participant_and_promote(uuid,uuid) to authenticated;
