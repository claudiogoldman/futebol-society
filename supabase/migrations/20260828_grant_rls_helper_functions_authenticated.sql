-- RLS helper functions are referenced directly by authenticated policies.
-- Explicit EXECUTE is required for the policy expressions to run.
grant execute on function public.is_game_member(uuid) to authenticated;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;
grant execute on function public.is_group_admin(uuid) to authenticated;
