-- SECURITY DEFINER game RPCs are application APIs for signed-in users.
-- Remove the default PUBLIC/anon execution grant and explicitly allow the
-- authenticated role. Authorization remains enforced inside each function.
revoke execute on function public.join_game_participant(uuid, uuid) from public, anon;
revoke execute on function public.remove_game_participant_and_promote(uuid, uuid) from public, anon;
revoke execute on function public.set_game_teams(uuid, uuid[], uuid[], uuid[], uuid[]) from public, anon;

grant execute on function public.join_game_participant(uuid, uuid) to authenticated;
grant execute on function public.remove_game_participant_and_promote(uuid, uuid) to authenticated;
grant execute on function public.set_game_teams(uuid, uuid[], uuid[], uuid[], uuid[]) to authenticated;
