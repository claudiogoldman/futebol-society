alter table public.groups
  add column if not exists balance_include_reserves boolean not null default true;
