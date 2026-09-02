-- Keep profile-admin security helpers inaccessible to anonymous clients.
revoke all on function public.is_global_admin() from anon, public;
grant execute on function public.is_global_admin() to authenticated;

revoke all on function public.prevent_profile_admin_self_escalation() from anon, public;
grant execute on function public.prevent_profile_admin_self_escalation() to authenticated;
