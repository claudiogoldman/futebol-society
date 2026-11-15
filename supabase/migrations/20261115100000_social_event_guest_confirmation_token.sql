-- Allow group administrators to issue a fresh individual confirmation link.
-- The previous token is invalidated; only its SHA-256 hash is persisted.
create or replace function public.regenerate_social_event_guest_confirmation_token(p_guest_id uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare
  v_event_id uuid;
  v_group_id uuid;
  v_status text;
  v_event_date date;
  v_event_time time without time zone;
  v_token text;
begin
  select g.event_id, e.group_id, e.status, e.event_date, e.event_time
    into v_event_id, v_group_id, v_status, v_event_date, v_event_time
    from public.social_event_guests g
    join public.social_events e on e.id = g.event_id
   where g.id = p_guest_id
   for update of g, e;

  if v_event_id is null or auth.uid() is null or not public.is_group_admin(v_group_id) then
    raise exception 'Convidado não encontrado ou acesso não autorizado.' using errcode = '42501';
  end if;

  if v_status <> 'OPEN'
     or ((v_event_date + v_event_time) at time zone 'America/Sao_Paulo') <= pg_catalog.clock_timestamp() then
    raise exception 'O link individual só pode ser renovado enquanto o evento estiver aberto.' using errcode = '22023';
  end if;

  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');

  update public.social_event_guests
     set confirmation_token_hash = extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256'),
         updated_at = pg_catalog.clock_timestamp()
   where id = p_guest_id;

  return v_token;
end;
$$;

revoke all on function public.regenerate_social_event_guest_confirmation_token(uuid) from public, anon;
grant execute on function public.regenerate_social_event_guest_confirmation_token(uuid) to authenticated;
