alter table public.profiles add column if not exists nationality_code text;

alter table public.profiles drop constraint if exists profiles_nationality_code_format;

alter table public.profiles
  add constraint profiles_nationality_code_format
  check (nationality_code is null or nationality_code ~ '^[A-Z]{2}$');
