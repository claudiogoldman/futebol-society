create or replace function public.set_game_payment_status(p_game_id uuid,p_user_id uuid,p_paid boolean) returns boolean language plpgsql security definer set search_path=public as $$
declare v_game public.games%rowtype; v_allowed boolean;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into v_game from public.games where id=p_game_id;
 if not found then raise exception 'GAME_NOT_FOUND'; end if;
 v_allowed:=auth.uid()=p_user_id or v_game.created_by=auth.uid() or v_game.pix_owner_id=auth.uid() or (v_game.group_id is not null and public.is_group_admin(v_game.group_id));
 if not v_allowed then raise exception 'FORBIDDEN_PAYMENT_UPDATE'; end if;
 if p_paid then
   insert into public.payments(game_id,user_id,paid) values(p_game_id,p_user_id,true)
   on conflict(game_id,user_id) do update set paid=excluded.paid;
 else
   delete from public.payments where game_id=p_game_id and user_id=p_user_id;
 end if;
 return p_paid;
end; $$;
revoke execute on function public.set_game_payment_status(uuid,uuid,boolean) from public;
revoke execute on function public.set_game_payment_status(uuid,uuid,boolean) from anon;
grant execute on function public.set_game_payment_status(uuid,uuid,boolean) to authenticated;

create or replace function public.join_game_participant(p_game_id uuid,p_user_id uuid default auth.uid())
returns text language plpgsql security definer set search_path=public as $$
declare v_game public.games%rowtype; v_confirmed integer; v_capacity integer; v_is_admin boolean; v_penalty_id uuid;
begin
 if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
 select * into v_game from public.games where id=p_game_id for update;
 if not found then raise exception 'Partida não encontrada'; end if;
 if v_game.score_a is not null or v_game.score_b is not null then raise exception 'Partida encerrada'; end if;
 v_is_admin:=v_game.created_by=auth.uid() or (v_game.group_id is not null and public.is_group_admin(v_game.group_id));
 if p_user_id<>auth.uid() and not v_is_admin then raise exception 'Sem permissão para adicionar outro jogador'; end if;
 if v_game.group_id is not null and not exists(select 1 from public.group_members gm where gm.group_id=v_game.group_id and gm.user_id=p_user_id) and p_user_id<>v_game.created_by then raise exception 'O jogador precisa pertencer ao grupo da partida'; end if;
 if v_game.group_id is not null and public.has_active_game_participation_penalty(p_game_id,p_user_id) then raise exception 'PARTICIPATION_BLOCKED: Participação bloqueada neste jogo por cancelamento ou remoção dentro do prazo de penalidade.'; end if;
 select p.id into v_penalty_id from public.game_participation_penalties p
 where p.user_id=p_user_id and p.group_id=v_game.group_id and p.released_at is null and p_game_id<>p.canceled_game_id
 and not exists(select 1 from public.games between_games
   where between_games.group_id=v_game.group_id
   and public.game_start_at(between_games)>public.game_start_at((select cg from public.games cg where cg.id=p.canceled_game_id))
   and public.game_start_at(between_games)<public.game_start_at(v_game))
 order by p.created_at desc limit 1;
 if v_penalty_id is not null then
   update public.game_participation_penalties set released_at=now(),released_by=auth.uid() where id=v_penalty_id;
 end if;
 if exists(select 1 from public.game_confirmations where game_id=p_game_id and user_id=p_user_id) then return 'confirmed'; end if;
 if exists(select 1 from public.game_waitlist where game_id=p_game_id and user_id=p_user_id) then return 'waitlist'; end if;
 v_capacity:=greatest(1,coalesce(v_game.players_per_team,5)+coalesce(v_game.reserves_per_team,0))*2;
 select count(*) into v_confirmed from public.game_confirmations where game_id=p_game_id;
 if v_confirmed<v_capacity then
   insert into public.game_confirmations(game_id,user_id) values(p_game_id,p_user_id);
   return 'confirmed';
 end if;
 insert into public.game_waitlist(game_id,user_id) values(p_game_id,p_user_id);
 return 'waitlist';
end; $$;
grant execute on function public.join_game_participant(uuid,uuid) to authenticated;
