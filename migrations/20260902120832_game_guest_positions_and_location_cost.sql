-- Adds reusable venue pricing and position metadata for ad-hoc game guests.
alter table public.group_locations
  add column if not exists cost numeric(10,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.group_locations'::regclass
      and conname = 'group_locations_cost_nonnegative'
  ) then
    alter table public.group_locations
      add constraint group_locations_cost_nonnegative check (cost is null or cost >= 0);
  end if;
end $$;

update public.group_locations gl
set cost = g.default_cost
from public.groups g
where g.id = gl.group_id
  and gl.is_default = true
  and gl.cost is null
  and g.default_cost is not null;

drop function if exists public.add_game_guest(uuid, text, text, text);

create or replace function public.add_game_guest(
  p_game_id uuid,
  p_name text,
  p_email text default null,
  p_nationality_code text default 'BR',
  p_positions text[] default '{}'::text[]
)
returns table(profile_id uuid, guest_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := gen_random_uuid();
  v_guest_id uuid;
  v_game public.games;
  v_positions text[] := coalesce(p_positions, '{}'::text[]);
begin
  select * into v_game from public.games where id = p_game_id;
  if not found then raise exception 'Partida não encontrada'; end if;
  if not (v_game.created_by = auth.uid() or (v_game.group_id is not null and public.is_group_admin(v_game.group_id))) then
    raise exception 'Sem permissão para adicionar participante';
  end if;
  if exists (select 1 from unnest(v_positions) pos where pos not in ('goleiro','fixo','libero','meio','ala_esquerdo','ala_direito','pivo')) then
    raise exception 'Posição de convidado inválida';
  end if;
  if cardinality(v_positions) > 1 then
    raise exception 'Informe apenas uma posição para o convidado';
  end if;
  insert into public.profiles (id, name, nationality_code, rating, positions)
  values (v_profile_id, trim(p_name), coalesce(nullif(p_nationality_code,''),'BR'), 3, v_positions);
  insert into public.game_guests (game_id,name,email,nationality_code,created_by,profile_id)
  values (p_game_id,trim(p_name),nullif(lower(trim(p_email)),''),coalesce(nullif(p_nationality_code,''),'BR'),auth.uid(),v_profile_id)
  returning id into v_guest_id;
  insert into public.game_confirmations (game_id,user_id)
  values (p_game_id,v_profile_id);
  return query select v_profile_id,v_guest_id;
end;
$$;

grant execute on function public.add_game_guest(uuid,text,text,text,text[]) to authenticated;
