-- Allow the organizer/admin to remove a saved draw before the match is finished.
-- If the removed draw is the valid draw, clear the live teams and leave all
-- remaining historical draws invalid until the organizer explicitly selects one.

create or replace function public.delete_game_draw(
  p_game_id uuid,
  p_draw_id bigint
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_game public.games%rowtype;
  v_draw public.game_draw_history%rowtype;
  v_is_admin boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if v_game.score_a is not null or v_game.score_b is not null then raise exception 'GAME_FINISHED'; end if;
  v_is_admin := v_game.organizer_id = v_uid
    or exists (select 1 from public.profiles p where p.id = v_uid and p.is_admin = true);
  if not v_is_admin then raise exception 'FORBIDDEN'; end if;
  select * into v_draw from public.game_draw_history
  where id = p_draw_id and game_id = p_game_id for update;
  if not found then raise exception 'DRAW_NOT_FOUND'; end if;
  if v_draw.is_valid then delete from public.game_teams where game_id = p_game_id; end if;
  delete from public.game_draw_history where id = p_draw_id and game_id = p_game_id;
  return p_draw_id;
end;
$function$;

revoke execute on function public.delete_game_draw(uuid, bigint) from public;
revoke execute on function public.delete_game_draw(uuid, bigint) from anon;
grant execute on function public.delete_game_draw(uuid, bigint) to authenticated;
