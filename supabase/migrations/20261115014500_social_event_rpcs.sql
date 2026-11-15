-- Churrasco Society RPCs. No direct anonymous table access.
-- All privileged entry points use fixed search_path and explicit grants.

create or replace function public._social_event_close_if_due(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, auth
as $$
begin
  update public.social_events e
     set status = 'CLOSED',
         closure_type = 'AUTOMATIC',
         closed_at = coalesce(e.closed_at, pg_catalog.clock_timestamp()),
         closed_by = null,
         updated_at = pg_catalog.clock_timestamp()
   where e.id = p_event_id
     and e.status = 'OPEN'
     and ((e.event_date + e.event_time) at time zone 'America/Sao_Paulo') <= pg_catalog.clock_timestamp();
end;
$$;
revoke all on function public._social_event_close_if_due(uuid) from public, anon, authenticated;

create or replace function public.create_social_event(
  p_group_id uuid, p_name text, p_description text,
  p_event_date date, p_event_time time, p_location text default null
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_token text; v_id uuid;
begin
  if auth.uid() is null or not public.is_group_admin(p_group_id) then
    raise exception 'Apenas administradores do grupo podem criar eventos.' using errcode = '42501';
  end if;
  if nullif(pg_catalog.btrim(p_name), '') is null or p_event_date is null or p_event_time is null then
    raise exception 'Informe nome, data e horário do evento.' using errcode = '22023';
  end if;
  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.social_events(group_id, created_by, name, description, event_date, event_time, location, public_token_hash)
  values (p_group_id, auth.uid(), pg_catalog.btrim(p_name), nullif(pg_catalog.btrim(p_description), ''),
          p_event_date, p_event_time, nullif(pg_catalog.btrim(p_location), ''),
          extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256'))
  returning id into v_id;
  perform public._social_event_close_if_due(v_id);
  return pg_catalog.jsonb_build_object('id', v_id, 'public_token', v_token);
end;
$$;

create or replace function public.update_social_event(
  p_event_id uuid, p_name text, p_description text,
  p_event_date date, p_event_time time, p_location text default null
) returns boolean
language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_group uuid;
begin
  select group_id into v_group from public.social_events where id = p_event_id;
  if v_group is null or auth.uid() is null or not public.is_group_admin(v_group) then
    raise exception 'Evento não encontrado ou acesso não autorizado.' using errcode = '42501';
  end if;
  perform public._social_event_close_if_due(p_event_id);
  update public.social_events
     set name = pg_catalog.btrim(p_name),
         description = nullif(pg_catalog.btrim(p_description), ''),
         event_date = p_event_date,
         event_time = p_event_time,
         location = nullif(pg_catalog.btrim(p_location), ''),
         updated_at = pg_catalog.clock_timestamp()
   where id = p_event_id and status = 'OPEN'
     and ((event_date + event_time) at time zone 'America/Sao_Paulo') > pg_catalog.clock_timestamp()
     and nullif(pg_catalog.btrim(p_name), '') is not null
     and p_event_date is not null and p_event_time is not null;
  if not found then
    perform public._social_event_close_if_due(p_event_id);
    raise exception 'Evento encerrado ou dados inválidos.' using errcode = '22023';
  end if;
  perform public._social_event_close_if_due(p_event_id);
  return true;
end;
$$;

create or replace function public.close_social_event(p_event_id uuid)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_group uuid; v_closed boolean;
begin
  select group_id into v_group from public.social_events where id = p_event_id;
  if v_group is null or auth.uid() is null or not public.is_group_admin(v_group) then
    raise exception 'Evento não encontrado ou acesso não autorizado.' using errcode = '42501';
  end if;
  perform public._social_event_close_if_due(p_event_id);
  update public.social_events set status='CLOSED', closure_type='MANUAL',
    closed_at=pg_catalog.clock_timestamp(), closed_by=auth.uid(), updated_at=pg_catalog.clock_timestamp()
  where id=p_event_id and status='OPEN'
    and ((event_date + event_time) at time zone 'America/Sao_Paulo') > pg_catalog.clock_timestamp();
  v_closed := found;
  perform public._social_event_close_if_due(p_event_id);
  return v_closed;
end;
$$;

create or replace function public.reopen_social_event(p_event_id uuid)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_group uuid;
begin
  select group_id into v_group from public.social_events where id = p_event_id;
  if v_group is null or auth.uid() is null or not public.is_group_admin(v_group) then
    raise exception 'Evento não encontrado ou acesso não autorizado.' using errcode = '42501';
  end if;
  update public.social_events set status='OPEN', closure_type=null, closed_at=null,
    closed_by=null, updated_at=pg_catalog.clock_timestamp()
  where id=p_event_id and status='CLOSED' and closure_type='MANUAL'
    and ((event_date + event_time) at time zone 'America/Sao_Paulo') > pg_catalog.clock_timestamp();
  if not found then raise exception 'Somente eventos encerrados manualmente e ainda não iniciados podem ser reabertos.' using errcode='22023'; end if;
  return true;
end;
$$;

create or replace function public.cancel_social_event(p_event_id uuid)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_group uuid;
begin
  select group_id into v_group from public.social_events where id = p_event_id;
  if v_group is null or auth.uid() is null or not public.is_group_admin(v_group) then
    raise exception 'Evento não encontrado ou acesso não autorizado.' using errcode = '42501';
  end if;
  update public.social_events set status='CANCELLED', cancelled_at=pg_catalog.clock_timestamp(),
    updated_at=pg_catalog.clock_timestamp() where id=p_event_id and status <> 'CANCELLED';
  return found;
end;
$$;

create or replace function public.add_social_event_guest(p_event_id uuid, p_name text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_group uuid; v_guest uuid;
begin
  select group_id into v_group from public.social_events where id=p_event_id;
  if v_group is null or auth.uid() is null or not public.is_group_admin(v_group) then
    raise exception 'Evento não encontrado ou acesso não autorizado.' using errcode='42501';
  end if;
  perform public._social_event_close_if_due(p_event_id);
  if nullif(pg_catalog.btrim(p_name),'') is null then raise exception 'Informe o nome do convidado.' using errcode='22023'; end if;
  insert into public.social_event_guests(event_id,name,status,confirmation_token_hash)
  values (p_event_id,pg_catalog.btrim(p_name),'PENDING',
    extensions.digest(extensions.gen_random_bytes(32),'sha256'))
  returning id into v_guest;
  return v_guest;
end;
$$;

create or replace function public.update_social_event_guest(p_guest_id uuid, p_name text, p_status text)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_event uuid; v_group uuid;
begin
  select g.event_id, e.group_id into v_event,v_group
    from public.social_event_guests g join public.social_events e on e.id=g.event_id
   where g.id=p_guest_id;
  if v_event is null or auth.uid() is null or not public.is_group_admin(v_group) then
    raise exception 'Convidado não encontrado ou acesso não autorizado.' using errcode='42501';
  end if;
  perform public._social_event_close_if_due(v_event);
  update public.social_event_guests set name=pg_catalog.btrim(p_name),status=p_status,updated_at=pg_catalog.clock_timestamp()
   where id=p_guest_id and exists(select 1 from public.social_events e where e.id=v_event and e.status='OPEN'
       and ((e.event_date + e.event_time) at time zone 'America/Sao_Paulo') > pg_catalog.clock_timestamp())
     and nullif(pg_catalog.btrim(p_name),'') is not null
     and p_status in ('PENDING','CONFIRMED','CANCELLED');
  if not found then
    perform public._social_event_close_if_due(v_event);
    raise exception 'Evento encerrado ou dados inválidos.' using errcode='22023';
  end if;
  return true;
end;
$$;

create or replace function public.delete_social_event_guest(p_guest_id uuid)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_event uuid; v_group uuid;
begin
  select g.event_id,e.group_id into v_event,v_group from public.social_event_guests g
  join public.social_events e on e.id=g.event_id where g.id=p_guest_id;
  if v_event is null or auth.uid() is null or not public.is_group_admin(v_group) then
    raise exception 'Convidado não encontrado ou acesso não autorizado.' using errcode='42501';
  end if;
  perform public._social_event_close_if_due(v_event);
  delete from public.social_event_guests g where g.id=p_guest_id
    and exists(select 1 from public.social_events e where e.id=v_event and e.status='OPEN'
      and ((e.event_date + e.event_time) at time zone 'America/Sao_Paulo') > pg_catalog.clock_timestamp());
  return found;
end;
$$;

create or replace function public.get_public_social_event(p_public_token text)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_event public.social_events%rowtype;
begin
  if p_public_token is null or pg_catalog.length(p_public_token) <> 64 then return null; end if;
  select * into v_event from public.social_events
   where public_token_hash=extensions.digest(pg_catalog.convert_to(p_public_token,'UTF8'),'sha256');
  if not found then return null; end if;
  perform public._social_event_close_if_due(v_event.id);
  select * into v_event from public.social_events where id=v_event.id;
  return pg_catalog.jsonb_build_object(
    'id',v_event.id,'name',v_event.name,'description',v_event.description,
    'event_date',v_event.event_date,'event_time',v_event.event_time,'location',v_event.location,
    'status',v_event.status,
    'confirmed_count',(select pg_catalog.count(*) from public.social_event_guests where event_id=v_event.id and status='CONFIRMED'),
    'confirmed_names',coalesce((select pg_catalog.jsonb_agg(name order by created_at) from public.social_event_guests where event_id=v_event.id and status='CONFIRMED'),'[]'::jsonb)
  );
end;
$$;

create or replace function public.add_public_social_event_guest(p_public_token text,p_name text)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_event public.social_events%rowtype; v_confirmation text; v_guest uuid;
begin
  if p_public_token is null or pg_catalog.length(p_public_token) <> 64
    or nullif(pg_catalog.btrim(p_name),'') is null then
    raise exception 'Link ou nome inválido.' using errcode='22023';
  end if;
  select * into v_event from public.social_events
   where public_token_hash=extensions.digest(pg_catalog.convert_to(p_public_token,'UTF8'),'sha256');
  if not found then raise exception 'Evento não encontrado.' using errcode='P0002'; end if;
  perform public._social_event_close_if_due(v_event.id);
  select * into v_event from public.social_events where id=v_event.id;
  if v_event.status <> 'OPEN' then raise exception 'Este evento não aceita novas inclusões.' using errcode='22023'; end if;
  v_confirmation:=pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
  insert into public.social_event_guests(event_id,name,status,confirmation_token_hash)
  select e.id,pg_catalog.btrim(p_name),'PENDING',
    extensions.digest(pg_catalog.convert_to(v_confirmation,'UTF8'),'sha256')
    from public.social_events e
   where e.id=v_event.id and e.status='OPEN'
     and ((e.event_date + e.event_time) at time zone 'America/Sao_Paulo') > pg_catalog.clock_timestamp()
  returning id into v_guest;
  if v_guest is null then
    perform public._social_event_close_if_due(v_event.id);
    raise exception 'Este evento não aceita novas inclusões.' using errcode='22023';
  end if;
  return pg_catalog.jsonb_build_object('guest_id',v_guest,'confirmation_token',v_confirmation);
end;
$$;

create or replace function public.set_social_event_guest_status(p_confirmation_token text,p_status text)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_guest public.social_event_guests%rowtype; v_event public.social_events%rowtype;
begin
  if p_confirmation_token is null or pg_catalog.length(p_confirmation_token) <> 64
    or p_status not in ('CONFIRMED','CANCELLED') then
    raise exception 'Token ou situação inválida.' using errcode='22023';
  end if;
  select * into v_guest from public.social_event_guests
   where confirmation_token_hash=extensions.digest(pg_catalog.convert_to(p_confirmation_token,'UTF8'),'sha256');
  if not found then raise exception 'Confirmação não encontrada.' using errcode='P0002'; end if;
  perform public._social_event_close_if_due(v_guest.event_id);
  select * into v_event from public.social_events where id=v_guest.event_id;
  if v_event.status <> 'OPEN' then raise exception 'Este evento não aceita alterações de presença.' using errcode='22023'; end if;
  update public.social_event_guests set status=p_status,updated_at=pg_catalog.clock_timestamp() where id=v_guest.id
    and exists(select 1 from public.social_events e where e.id=v_event.id and e.status='OPEN'
      and ((e.event_date + e.event_time) at time zone 'America/Sao_Paulo') > pg_catalog.clock_timestamp());
  if not found then
    perform public._social_event_close_if_due(v_event.id);
    raise exception 'Este evento não aceita alterações de presença.' using errcode='22023';
  end if;
  return true;
end;
$$;

-- Functions are public RPC entry points only where explicitly granted below.
revoke all on function public.create_social_event(uuid,text,text,date,time,text) from public, anon;
revoke all on function public.update_social_event(uuid,text,text,date,time,text) from public, anon;
revoke all on function public.close_social_event(uuid) from public, anon;
revoke all on function public.reopen_social_event(uuid) from public, anon;
revoke all on function public.cancel_social_event(uuid) from public, anon;
revoke all on function public.add_social_event_guest(uuid,text) from public, anon;
revoke all on function public.update_social_event_guest(uuid,text,text) from public, anon;
revoke all on function public.delete_social_event_guest(uuid) from public, anon;
revoke all on function public.get_public_social_event(text) from public, authenticated;
revoke all on function public.add_public_social_event_guest(text,text) from public, authenticated;
revoke all on function public.set_social_event_guest_status(text,text) from public, authenticated;

grant execute on function public.create_social_event(uuid,text,text,date,time,text) to authenticated;
grant execute on function public.update_social_event(uuid,text,text,date,time,text) to authenticated;
grant execute on function public.close_social_event(uuid) to authenticated;
grant execute on function public.reopen_social_event(uuid) to authenticated;
grant execute on function public.cancel_social_event(uuid) to authenticated;
grant execute on function public.add_social_event_guest(uuid,text) to authenticated;
grant execute on function public.update_social_event_guest(uuid,text,text) to authenticated;
grant execute on function public.delete_social_event_guest(uuid) to authenticated;
grant execute on function public.get_public_social_event(text) to anon;
grant execute on function public.add_public_social_event_guest(text,text) to anon;
grant execute on function public.set_social_event_guest_status(text,text) to anon;
