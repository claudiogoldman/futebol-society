-- Group rules for team balancing and goalkeeper Wall ranking.
alter table public.groups
  add column if not exists balance_teams_enabled boolean not null default true,
  add column if not exists wall_max_conceded_goals integer not null default 5,
  add column if not exists wall_points integer not null default 1,
  add column if not exists balance_ranking_weight numeric not null default 0.35,
  add column if not exists balance_wins_weight numeric not null default 0.30,
  add column if not exists balance_goals_weight numeric not null default 0.15,
  add column if not exists balance_assists_weight numeric not null default 0.10,
  add column if not exists balance_rating_weight numeric not null default 0.05;

alter table public.groups
  drop constraint if exists groups_wall_max_conceded_goals_check;
alter table public.groups
  add constraint groups_wall_max_conceded_goals_check check (wall_max_conceded_goals >= 0 and wall_max_conceded_goals <= 20);

alter table public.groups
  drop constraint if exists groups_wall_points_check;
alter table public.groups
  add constraint groups_wall_points_check check (wall_points >= 0 and wall_points <= 10);

alter table public.groups
  drop constraint if exists groups_balance_weights_check;
alter table public.groups
  add constraint groups_balance_weights_check check (
    balance_ranking_weight >= 0 and balance_wins_weight >= 0 and
    balance_goals_weight >= 0 and balance_assists_weight >= 0 and
    balance_rating_weight >= 0
  );
