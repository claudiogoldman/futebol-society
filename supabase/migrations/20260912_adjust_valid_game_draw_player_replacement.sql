-- Ajusta um sorteio existente quando exatamente um jogador saiu e outro entrou.
-- Mantém a distribuição original e altera somente a vaga correspondente.
-- A operação é transacional e cria uma nova versão do sorteio para auditoria.

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
  v_source public.game_draw_history%rowtype;
  v_new_draw_id bigint;
  v_new_draw_number integer;
  v_team_a_starters uuid[];
  v_team_b_starters uuid[];
  v_team_a_reserves uuid[];
  v_team_b_reserves uuid[];
  v_replaced boolean := false;
begin
  if not exists (
    select 1
      from public.games g
     where g.id = p_game_id
  ) then
    raise exception 'Partida não encontrada.';
  end if;

  if p_out_user_id is null or p_in_user_id is null or p_out_user_id = p_in_user_id then
    raise exception 'Jogadores de saída e entrada devem ser diferentes.';
  end if;

  select h.*
    into v_source
    from public.game_draw_history h
   where h.game_id = p_game_id
     and not coalesce(h.is_valid, false)
   order by h.draw_number desc
   limit 1
   for update;

  if not found then
    raise exception 'Nenhum sorteio inválido disponível para ajuste.';
  end if;

  v_team_a_starters := coalesce(v_source.team_a_starters, '{}'::uuid[]);
  v_team_b_starters := coalesce(v_source.team_b_starters, '{}'::uuid[]);
  v_team_a_reserves := coalesce(v_source.team_a_reserves, '{}'::uuid[]);
  v_team_b_reserves := coalesce(v_source.team_b_reserves, '{}'::uuid[]);

  if p_out_user_id = any(v_team_a_starters) then
    v_team_a_starters := array_replace(v_team_a_starters, p_out_user_id, p_in_user_id);
    v_replaced := true;
  elsif p_out_user_id = any(v_team_b_starters) then
    v_team_b_starters := array_replace(v_team_b_starters, p_out_user_id, p_in_user_id);
    v_replaced := true;
  elsif p_out_user_id = any(v_team_a_reserves) then
    v_team_a_reserves := array_replace(v_team_a_reserves, p_out_user_id, p_in_user_id);
    v_replaced := true;
  elsif p_out_user_id = any(v_team_b_reserves) then
    v_team_b_reserves := array_replace(v_team_b_reserves, p_out_user_id, p_in_user_id);
    v_replaced := true;
  end if;

  if not v_replaced then
    raise exception 'Jogador de saída não pertence ao sorteio selecionado.';
  end if;

  if p_in_user_id = any(v_source.team_a_starters)
     or p_in_user_id = any(v_source.team_b_starters)
     or p_in_user_id = any(v_source.team_a_reserves)
     or p_in_user_id = any(v_source.team_b_reserves) then
    raise exception 'Jogador de entrada já pertence ao sorteio selecionado.';
  end if;

  if exists (
    select 1
      from public.game_participants gp
     where gp.game_id = p_game_id
       and gp.user_id = p_out_user_id
  ) then
    raise exception 'O jogador de saída ainda está vinculado à participação da partida.';
  end if;

  if not exists (
    select 1
      from public.game_participants gp
     where gp.game_id = p_game_id
       and gp.user_id = p_in_user_id
  ) then
    raise exception 'O jogador de entrada não está confirmado na partida.';
  end if;

  if not exists (
    select 1
      from public.game_draw_history h
     where h.game_id = p_game_id
       and h.id = v_source.id
       and not coalesce(h.is_valid, false)
  ) then
    raise exception 'O sorteio foi alterado por outra operação. Recarregue a partida.';
  end if;

  select coalesce(max(h.draw_number), 0) + 1
    into v_new_draw_number
    from public.game_draw_history h
   where h.game_id = p_game_id;

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
    v_new_draw_number,
    auth.uid(),
    v_source.players_per_team,
    v_source.reserves_per_team,
    v_team_a_starters,
    v_team_b_starters,
    v_team_a_reserves,
    v_team_b_reserves,
    true
  )
  returning id into v_new_draw_id;

  update public.game_draw_history
     set is_valid = false
   where game_id = p_game_id
     and id <> v_new_draw_id
     and is_valid = true;

  return v_new_draw_id;
end;
$$;

grant execute on function public.adjust_game_draw_for_player_replacement(uuid, uuid, uuid) to authenticated;
