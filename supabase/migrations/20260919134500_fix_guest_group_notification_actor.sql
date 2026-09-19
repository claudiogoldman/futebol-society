-- Fix group-member notifications when a guest is auto-added.
-- Guest profile IDs are not auth.users IDs, so they cannot be used as actor_id.
create or replace function private.notify_group_member_joined()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  target uuid;
  actor uuid;
begin
  if exists (select 1 from auth.users u where u.id = new.user_id) then
    actor := new.user_id;
  else
    actor := auth.uid();
  end if;

  for target in
    select gm.user_id
      from public.group_members gm
     where gm.group_id = new.group_id
       and (actor is null or gm.user_id <> actor)
  loop
    insert into public.notifications(
      user_id,
      actor_id,
      type,
      title,
      body,
      group_id
    )
    values(
      target,
      actor,
      'group_member_joined',
      'Novo integrante no grupo',
      'Um novo jogador entrou no grupo.',
      new.group_id
    );
  end loop;

  return new;
end;
$function$;
