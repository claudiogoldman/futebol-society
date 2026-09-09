-- Optional player nickname / preferred display name.
-- The legal/account name remains in profiles.name; nickname is used as the
-- player's preferred name in the application once the UI is wired to it.
alter table public.profiles
  add column if not exists nickname text;

comment on column public.profiles.nickname is
  'Optional preferred name / nickname chosen by the player for display.';

alter table public.profiles
  drop constraint if exists profiles_nickname_length;

alter table public.profiles
  add constraint profiles_nickname_length
  check (nickname is null or char_length(btrim(nickname)) between 1 and 40);
