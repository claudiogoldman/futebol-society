create table if not exists public.group_locations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  address text,
  city text,
  state text,
  latitude numeric,
  longitude numeric,
  is_default boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_group_locations_group_id on public.group_locations(group_id);
create unique index if not exists idx_group_locations_one_default_per_group
  on public.group_locations(group_id) where is_default;

alter table public.group_locations enable row level security;

drop policy if exists group_locations_select_members on public.group_locations;
create policy group_locations_select_members
on public.group_locations for select to authenticated
using (is_group_member(group_id));

drop policy if exists group_locations_insert_admin on public.group_locations;
create policy group_locations_insert_admin
on public.group_locations for insert to authenticated
with check (is_group_admin(group_id) or exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid()));

drop policy if exists group_locations_update_admin on public.group_locations;
create policy group_locations_update_admin
on public.group_locations for update to authenticated
using (is_group_admin(group_id) or exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid()))
with check (is_group_admin(group_id) or exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid()));

drop policy if exists group_locations_delete_admin on public.group_locations;
create policy group_locations_delete_admin
on public.group_locations for delete to authenticated
using (is_group_admin(group_id) or exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid()));
