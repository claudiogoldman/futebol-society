create or replace function public.regenerate_social_event_public_token(p_event_id uuid)
returns text language plpgsql security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare v_group uuid; v_token text;
begin
  select group_id into v_group from public.social_events where id=p_event_id;
  if v_group is null or auth.uid() is null or not public.is_group_admin(v_group) then
    raise exception 'Evento não encontrado ou acesso não autorizado.' using errcode='42501';
  end if;
  v_token:=pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
  update public.social_events set
    public_token_hash=extensions.digest(pg_catalog.convert_to(v_token,'UTF8'),'sha256'),
    updated_at=pg_catalog.now()
  where id=p_event_id and status <> 'CANCELLED';
  if not found then raise exception 'Evento cancelado não permite gerar novo link.' using errcode='22023'; end if;
  return v_token;
end;
$$;
revoke all on function public.regenerate_social_event_public_token(uuid) from public, anon;
grant execute on function public.regenerate_social_event_public_token(uuid) to authenticated;
