-- No direct table reads: RPCs expose explicit safe columns and hide token hashes.
revoke all on table public.social_events from anon, authenticated;
revoke all on table public.social_event_guests from anon, authenticated;

create or replace function public.list_social_event_guests(p_event_id uuid)
returns table (
  id uuid,
  event_id uuid,
  name text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_group uuid;
begin
  select e.group_id into v_group
    from public.social_events e where e.id=p_event_id;
  if v_group is null or auth.uid() is null or not public.is_group_admin(v_group) then
    raise exception 'Evento não encontrado ou acesso não autorizado.' using errcode='42501';
  end if;

  perform public._social_event_close_if_due(p_event_id);

  return query
    select g.id,g.event_id,g.name,g.status,g.created_at,g.updated_at
      from public.social_event_guests g
     where g.event_id=p_event_id
     order by g.created_at asc;
end;
$$;
revoke all on function public.list_social_event_guests(uuid) from public, anon;
grant execute on function public.list_social_event_guests(uuid) to authenticated;
