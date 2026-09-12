create or replace function public.get_group_invite_info(p_token uuid)
returns table (
  group_id uuid,
  group_name text,
  participation_penalty_enabled boolean,
  participation_penalty_hours integer,
  participation_penalty_games integer
)
language sql
security definer
set search_path = public
as $$
  select
    g.id,
    g.name,
    coalesce(g.participation_penalty_enabled, true),
    coalesce(g.participation_penalty_hours, 24),
    coalesce(g.participation_penalty_games, 1)
  from public.groups g
  where g.invite_token = p_token;
$$;

grant execute on function public.get_group_invite_info(uuid) to anon, authenticated;
