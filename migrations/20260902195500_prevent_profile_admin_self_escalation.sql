-- Prevent a normal user from promoting themselves to global admin.
-- Existing global administrators retain the ability to manage is_admin.

create or replace function public.is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  );
$$;

revoke all on function public.is_global_admin() from public;
grant execute on function public.is_global_admin() to authenticated;

create or replace function public.prevent_profile_admin_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin
     and not public.is_global_admin() then
    raise exception 'Only an existing global administrator can change is_admin';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_profile_admin_self_escalation() from public;
grant execute on function public.prevent_profile_admin_self_escalation() to authenticated;

drop trigger if exists trg_prevent_profile_admin_self_escalation on public.profiles;
create trigger trg_prevent_profile_admin_self_escalation
before update of is_admin on public.profiles
for each row
execute function public.prevent_profile_admin_self_escalation();
