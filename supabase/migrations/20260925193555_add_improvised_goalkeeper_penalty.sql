alter table public.groups
  add column if not exists default_improvised_goalkeeper_penalty numeric not null default 10
  check (default_improvised_goalkeeper_penalty >= 0 and default_improvised_goalkeeper_penalty <= 30);
