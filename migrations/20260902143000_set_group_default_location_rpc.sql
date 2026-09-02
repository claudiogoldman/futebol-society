create or replace function public.set_group_default_location(
  p_group_id uuid,
  p_location_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_group_admin(p_group_id) then
    raise exception 'not authorized';
  end if;

  if p_location_id is not null
     and not exists (
       select 1
       from group_locations
       where id = p_location_id
         and group_id = p_group_id
     ) then
    raise exception 'location does not belong to group';
  end if;

  update group_locations
     set is_default = false
   where group_id = p_group_id;

  if p_location_id is not null then
    update group_locations
       set is_default = true
     where id = p_location_id
       and group_id = p_group_id;
  end if;
end;
$$;

revoke all on function public.set_group_default_location(uuid, uuid) from public;
grant execute on function public.set_group_default_location(uuid, uuid) to authenticated;
