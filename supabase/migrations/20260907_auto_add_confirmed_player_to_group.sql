create or replace function public.auto_add_confirmed_player_to_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  select group_id into v_group_id
  from public.games
  where id = new.game_id;

  if v_group_id is not null then
    insert into public.group_members (group_id, user_id, role)
    values (v_group_id, new.user_id, 'member')
    on conflict (group_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.auto_add_confirmed_player_to_group() from public, anon;
grant execute on function public.auto_add_confirmed_player_to_group() to authenticated;

drop trigger if exists trg_auto_add_confirmed_player_to_group on public.game_confirmations;
create trigger trg_auto_add_confirmed_player_to_group
after insert on public.game_confirmations
for each row
execute function public.auto_add_confirmed_player_to_group();
