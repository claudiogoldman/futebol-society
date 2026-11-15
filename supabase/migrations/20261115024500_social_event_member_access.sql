-- Allow group members to see event metadata in the group tab.
drop policy if exists social_events_admin_select on public.social_events;
create policy social_events_member_select
  on public.social_events for select to authenticated
  using (
    public.is_group_admin(group_id)
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = social_events.group_id
        and gm.user_id = (select auth.uid())
    )
  );

-- Admin-created guests also receive a one-time raw confirmation token.
drop function if exists public.add_social_event_guest(uuid, text);
create function public.add_social_event_guest(p_event_id uuid, p_name text)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_group uuid; v_guest uuid; v_confirmation text;
begin
  select group_id into v_group from public.social_events where id=p_event_id;
  if v_group is null or auth.uid() is null or not public.is_group_admin(v_group) then
    raise exception 'Evento não encontrado ou acesso não autorizado.' using errcode='42501';
  end if;
  perform public._social_event_close_if_due(p_event_id);
  if nullif(pg_catalog.btrim(p_name),'') is null then
    raise exception 'Informe o nome do convidado.' using errcode='22023';
  end if;
  v_confirmation:=pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
  insert into public.social_event_guests(event_id,name,status,confirmation_token_hash)
  values (p_event_id,pg_catalog.btrim(p_name),'PENDING',
    extensions.digest(pg_catalog.convert_to(v_confirmation,'UTF8'),'sha256'))
  returning id into v_guest;
  return pg_catalog.jsonb_build_object('guest_id',v_guest,'confirmation_token',v_confirmation);
end;
$$;
revoke all on function public.add_social_event_guest(uuid,text) from public, anon;
grant execute on function public.add_social_event_guest(uuid,text) to authenticated;
