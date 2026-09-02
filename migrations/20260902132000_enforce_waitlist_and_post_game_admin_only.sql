-- Persistent game waitlist / substitutes.
-- Full games put new joiners into FIFO waitlist; a released slot automatically
-- promotes the first eligible waitlisted player before the game is completed.

CREATE TABLE IF NOT EXISTS public.game_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  queued_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_waitlist_game_user_key UNIQUE (game_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_game_waitlist_game_queued
  ON public.game_waitlist (game_id, queued_at, id);

ALTER TABLE public.game_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_waitlist_select_own_or_admin ON public.game_waitlist;
CREATE POLICY game_waitlist_select_own_or_admin ON public.game_waitlist FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = game_waitlist.game_id
      AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
  )
);

DROP POLICY IF EXISTS game_waitlist_insert_self_or_admin ON public.game_waitlist;
DROP POLICY IF EXISTS game_waitlist_insert_admin_only ON public.game_waitlist;
CREATE POLICY game_waitlist_insert_admin_only ON public.game_waitlist FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = game_waitlist.game_id
      AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
  )
);

DROP POLICY IF EXISTS game_waitlist_delete_own_or_admin ON public.game_waitlist;
CREATE POLICY game_waitlist_delete_own_or_admin ON public.game_waitlist FOR DELETE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = game_waitlist.game_id
      AND (g.created_by = auth.uid() OR (g.group_id IS NOT NULL AND public.is_group_admin(g.group_id)))
  )
);

CREATE OR REPLACE FUNCTION public.join_game_waitlist_by_token(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_game public.games;
  v_count integer;
begin
  select * into v_game from public.games where invite_token = p_token for update;
  if not found then raise exception 'invalid invite token'; end if;
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'Perfil não encontrado'; end if;
  if v_game.score_a is not null or v_game.score_b is not null then raise exception 'Partida encerrada'; end if;
  if exists (select 1 from public.game_confirmations where game_id = v_game.id and user_id = auth.uid()) then return v_game.id; end if;

  select count(*) into v_count from public.game_confirmations where game_id = v_game.id;
  if v_game.max_players is null or v_count < v_game.max_players then
    insert into public.game_confirmations (game_id, user_id) values (v_game.id, auth.uid()) on conflict do nothing;
  else
    insert into public.game_waitlist (game_id, user_id) values (v_game.id, auth.uid()) on conflict (game_id, user_id) do nothing;
  end if;
  return v_game.id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.promote_next_game_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_game public.games;
  v_next public.game_waitlist;
  v_count integer;
begin
  select * into v_game from public.games where id = old.game_id for update;
  if not found or v_game.score_a is not null or v_game.score_b is not null or v_game.max_players is null then return old; end if;
  select count(*) into v_count from public.game_confirmations where game_id = old.game_id;
  if v_count >= v_game.max_players then return old; end if;

  select * into v_next from public.game_waitlist w
  where w.game_id = old.game_id
    and not exists (select 1 from public.game_confirmations c where c.game_id = w.game_id and c.user_id = w.user_id)
  order by w.queued_at, w.id limit 1 for update skip locked;
  if not found then return old; end if;

  insert into public.game_confirmations (game_id, user_id) values (old.game_id, v_next.user_id) on conflict do nothing;
  delete from public.game_waitlist where id = v_next.id;
  return old;
end;
$function$;

DROP TRIGGER IF EXISTS trg_promote_next_game_waitlist ON public.game_confirmations;
CREATE TRIGGER trg_promote_next_game_waitlist AFTER DELETE ON public.game_confirmations
FOR EACH ROW EXECUTE FUNCTION public.promote_next_game_waitlist();

REVOKE ALL ON FUNCTION public.join_game_waitlist_by_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_game_waitlist_by_token(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.join_game_waitlist_by_token(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.promote_next_game_waitlist() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.promote_next_game_waitlist() FROM anon;
REVOKE ALL ON FUNCTION public.promote_next_game_waitlist() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.promote_next_game_waitlist() TO postgres, service_role;

-- The normal invite join now uses the same FIFO waitlist automatically when full.
CREATE OR REPLACE FUNCTION public.join_game_by_token(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_game public.games;
  v_participants integer;
begin
  select * into v_game from public.games where invite_token = p_token for update;
  if not found then raise exception 'invalid invite token'; end if;
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'Perfil não encontrado'; end if;
  if v_game.score_a is not null or v_game.score_b is not null then raise exception 'Partida encerrada'; end if;
  if exists (select 1 from public.game_confirmations where game_id = v_game.id and user_id = auth.uid()) then return v_game.id; end if;
  if exists (select 1 from public.game_waitlist where game_id = v_game.id and user_id = auth.uid()) then return v_game.id; end if;

  select count(*) into v_participants from public.game_confirmations where game_id = v_game.id;
  if v_game.max_players is null or v_participants < v_game.max_players then
    insert into public.game_confirmations (game_id, user_id) values (v_game.id, auth.uid()) on conflict do nothing;
  else
    insert into public.game_waitlist (game_id, user_id) values (v_game.id, auth.uid()) on conflict (game_id, user_id) do nothing;
  end if;
  return v_game.id;
end;
$function$;
