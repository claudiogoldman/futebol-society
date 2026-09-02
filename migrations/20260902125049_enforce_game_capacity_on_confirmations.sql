CREATE OR REPLACE FUNCTION public.enforce_game_confirmation_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_max_players integer;
  v_count integer;
begin
  select max_players into v_max_players from public.games where id = new.game_id for update;
  if not found then raise exception 'Partida não encontrada'; end if;

  if v_max_players is not null then
    select count(*) into v_count from public.game_confirmations where game_id = new.game_id;
    if v_count >= v_max_players then raise exception 'Partida lotada'; end if;
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_game_confirmation_capacity ON public.game_confirmations;
CREATE TRIGGER trg_enforce_game_confirmation_capacity
BEFORE INSERT ON public.game_confirmations
FOR EACH ROW EXECUTE FUNCTION public.enforce_game_confirmation_capacity();

REVOKE ALL ON FUNCTION public.enforce_game_confirmation_capacity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_game_confirmation_capacity() FROM anon;
GRANT EXECUTE ON FUNCTION public.enforce_game_confirmation_capacity() TO authenticated;
