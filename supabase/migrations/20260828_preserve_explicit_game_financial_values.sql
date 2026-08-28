create or replace function public.apply_group_defaults_to_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups%rowtype;
begin
  if new.group_id is null then return new; end if;
  select * into g from public.groups where id = new.group_id;
  if not found then return new; end if;

  -- Explicit values selected in the new-game form win over group defaults.
  if new.cost is null or (new.cost = 0 and g.default_cost is not null) then new.cost := coalesce(g.default_cost, new.cost, 0); end if;
  if new.goalkeeper_pays is null then new.goalkeeper_pays := coalesce(g.default_goalkeeper_pays, true); end if;
  if new.pix_key is null then new.pix_key := g.default_pix_key; end if;
  if new.pix_receiver_name is null then new.pix_receiver_name := g.default_pix_receiver_name; end if;
  if new.pix_city is null then new.pix_city := g.default_pix_city; end if;
  if new.pix_owner_id is null then new.pix_owner_id := g.default_pix_owner_id; end if;
  return new;
end;
$$;
