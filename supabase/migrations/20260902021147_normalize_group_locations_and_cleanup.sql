-- Keep the new reusable location model as the single source of truth.
-- Backfill groups that still have only the legacy default_local value.
insert into public.group_locations (group_id, name, is_default, created_by)
select g.id, trim(g.default_local), true, g.created_by
from public.groups g
where nullif(trim(g.default_local), '') is not null
  and not exists (
    select 1 from public.group_locations gl
    where gl.group_id = g.id and gl.is_default = true
  );

-- Keep the legacy column as a compatibility mirror for older clients, but do not
-- let it disagree with the reusable default location.
update public.groups g
set default_local = gl.name
from public.group_locations gl
where gl.group_id = g.id
  and gl.is_default = true
  and g.default_local is distinct from gl.name;

-- Remove duplicate location policies and indexes left by the earlier rollout.
drop policy if exists group_locations_select_member on public.group_locations;
drop index if exists idx_group_locations_group_id;
drop index if exists idx_group_locations_one_default_per_group;

-- Cover the created_by foreign key for admin/ownership maintenance queries.
create index if not exists idx_group_locations_created_by on public.group_locations(created_by);
