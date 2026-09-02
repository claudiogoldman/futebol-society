-- Make team persistence atomic and allow group admins to remanage teams after closure.
DROP FUNCTION IF EXISTS public.set_game_teams(uuid, uuid[], uuid[]);

CREATE FUNCTION public.set_game_teams(
  p_game_id uuid,
  p_team_a uuid[],
  p_team_b uuid[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_game public.games%ROWTYPE;
  v_is_admin boolean;
  v_all_ids uuid[];
  v_distinct_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_game
  FROM public.games
  WHERE id = p_game_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partida não encontrada';
  END IF;

  v_is_admin := v_game.group_id IS NOT NULL AND public.is_group_admin(v_game.group_id);

  IF NOT (v_game.created_by = auth.uid() OR v_is_admin) THEN
    RAISE EXCEPTION 'Somente organizador ou administrador pode definir os times';
  END IF;

  IF (v_game.score_a IS NOT NULL OR v_game.score_b IS NOT NULL) AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Após o encerramento, somente administradores podem alterar os times';
  END IF;

  IF COALESCE(cardinality(p_team_a), 0) = 0 OR COALESCE(cardinality(p_team_b), 0) = 0 THEN
    RAISE EXCEPTION 'Os dois times precisam ter jogadores';
  END IF;

  v_all_ids := COALESCE(p_team_a, ARRAY[]::uuid[]) || COALESCE(p_team_b, ARRAY[]::uuid[]);
  SELECT count(*) INTO v_distinct_count FROM (SELECT DISTINCT unnest(v_all_ids)) x;
  IF v_distinct_count <> cardinality(v_all_ids) THEN
    RAISE EXCEPTION 'Um jogador não pode estar nos dois times';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_all_ids) AS x
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.game_confirmations c
      WHERE c.game_id = p_game_id AND c.user_id = x
    )
  ) THEN
    RAISE EXCEPTION 'Todos os jogadores dos times precisam estar confirmados na partida';
  END IF;

  DELETE FROM public.game_teams WHERE game_id = p_game_id;

  INSERT INTO public.game_teams (game_id, user_id, team)
  SELECT p_game_id, x, 'A' FROM unnest(p_team_a) x;

  INSERT INTO public.game_teams (game_id, user_id, team)
  SELECT p_game_id, x, 'B' FROM unnest(p_team_b) x;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_game_teams(uuid, uuid[], uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_game_teams(uuid, uuid[], uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_game_teams(uuid, uuid[], uuid[]) TO authenticated;
