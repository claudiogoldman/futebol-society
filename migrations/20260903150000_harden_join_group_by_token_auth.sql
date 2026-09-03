-- Defense in depth: group invite redemption must reject unauthenticated callers
-- and callers without an application profile, even though EXECUTE is restricted
-- to the authenticated role.

CREATE OR REPLACE FUNCTION public.join_group_by_token(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_group_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Perfil não encontrado';
  end if;

  select id into v_group_id
  from public.groups
  where invite_token = p_token;

  if v_group_id is null then
    raise exception 'invalid group invite token';
  end if;

  insert into public.group_members (group_id, user_id)
  values (v_group_id, auth.uid())
  on conflict do nothing;

  return v_group_id;
end;
$$;

REVOKE ALL ON FUNCTION public.join_group_by_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_group_by_token(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.join_group_by_token(uuid) TO authenticated;
