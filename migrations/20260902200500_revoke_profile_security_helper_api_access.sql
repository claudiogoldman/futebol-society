-- These helpers are used internally by the profile trigger only.
-- They do not need to be exposed as client-callable RPCs.
revoke all on function public.is_global_admin() from anon, authenticated, public;
revoke all on function public.prevent_profile_admin_self_escalation() from anon, authenticated, public;
