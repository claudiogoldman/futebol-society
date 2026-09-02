-- Prevent a regular participant from retargeting historical/financial/rating records
-- to another game or another participant through UPDATE. This preserves the
-- existing management permissions for game/group admins and owners.

CREATE OR REPLACE FUNCTION public.prevent_non_admin_cross_game_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_game_id uuid;
  v_group_id uuid;
  v_can_manage boolean := false;
BEGIN
  v_game_id := COALESCE(OLD.game_id, NEW.game_id);
  SELECT g.group_id INTO v_group_id FROM public.games g WHERE g.id = v_game_id;

  IF v_group_id IS NOT NULL THEN
    v_can_manage := public.is_group_admin(v_group_id);
  END IF;

  IF TG_TABLE_NAME = 'ratings' THEN
    IF OLD.rater_id = auth.uid() AND NOT v_can_manage THEN
      IF NEW.game_id IS DISTINCT FROM OLD.game_id
         OR NEW.rater_id IS DISTINCT FROM OLD.rater_id
         OR NEW.rated_id IS DISTINCT FROM OLD.rated_id THEN
        RAISE EXCEPTION 'Participante não pode alterar o vínculo da avaliação com a partida ou jogador';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME IN ('goals', 'payments') THEN
    IF OLD.user_id = auth.uid() AND NOT v_can_manage THEN
      IF NEW.game_id IS DISTINCT FROM OLD.game_id
         OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'Participante não pode alterar o vínculo do registro com a partida ou jogador';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_non_admin_rating_cross_game ON public.ratings;
CREATE TRIGGER trg_prevent_non_admin_rating_cross_game
BEFORE UPDATE OF game_id, rater_id, rated_id ON public.ratings
FOR EACH ROW EXECUTE FUNCTION public.prevent_non_admin_cross_game_mutation();

DROP TRIGGER IF EXISTS trg_prevent_non_admin_goal_cross_game ON public.goals;
CREATE TRIGGER trg_prevent_non_admin_goal_cross_game
BEFORE UPDATE OF game_id, user_id ON public.goals
FOR EACH ROW EXECUTE FUNCTION public.prevent_non_admin_cross_game_mutation();

DROP TRIGGER IF EXISTS trg_prevent_non_admin_payment_cross_game ON public.payments;
CREATE TRIGGER trg_prevent_non_admin_payment_cross_game
BEFORE UPDATE OF game_id, user_id ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.prevent_non_admin_cross_game_mutation();

REVOKE ALL ON FUNCTION public.prevent_non_admin_cross_game_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_non_admin_cross_game_mutation() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_non_admin_cross_game_mutation() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_non_admin_cross_game_mutation() TO postgres, service_role;
