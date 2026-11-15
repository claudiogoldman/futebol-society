-- Churrasco Society: enforce guest-name length and retain an administrative audit trail.
-- This migration is additive. It is versioned for controlled rollout; do not apply
-- to production until it has been reviewed and tested in an isolated PostgreSQL DB.

alter table public.social_event_guests
  add constraint social_event_guests_name_length
  check (char_length(btrim(name)) between 1 and 100) not valid;

alter table public.social_event_guests
  validate constraint social_event_guests_name_length;

create table if not exists public.social_event_audit_log (
  id bigint generated always as identity primary key,
  event_id uuid not null,
  guest_id uuid,
  actor_id uuid,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  entity_type text not null check (entity_type in ('EVENT', 'GUEST')),
  old_data jsonb,
  new_data jsonb,
  occurred_at timestamptz not null default pg_catalog.clock_timestamp()
);

create index if not exists social_event_audit_log_event_time_idx
  on public.social_event_audit_log (event_id, occurred_at desc);

alter table public.social_event_audit_log enable row level security;
revoke all on table public.social_event_audit_log from public, anon, authenticated;

create or replace function public._social_event_write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_event_id uuid;
  v_guest_id uuid;
  v_old jsonb;
  v_new jsonb;
begin
  if tg_table_name = 'social_events' then
    v_event_id := case when tg_op = 'DELETE' then old.id else new.id end;
    if tg_op <> 'INSERT' then
      v_old := to_jsonb(old) - 'public_token_hash';
    end if;
    if tg_op <> 'DELETE' then
      v_new := to_jsonb(new) - 'public_token_hash';
    end if;
  else
    v_guest_id := case when tg_op = 'DELETE' then old.id else new.id end;
    v_event_id := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
    if tg_op <> 'INSERT' then
      v_old := to_jsonb(old) - 'confirmation_token_hash';
    end if;
    if tg_op <> 'DELETE' then
      v_new := to_jsonb(new) - 'confirmation_token_hash';
    end if;
  end if;

  insert into public.social_event_audit_log (
    event_id, guest_id, actor_id, operation, entity_type, old_data, new_data
  ) values (
    v_event_id,
    v_guest_id,
    auth.uid(),
    tg_op,
    case when tg_table_name = 'social_events' then 'EVENT' else 'GUEST' end,
    v_old,
    v_new
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public._social_event_write_audit_log() from public, anon, authenticated;

drop trigger if exists social_events_audit_log on public.social_events;
create trigger social_events_audit_log
after insert or update or delete on public.social_events
for each row execute function public._social_event_write_audit_log();

drop trigger if exists social_event_guests_audit_log on public.social_event_guests;
create trigger social_event_guests_audit_log
after insert or update or delete on public.social_event_guests
for each row execute function public._social_event_write_audit_log();
