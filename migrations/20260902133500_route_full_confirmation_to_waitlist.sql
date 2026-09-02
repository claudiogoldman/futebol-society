-- Keep the existing direct RSVP UI compatible with the persistent waitlist.
-- A non-admin confirming a full open game is routed to FIFO waitlist.

CREATE OR REPLACE FUNCTION public.route_full_confirmation_to_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_game public.games;
  v_count integer;
  v_is_admin boolean := false;
begin
  select * into v_game from public.games where id = new.game_id for update;
  if not found then raise exception 'Partida não encontrada'; end if;
  if v_game.score_a is not null or v_game.score_b is not null then return new; end if;
  if v_game.max_players is null then return new; end if;
  if auth.uid() is not null then
    v_is_admin := v_game.created_by = auth.uid()
      or (v_game.group_id is not null and public.is_group_admin(v_game.group_id));
  end if;
  if auth.uid() = new.user_id and not v_is_admin then
    select count(*) into v_count from public.game_confirmations where game_id = new.game_id;
    if v_count >= v_game.max_players then
      insert into public.game_waitlist(game_id, user_id)
      values (new.game_id, new.user_id)
      on conflict (game_id, user_id) do nothing;
      return null;
    end if;
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_a_route_full_confirmation_to_waitlist ON public.game_confirmations;
CREATE TRIGGER trg_a_route_full_confirmation_to_waitlist
BEFORE INSERT ON public.game_confirmations
FOR EACH ROW EXECUTE FUNCTION public.route_full_confirmation_to_waitlist();

REVOKE ALL ON FUNCTION public.route_full_confirmation_to_waitlist() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.route_full_confirmation_to_waitlist() FROM anon;
REVOKE ALL ON FUNCTION public.route_full_confirmation_to_waitlist() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.route_full_confirmation_to_waitlist() TO postgres, service_role;

DROP POLICY IF EXISTS games_select_member ON public.games;
CREATE POLICY games_select_member ON public.games FOR SELECT
USING (
  is_game_member(id)
  OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.game_waitlist w WHERE w.game_id = games.id AND w.user_id = auth.uid())
);
