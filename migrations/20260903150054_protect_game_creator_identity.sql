-- Integrity rule: game creator identity is immutable through the generic games UPDATE policy.
-- Ownership transfer is not exposed as a documented application operation.

CREATE OR REPLACE FUNCTION public.prevent_game_creator_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'O criador da partida não pode ser alterado diretamente';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_game_creator_change ON public.games;
CREATE TRIGGER trg_prevent_game_creator_change
BEFORE UPDATE OF created_by ON public.games
FOR EACH ROW
EXECUTE FUNCTION public.prevent_game_creator_change();

REVOKE ALL ON FUNCTION public.prevent_game_creator_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_game_creator_change() FROM anon;
GRANT EXECUTE ON FUNCTION public.prevent_game_creator_change() TO authenticated;
