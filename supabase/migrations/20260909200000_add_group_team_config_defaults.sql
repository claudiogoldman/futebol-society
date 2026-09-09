alter table public.groups add column if not exists default_players_per_team integer;
alter table public.groups add column if not exists default_reserves_per_team integer;

update public.groups
set default_players_per_team = greatest(1, coalesce(default_max_players / 2, 5))
where default_players_per_team is null;

update public.groups
set default_reserves_per_team = 0
where default_reserves_per_team is null;

alter table public.groups alter column default_players_per_team set default 5;
alter table public.groups alter column default_reserves_per_team set default 0;
