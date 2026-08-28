create or replace function public.apply_group_defaults_to_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups%rowtype;
begin
  if new.group_id is null then
    return new;
  end if;

  select * into g from public.groups where id = new.group_id;
  if not found then
    return new;
  end if;

  -- A game linked to a group starts as a snapshot of the group's financial
  -- defaults. Later edits to the game remain independent from the group.
  new.cost := coalesce(g.default_cost, 0);
  new.goalkeeper_pays := coalesce(g.default_goalkeeper_pays, true);
  new.pix_key := g.default_pix_key;
  new.pix_receiver_name := g.default_pix_receiver_name;
  new.pix_city := g.default_pix_city;
  new.pix_owner_id := g.default_pix_owner_id;

  return new;
end;
$$;

drop trigger if exists games_apply_group_defaults on public.games;
create trigger games_apply_group_defaults
before insert on public.games
for each row execute function public.apply_group_defaults_to_game();
