-- Shared, persistent team simulations.
create table if not exists public.team_simulations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  source_game_id uuid references public.games(id) on delete set null,
  title text not null default 'Simulação',
  player_ids jsonb not null default '[]'::jsonb,
  players jsonb not null default '[]'::jsonb,
  team_a jsonb not null default '[]'::jsonb,
  team_b jsonb not null default '[]'::jsonb,
  source_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_simulations_created_by_idx on public.team_simulations(created_by, updated_at desc);
create index if not exists team_simulations_group_idx on public.team_simulations(group_id, updated_at desc);

alter table public.team_simulations enable row level security;

drop policy if exists "team simulations member select" on public.team_simulations;
create policy "team simulations member select" on public.team_simulations
for select to authenticated using (
  exists (
    select 1 from public.group_members gm
    where gm.group_id = team_simulations.group_id
      and gm.user_id = auth.uid()
  )
);

drop policy if exists "team simulations member insert" on public.team_simulations;
create policy "team simulations member insert" on public.team_simulations
for insert to authenticated with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.group_members gm
    where gm.group_id = team_simulations.group_id
      and gm.user_id = auth.uid()
  )
);

drop policy if exists "team simulations owner update" on public.team_simulations;
create policy "team simulations owner update" on public.team_simulations
for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists "team simulations owner delete" on public.team_simulations;
create policy "team simulations owner delete" on public.team_simulations
for delete to authenticated using (created_by = auth.uid());

create or replace function public.get_public_team_simulation(p_simulation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'id', s.id,
    'group_id', s.group_id,
    'title', s.title,
    'source_game_id', s.source_game_id,
    'source_label', s.source_label,
    'players', s.players,
    'team_a', s.team_a,
    'team_b', s.team_b,
    'updated_at', s.updated_at
  ) into v_result
  from public.team_simulations s
  where s.id = p_simulation_id;
  return v_result;
end;
$$;

grant execute on function public.get_public_team_simulation(uuid) to anon, authenticated;

create or replace function public.touch_team_simulation_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_team_simulations_updated_at on public.team_simulations;
create trigger trg_team_simulations_updated_at
before update on public.team_simulations
for each row execute function public.touch_team_simulation_updated_at();
