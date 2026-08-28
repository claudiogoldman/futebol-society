-- Group image changes are normal group updates and must be allowed to the
-- original owner and delegated group administrators.
-- Use direct ownership/membership checks to avoid helper-function/RLS coupling.

drop policy if exists groups_update_admin on public.groups;
drop policy if exists groups_update_owner_or_admin on public.groups;

create policy groups_update_owner_or_admin on public.groups
for update to authenticated
using (
  created_by = (select auth.uid())
  or exists (
    select 1
    from public.group_members gm
    where gm.group_id = groups.id
      and gm.user_id = (select auth.uid())
      and gm.role = 'admin'
  )
)
with check (
  created_by = (select auth.uid())
  or exists (
    select 1
    from public.group_members gm
    where gm.group_id = groups.id
      and gm.user_id = (select auth.uid())
      and gm.role = 'admin'
  )
);