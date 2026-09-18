create or replace function public.get_admin_games()
returns table (
  id uuid,
  date date,
  local text,
  group_id uuid,
  group_name text,
  created_by uuid,
  creator_name text,
  score_a integer,
  score_b integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if not public.is_global_admin() then
    raise exception 'ADMIN_ONLY';
  end if;

  return query
  select
    g.id,
    g.date,
    g.local,
    g.group_id,
    gr.name as group_name,
    g.created_by,
    p.name as creator_name,
    g.score_a,
    g.score_b,
    g.created_at
  from public.games g
  left join public.groups gr on gr.id = g.group_id
  left join public.profiles p on p.id = g.created_by
  order by g.date desc, g.created_at desc;
end;
$$;

create or replace function public.admin_delete_game(p_game_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if not public.is_global_admin() then
    raise exception 'ADMIN_ONLY';
  end if;

  if p_game_id is null or not exists (select 1 from public.games where id = p_game_id) then
    raise exception 'GAME_NOT_FOUND';
  end if;

  delete from public.games
  where id = p_game_id;

  return p_game_id;
end;
$$;

grant execute on function public.get_admin_games() to authenticated;
grant execute on function public.admin_delete_game(uuid) to authenticated;
