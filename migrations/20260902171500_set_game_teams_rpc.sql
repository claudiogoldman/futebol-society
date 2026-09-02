-- Atomically replaces the teams for a game.
-- Only the game creator or group admin may change teams, and only before completion.
CREATE OR REPLACE FUNCTION public.set_game_teams(
  p_game_id uuid,
  p_team_a uuid[],
  p_team_b uuid[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_game public.games;
  v_ids uuid[];
  v_confirmed_count integer;
  v_distinct_count integer;
  v_admin boolean;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'Partida não encontrada'; end if;

  v_admin := (v_game.created_by = auth.uid())
    OR (v_game.group_id IS NOT NULL AND public.is_group_admin(v_game.group_id));
  if not v_admin then raise exception 'Somente organizador ou administrador pode definir os times'; end if;
  if v_game.score_a is not null or v_game.score_b is not null then raise exception 'Partida encerrada'; end if;
  if coalesce(array_length(p_team_a, 1), 0) = 0 or coalesce(array_length(p_team_b, 1), 0) = 0 then
    raise exception 'Os dois times precisam ter jogadores';
  end if;

  v_ids := coalesce(p_team_a, '{}'::uuid[]) || coalesce(p_team_b, '{}'::uuid[]);
  select count(*) into v_distinct_count from (select distinct unnest(v_ids)) x;
  if v_distinct_count <> coalesce(array_length(v_ids, 1), 0) then
    raise exception 'Um jogador não pode estar nos dois times';
  end if;

  select count(*) into v_confirmed_count
  from public.game_confirmations c
  where c.game_id = p_game_id and c.user_id = any(v_ids);
  if v_confirmed_count <> coalesce(array_length(v_ids, 1), 0) then
    raise exception 'Todos os jogadores dos times precisam estar confirmados na partida';
  end if;

  delete from public.game_teams where game_id = p_game_id;
  insert into public.game_teams (game_id, user_id, team)
  select p_game_id, x, 'A' from unnest(p_team_a) x;
  insert into public.game_teams (game_id, user_id, team)
  select p_game_id, x, 'B' from unnest(p_team_b) x;

  return true;
end;
$function$;

REVOKE ALL ON FUNCTION public.set_game_teams(uuid, uuid[], uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_game_teams(uuid, uuid[], uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_game_teams(uuid, uuid[], uuid[]) TO authenticated;
