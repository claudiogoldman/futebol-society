-- Public-token workflows also work for signed-in users (authenticated role).
-- Tokens remain mandatory and all RPCs return only scoped data.
grant execute on function public.get_public_social_event(text) to anon, authenticated;
grant execute on function public.add_public_social_event_guest(text,text) to anon, authenticated;
grant execute on function public.set_social_event_guest_status(text,text) to anon, authenticated;

-- Group-scoped event listing performs lazy auto-closure and never returns token hashes.
create or replace function public.list_social_events(p_group_id uuid)
returns table (
  id uuid, group_id uuid, created_by uuid, name text, description text,
  event_date date, event_time time without time zone, location text,
  status text, closure_type text, closed_at timestamptz, cancelled_at timestamptz,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
begin
  if auth.uid() is null or not (
    public.is_group_admin(p_group_id)
    or exists (
      select 1 from public.group_members gm
      where gm.group_id=p_group_id and gm.user_id=auth.uid()
    )
  ) then
    raise exception 'Grupo não encontrado ou acesso não autorizado.' using errcode='42501';
  end if;

  update public.social_events e
     set status='CLOSED', closure_type='AUTOMATIC',
         closed_at=coalesce(e.closed_at,pg_catalog.clock_timestamp()),
         closed_by=null, updated_at=pg_catalog.clock_timestamp()
   where e.group_id=p_group_id and e.status='OPEN'
     and ((e.event_date + e.event_time) at time zone 'America/Sao_Paulo') <= pg_catalog.clock_timestamp();

  return query
    select e.id,e.group_id,e.created_by,e.name,e.description,e.event_date,e.event_time,
           e.location,e.status,e.closure_type,e.closed_at,e.cancelled_at,e.created_at,e.updated_at
      from public.social_events e
     where e.group_id=p_group_id
     order by e.event_date desc,e.event_time desc;
end;
$$;
revoke all on function public.list_social_events(uuid) from public, anon;
grant execute on function public.list_social_events(uuid) to authenticated;
