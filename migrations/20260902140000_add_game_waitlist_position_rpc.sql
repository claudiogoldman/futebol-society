CREATE OR REPLACE FUNCTION public.get_game_waitlist_position(p_game_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_queued_at timestamptz;
  v_position integer;
begin
  if auth.uid() is null then
    return null;
  end if;

  select w.id, w.queued_at
    into v_id, v_queued_at
  from public.game_waitlist w
  where w.game_id = p_game_id
    and w.user_id = auth.uid()
  order by w.queued_at, w.id
  limit 1;

  if not found then
    return null;
  end if;

  select count(*)::integer
    into v_position
  from public.game_waitlist w
  where w.game_id = p_game_id
    and (w.queued_at < v_queued_at or (w.queued_at = v_queued_at and w.id <= v_id));

  return v_position;
end;
$function$;

REVOKE ALL ON FUNCTION public.get_game_waitlist_position(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_game_waitlist_position(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_game_waitlist_position(uuid) TO authenticated;
