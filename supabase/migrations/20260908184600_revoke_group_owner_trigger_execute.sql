-- This trigger function is invoked by PostgreSQL as a trigger and is not a public RPC.
REVOKE EXECUTE ON FUNCTION public.prevent_group_owner_change() FROM PUBLIC;
