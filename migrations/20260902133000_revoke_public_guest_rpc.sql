-- Security hardening: add_game_guest is an authenticated application RPC.
-- It must not be callable by anonymous/public roles.
revoke execute on function public.add_game_guest(uuid, text, text, text, text[]) from public;
revoke execute on function public.add_game_guest(uuid, text, text, text, text[]) from anon;
grant execute on function public.add_game_guest(uuid, text, text, text, text[]) to authenticated;
