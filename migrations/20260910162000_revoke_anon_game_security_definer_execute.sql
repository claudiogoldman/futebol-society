-- Game SECURITY DEFINER RPCs must never be callable by anonymous users.
-- Authenticated execution remains available because the functions enforce
-- authorization internally using auth.uid() and group/game roles.
revoke execute on function public.join_game_participant(uuid, uuid) from anon;
revoke execute on function public.remove_game_participant_and_promote(uuid, uuid) from anon;
revoke execute on function public.set_game_teams(uuid, uuid[], uuid[], uuid[], uuid[]) from anon;
