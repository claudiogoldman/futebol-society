-- Functional rule: every participant with a financial record must be confirmed in the game.
-- If a payment is created/retargeted for an unconfirmed user, the user is added
-- to the game automatically. Game capacity remains enforced by the confirmation
-- capacity trigger.

CREATE OR REPLACE FUNCTION public.ensure_payment_participant_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.games WHERE id = NEW.game_id
  ) THEN
    RAISE EXCEPTION 'Partida não encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.game_confirmations gc
    WHERE gc.game_id = NEW.game_id
      AND gc.user_id = NEW.user_id
  ) THEN
    INSERT INTO public.game_confirmations (game_id, user_id)
    VALUES (NEW.game_id, NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_payment_participant_confirmation ON public.payments;
CREATE TRIGGER trg_ensure_payment_participant_confirmation
BEFORE INSERT OR UPDATE OF game_id, user_id ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.ensure_payment_participant_confirmation();

REVOKE ALL ON FUNCTION public.ensure_payment_participant_confirmation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_payment_participant_confirmation() FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_payment_participant_confirmation() TO authenticated;
