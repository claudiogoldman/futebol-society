-- These functions are trigger implementations, not public RPC endpoints.
revoke execute on function public.apply_game_organizer_defaults() from public;
revoke execute on function public.ensure_single_default_group_location() from public;
