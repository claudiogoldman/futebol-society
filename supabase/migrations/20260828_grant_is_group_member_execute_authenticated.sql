-- The client uses is_group_member() from authenticated RLS policies/functions.
-- Keep EXECUTE explicitly granted because function privileges are not represented by RLS alone.
grant execute on function public.is_group_member(uuid) to authenticated;
