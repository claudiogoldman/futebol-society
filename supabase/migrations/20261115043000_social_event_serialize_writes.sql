-- Serialize all state-changing operations for an event on its parent row.
-- This prevents a public confirmation/inclusion from racing with event closure
-- or cancellation. The event row lock is held until the transaction commits.

create or replace function public.cancel_social_event(p_event_id uuid)
returns boolean
language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_event public.social_events%rowtype;
begin
  select * into v_event
    from public.social_events
   where id = p_event_id
   for update;
  if not found or auth.uid() is null or not public.is_group_admin(v_event.group_id) then
    raise exception 'Evento não encontrado ou acesso não autorizado.' using errcode='42501';
  end if;

  if v_event.status = 'CANCELLED' then
    return false;
  end if;

  update public.social_events
     set status='CANCELLED',
         cancelled_at=pg_catalog.clock_timestamp(),
         updated_at=pg_catalog.clock_timestamp()
   where id=p_event_id;
  return true;
end;
$$;

create or replace function public.close_social_event(p_event_id uuid)
returns boolean
language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_event public.social_events%rowtype;
begin
  select * into v_event from public.social_events where id=p_event_id for update;
  if not found or auth.uid() is null or not public.is_group_admin(v_event.group_id) then
    raise exception 'Evento não encontrado ou acesso não autorizado.' using errcode='42501';
  end if;

  if v_event.status <> 'OPEN' then return false; end if;

  if ((v_event.event_date + v_event.event_time) at time zone 'America/Sao_Paulo')
       <= pg_catalog.clock_timestamp() then
    update public.social_events
       set status='CLOSED', closure_type='AUTOMATIC',
           closed_at=coalesce(closed_at,pg_catalog.clock_timestamp()),
           closed_by=null, updated_at=pg_catalog.clock_timestamp()
     where id=p_event_id;
    return false;
  end if;

  update public.social_events
     set status='CLOSED', closure_type='MANUAL',
         closed_at=pg_catalog.clock_timestamp(), closed_by=auth.uid(),
         updated_at=pg_catalog.clock_timestamp()
   where id=p_event_id;
  return true;
end;
$$;

create or replace function public.reopen_social_event(p_event_id uuid)
returns boolean
language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_event public.social_events%rowtype;
begin
  select * into v_event from public.social_events where id=p_event_id for update;
  if not found or auth.uid() is null or not public.is_group_admin(v_event.group_id) then
    raise exception 'Evento não encontrado ou acesso não autorizado.' using errcode='42501';
  end if;

  if v_event.status <> 'CLOSED' or v_event.closure_type <> 'MANUAL'
     or ((v_event.event_date + v_event.event_time) at time zone 'America/Sao_Paulo')
          <= pg_catalog.clock_timestamp() then
    raise exception 'Somente eventos encerrados manualmente e ainda não iniciados podem ser reabertos.'
      using errcode='22023';
  end if;

  update public.social_events
     set status='OPEN', closure_type=null, closed_at=null, closed_by=null,
         updated_at=pg_catalog.clock_timestamp()
   where id=p_event_id;
  return true;
end;
$$;

create or replace function public.update_social_event(
  p_event_id uuid, p_name text, p_description text,
  p_event_date date, p_event_time time, p_location text default null
) returns boolean
language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_event public.social_events%rowtype;
begin
  select * into v_event from public.social_events where id=p_event_id for update;
  if not found or auth.uid() is null or not public.is_group_admin(v_event.group_id) then
    raise exception 'Evento não encontrado ou acesso não autorizado.' using errcode='42501';
  end if;

  if v_event.status <> 'OPEN'
     or ((v_event.event_date + v_event.event_time) at time zone 'America/Sao_Paulo')
          <= pg_catalog.clock_timestamp() then
    perform public._social_event_close_if_due(p_event_id);
    raise exception 'Evento encerrado ou dados inválidos.' using errcode='22023';
  end if;

  if nullif(pg_catalog.btrim(p_name),'') is null or p_event_date is null or p_event_time is null then
    raise exception 'Informe nome, data e horário do evento.' using errcode='22023';
  end if;

  update public.social_events
     set name=pg_catalog.btrim(p_name),
         description=nullif(pg_catalog.btrim(p_description),''),
         event_date=p_event_date, event_time=p_event_time,
         location=nullif(pg_catalog.btrim(p_location),''),
         updated_at=pg_catalog.clock_timestamp()
   where id=p_event_id;
  perform public._social_event_close_if_due(p_event_id);
  return true;
end;
$$;

create or replace function public.add_social_event_guest(p_event_id uuid, p_name text)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_event public.social_events%rowtype; v_guest uuid; v_confirmation text;
begin
  select * into v_event from public.social_events where id=p_event_id for update;
  if not found or auth.uid() is null or not public.is_group_admin(v_event.group_id) then
    raise exception 'Evento não encontrado ou acesso não autorizado.' using errcode='42501';
  end if;

  if v_event.status <> 'OPEN'
     or ((v_event.event_date + v_event.event_time) at time zone 'America/Sao_Paulo')
          <= pg_catalog.clock_timestamp() then
    perform public._social_event_close_if_due(p_event_id);
    raise exception 'Evento encerrado ou cancelado não aceita novos convidados.' using errcode='22023';
  end if;
  if nullif(pg_catalog.btrim(p_name),'') is null then
    raise exception 'Informe o nome do convidado.' using errcode='22023';
  end if;

  v_confirmation:=pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
  insert into public.social_event_guests(event_id,name,status,confirmation_token_hash)
  values(p_event_id,pg_catalog.btrim(p_name),'PENDING',
    extensions.digest(pg_catalog.convert_to(v_confirmation,'UTF8'),'sha256'))
  returning id into v_guest;
  return pg_catalog.jsonb_build_object('guest_id',v_guest,'confirmation_token',v_confirmation);
end;
$$;

create or replace function public.update_social_event_guest(
  p_guest_id uuid, p_name text, p_status text
) returns boolean
language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_event_id uuid; v_event public.social_events%rowtype;
begin
  select event_id into v_event_id
    from public.social_event_guests where id=p_guest_id;
  if v_event_id is null then
    raise exception 'Convidado não encontrado ou acesso não autorizado.' using errcode='42501';
  end if;

  select * into v_event from public.social_events where id=v_event_id for update;
  if not found or auth.uid() is null or not public.is_group_admin(v_event.group_id) then
    raise exception 'Convidado não encontrado ou acesso não autorizado.' using errcode='42501';
  end if;

  if v_event.status <> 'OPEN'
     or ((v_event.event_date + v_event.event_time) at time zone 'America/Sao_Paulo')
          <= pg_catalog.clock_timestamp()
     or nullif(pg_catalog.btrim(p_name),'') is null
     or p_status not in ('PENDING','CONFIRMED','CANCELLED') then
    perform public._social_event_close_if_due(v_event_id);
    raise exception 'Evento encerrado ou dados inválidos.' using errcode='22023';
  end if;

  update public.social_event_guests
     set name=pg_catalog.btrim(p_name), status=p_status,
         updated_at=pg_catalog.clock_timestamp()
   where id=p_guest_id and event_id=v_event_id;
  if not found then
    raise exception 'Convidado não encontrado.' using errcode='P0002';
  end if;
  return true;
end;
$$;

create or replace function public.delete_social_event_guest(p_guest_id uuid)
returns boolean
language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_event_id uuid; v_event public.social_events%rowtype;
begin
  select event_id into v_event_id
    from public.social_event_guests where id=p_guest_id;
  if v_event_id is null then return false; end if;

  select * into v_event from public.social_events where id=v_event_id for update;
  if not found or auth.uid() is null or not public.is_group_admin(v_event.group_id) then
    raise exception 'Convidado não encontrado ou acesso não autorizado.' using errcode='42501';
  end if;

  if v_event.status <> 'OPEN'
     or ((v_event.event_date + v_event.event_time) at time zone 'America/Sao_Paulo')
          <= pg_catalog.clock_timestamp() then
    perform public._social_event_close_if_due(v_event_id);
    return false;
  end if;

  delete from public.social_event_guests where id=p_guest_id and event_id=v_event_id;
  return found;
end;
$$;

create or replace function public.add_public_social_event_guest(p_public_token text,p_name text)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_event public.social_events%rowtype; v_confirmation text; v_guest uuid;
begin
  if p_public_token is null or pg_catalog.length(p_public_token) <> 64
     or nullif(pg_catalog.btrim(p_name),'') is null then
    raise exception 'Link ou nome inválido.' using errcode='22023';
  end if;

  select * into v_event
    from public.social_events
   where public_token_hash=extensions.digest(pg_catalog.convert_to(p_public_token,'UTF8'),'sha256');
  if not found then raise exception 'Evento não encontrado.' using errcode='P0002'; end if;

  select * into v_event from public.social_events where id=v_event.id for update;
  if not found or v_event.public_token_hash <>
       extensions.digest(pg_catalog.convert_to(p_public_token,'UTF8'),'sha256') then
    raise exception 'Link do evento inválido ou renovado.' using errcode='P0002';
  end if;
  if v_event.status <> 'OPEN'
     or ((v_event.event_date + v_event.event_time) at time zone 'America/Sao_Paulo')
          <= pg_catalog.clock_timestamp() then
    perform public._social_event_close_if_due(v_event.id);
    raise exception 'Este evento não aceita novas inclusões.' using errcode='22023';
  end if;

  v_confirmation:=pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
  insert into public.social_event_guests(event_id,name,status,confirmation_token_hash)
  values(v_event.id,pg_catalog.btrim(p_name),'PENDING',
    extensions.digest(pg_catalog.convert_to(v_confirmation,'UTF8'),'sha256'))
  returning id into v_guest;
  return pg_catalog.jsonb_build_object('guest_id',v_guest,'confirmation_token',v_confirmation);
end;
$$;

create or replace function public.set_social_event_guest_status(
  p_confirmation_token text,p_status text
) returns boolean
language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_guest_id uuid; v_event_id uuid; v_event public.social_events%rowtype;
begin
  if p_confirmation_token is null or pg_catalog.length(p_confirmation_token) <> 64
     or p_status not in ('CONFIRMED','CANCELLED') then
    raise exception 'Token ou situação inválida.' using errcode='22023';
  end if;

  select id,event_id into v_guest_id,v_event_id
    from public.social_event_guests
   where confirmation_token_hash=extensions.digest(pg_catalog.convert_to(p_confirmation_token,'UTF8'),'sha256');
  if v_guest_id is null then
    raise exception 'Confirmação não encontrada.' using errcode='P0002';
  end if;

  select * into v_event from public.social_events where id=v_event_id for update;
  if not found or v_event.status <> 'OPEN'
     or ((v_event.event_date + v_event.event_time) at time zone 'America/Sao_Paulo')
          <= pg_catalog.clock_timestamp() then
    perform public._social_event_close_if_due(v_event_id);
    raise exception 'Este evento não aceita alterações de presença.' using errcode='22023';
  end if;

  update public.social_event_guests
     set status=p_status, updated_at=pg_catalog.clock_timestamp()
   where id=v_guest_id and event_id=v_event_id;
  if not found then
    raise exception 'Confirmação não encontrada.' using errcode='P0002';
  end if;
  return true;
end;
$$;

-- Keep explicit grants from the previous migration sequence. CREATE OR REPLACE
-- preserves function privileges; this block documents the intended role boundary.
revoke all on function public.cancel_social_event(uuid) from public, anon;
revoke all on function public.close_social_event(uuid) from public, anon;
revoke all on function public.reopen_social_event(uuid) from public, anon;
revoke all on function public.update_social_event(uuid,text,text,date,time,text) from public, anon;
revoke all on function public.add_social_event_guest(uuid,text) from public, anon;
revoke all on function public.update_social_event_guest(uuid,text,text) from public, anon;
revoke all on function public.delete_social_event_guest(uuid) from public, anon;
revoke all on function public.add_public_social_event_guest(text,text) from public;
revoke all on function public.set_social_event_guest_status(text,text) from public;
grant execute on function public.cancel_social_event(uuid) to authenticated;
grant execute on function public.close_social_event(uuid) to authenticated;
grant execute on function public.reopen_social_event(uuid) to authenticated;
grant execute on function public.update_social_event(uuid,text,text,date,time,text) to authenticated;
grant execute on function public.add_social_event_guest(uuid,text) to authenticated;
grant execute on function public.update_social_event_guest(uuid,text,text) to authenticated;
grant execute on function public.delete_social_event_guest(uuid) to authenticated;
grant execute on function public.add_public_social_event_guest(text,text) to anon, authenticated;
grant execute on function public.set_social_event_guest_status(text,text) to anon, authenticated;
