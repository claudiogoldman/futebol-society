create or replace function public.ensure_single_default_group_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_default then
    update public.group_locations
       set is_default = false
     where group_id = new.group_id
       and id <> new.id
       and is_default = true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_group_locations_single_default on public.group_locations;
create trigger trg_group_locations_single_default
before insert or update of group_id, is_default on public.group_locations
for each row
when (new.is_default = true)
execute function public.ensure_single_default_group_location();
