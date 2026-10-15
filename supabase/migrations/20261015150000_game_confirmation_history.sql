create schema if not exists private;

create table if not exists private.game_confirmation_history (
  id bigint generated always as identity primary key,
  group_id uuid,
  game_id uuid not null,
  game_date date,
  user_id uuid not null,
  participant_name text not null,
  event_type text not null check (event_type in ('entered', 'removed')),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  source text not null default 'trigger' check (source in ('trigger', 'backfill'))
);

create index if not exists game_confirmation_history_group_player_time_idx
  on private.game_confirmation_history (group_id, user_id, occurred_at desc);

create index if not exists game_confirmation_history_game_time_idx
  on private.game_confirmation_history (game_id, occurred_at desc);

comment on table private.game_confirmation_history is
  'Append-only audit trail of game confirmation insertions and removals. Historical removals before this migration cannot be reconstructed.';

create or replace function private.log_game_confirmation_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_group_id uuid;
  v_game_date date;
  v_name text;
begin
  if TG_OP = 'INSERT' then
    select g.group_id, g.date
      into v_group_id, v_game_date
      from public.games g
     where g.id = NEW.game_id;

    select coalesce(nullif(p.nickname, ''), nullif(p.name, ''), NEW.user_id::text)
      into v_name
      from public.profiles p
     where p.id = NEW.user_id;

    insert into private.game_confirmation_history (
      group_id, game_id, game_date, user_id, participant_name,
      event_type, occurred_at, actor_user_id, source
    ) values (
      v_group_id, NEW.game_id, v_game_date, NEW.user_id,
      coalesce(v_name, NEW.user_id::text), 'entered',
      coalesce(NEW.confirmed_at, now()), auth.uid(), 'trigger'
    );
    return NEW;
  elsif TG_OP = 'DELETE' then
    select g.group_id, g.date
      into v_group_id, v_game_date
      from public.games g
     where g.id = OLD.game_id;

    select coalesce(nullif(p.nickname, ''), nullif(p.name, ''), OLD.user_id::text)
      into v_name
      from public.profiles p
     where p.id = OLD.user_id;

    insert into private.game_confirmation_history (
      group_id, game_id, game_date, user_id, participant_name,
      event_type, occurred_at, actor_user_id, source
    ) values (
      v_group_id, OLD.game_id, v_game_date, OLD.user_id,
      coalesce(v_name, OLD.user_id::text), 'removed',
      now(), auth.uid(), 'trigger'
    );
    return OLD;
  end if;

  return null;
end;
$function$;

drop trigger if exists trg_history_game_confirmation_insert on public.game_confirmations;
create trigger trg_history_game_confirmation_insert
  after insert on public.game_confirmations
  for each row execute function private.log_game_confirmation_history();

drop trigger if exists trg_history_game_confirmation_delete on public.game_confirmations;
create trigger trg_history_game_confirmation_delete
  after delete on public.game_confirmations
  for each row execute function private.log_game_confirmation_history();

-- Preserve a baseline for current confirmations. This is not a reconstruction
-- of removals that happened before this migration.
insert into private.game_confirmation_history (
  group_id, game_id, game_date, user_id, participant_name,
  event_type, occurred_at, actor_user_id, source
)
select
  g.group_id,
  gc.game_id,
  g.date,
  gc.user_id,
  coalesce(nullif(p.nickname, ''), nullif(p.name, ''), gc.user_id::text),
  'entered',
  gc.confirmed_at,
  null,
  'backfill'
from public.game_confirmations gc
join public.games g on g.id = gc.game_id
left join public.profiles p on p.id = gc.user_id
where not exists (
  select 1
  from private.game_confirmation_history h
  where h.game_id = gc.game_id
    and h.user_id = gc.user_id
    and h.event_type = 'entered'
    and h.occurred_at = gc.confirmed_at
);
