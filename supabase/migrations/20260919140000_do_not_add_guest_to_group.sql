-- Guests are participants of a single game, not group members.
-- The confirmation trigger must not auto-add guest profile IDs to group_members.
create or replace function public.auto_add_confirmed_player_to_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_group_id uuid;
  v_is_guest boolean;
begin
  select exists (
    select 1
    from public.game_guests gg
    where gg.game_id = new.game_id
      and gg.profile_id = new.user_id
  ) into v_is_guest;

  if v_is_guest then
    return new;
  end if;

  select group_id
    into v_group_id
    from public.games
   where id = new.game_id;

  if v_group_id is not null then
    insert into public.group_members (group_id, user_id, role)
    values (v_group_id, new.user_id, 'member')
    on conflict (group_id, user_id) do nothing;
  end if;

  return new;
end;
$function$;
