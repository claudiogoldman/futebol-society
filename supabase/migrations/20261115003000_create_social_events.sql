-- Churrasco Society: isolated social-event module.
-- This migration is intentionally additive and does not alter football tables.
-- Public access is provided only through narrowly scoped RPCs added in a later migration.

create table if not exists public.social_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete restrict,
  created_by uuid not null references auth.users(id),
  name text not null,
  description text,
  event_date date not null,
  event_time time without time zone not null,
  location text,
  public_token_hash bytea not null unique,
  status text not null default 'OPEN'
    check (status in ('OPEN', 'CLOSED', 'CANCELLED')),
  closed_at timestamptz,
  closure_type text check (closure_type in ('MANUAL', 'AUTOMATIC')),
  closed_by uuid references auth.users(id),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_events_name_nonempty check (length(btrim(name)) > 0)
);

create index if not exists social_events_group_date_idx
  on public.social_events (group_id, event_date desc, event_time desc);
create index if not exists social_events_open_start_idx
  on public.social_events (event_date, event_time)
  where status = 'OPEN';

create table if not exists public.social_event_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.social_events(id) on delete cascade,
  name text not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'CONFIRMED', 'CANCELLED')),
  confirmation_token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_event_guests_name_nonempty check (length(btrim(name)) > 0)
);

create index if not exists social_event_guests_event_status_idx
  on public.social_event_guests (event_id, status, created_at);

alter table public.social_events enable row level security;
alter table public.social_event_guests enable row level security;

-- No direct anonymous table access. Anonymous workflows will use token-validating RPCs.
revoke all on table public.social_events from anon, authenticated;
grant select, insert, update on table public.social_events to authenticated;
revoke all on table public.social_event_guests from anon, authenticated;
grant select, insert, update, delete on table public.social_event_guests to authenticated;

drop policy if exists social_events_admin_select on public.social_events;
create policy social_events_admin_select
  on public.social_events for select to authenticated
  using (public.is_group_admin(group_id));

drop policy if exists social_events_admin_insert on public.social_events;
create policy social_events_admin_insert
  on public.social_events for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.is_group_admin(group_id)
  );

drop policy if exists social_events_admin_update on public.social_events;
create policy social_events_admin_update
  on public.social_events for update to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

drop policy if exists social_event_guests_admin_select on public.social_event_guests;
create policy social_event_guests_admin_select
  on public.social_event_guests for select to authenticated
  using (
    exists (
      select 1
      from public.social_events e
      where e.id = event_id
        and public.is_group_admin(e.group_id)
    )
  );

drop policy if exists social_event_guests_admin_insert on public.social_event_guests;
create policy social_event_guests_admin_insert
  on public.social_event_guests for insert to authenticated
  with check (
    exists (
      select 1
      from public.social_events e
      where e.id = event_id
        and public.is_group_admin(e.group_id)
    )
  );

drop policy if exists social_event_guests_admin_update on public.social_event_guests;
create policy social_event_guests_admin_update
  on public.social_event_guests for update to authenticated
  using (
    exists (
      select 1
      from public.social_events e
      where e.id = event_id
        and public.is_group_admin(e.group_id)
    )
  )
  with check (
    exists (
      select 1
      from public.social_events e
      where e.id = event_id
        and public.is_group_admin(e.group_id)
    )
  );

drop policy if exists social_event_guests_admin_delete on public.social_event_guests;
create policy social_event_guests_admin_delete
  on public.social_event_guests for delete to authenticated
  using (
    exists (
      select 1
      from public.social_events e
      where e.id = event_id
        and public.is_group_admin(e.group_id)
    )
  );
