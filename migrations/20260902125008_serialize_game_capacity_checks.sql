CREATE OR REPLACE FUNCTION public.join_game_by_token(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_game public.games;
  v_participants integer;
begin
  select * into v_game from public.games where invite_token = p_token for update;
  if not found then raise exception 'invalid invite token'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'Perfil não encontrado'; end if;

  if not exists (select 1 from public.game_confirmations where game_id = v_game.id and user_id = auth.uid()) then
    select count(*) into v_participants from public.game_confirmations where game_id = v_game.id;
    if v_game.max_players is not null and v_participants >= v_game.max_players then raise exception 'Partida lotada'; end if;
  end if;

  insert into public.game_confirmations (game_id, user_id)
  values (v_game.id, auth.uid()) on conflict (game_id, user_id) do nothing;
  return v_game.id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.add_game_guest(
  p_game_id uuid,
  p_name text,
  p_email text DEFAULT NULL,
  p_nationality_code text DEFAULT 'BR',
  p_positions text[] DEFAULT '{}'::text[]
)
RETURNS TABLE(profile_id uuid, guest_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_profile_id uuid := gen_random_uuid();
  v_guest_id uuid;
  v_game public.games;
  v_positions text[] := coalesce(p_positions, '{}'::text[]);
  v_participants integer;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'Partida não encontrada'; end if;
  if not (v_game.created_by = auth.uid() or (v_game.group_id is not null and public.is_group_admin(v_game.group_id))) then raise exception 'Sem permissão para adicionar participante'; end if;

  select count(*) into v_participants from public.game_confirmations where game_id = p_game_id;
  if v_game.max_players is not null and v_participants >= v_game.max_players then raise exception 'Partida lotada'; end if;
  if trim(coalesce(p_name,'')) = '' then raise exception 'Nome do convidado é obrigatório'; end if;
  if exists (select 1 from unnest(v_positions) pos where pos not in ('goleiro','fixo','libero','meio','ala_esquerdo','ala_direito','pivo')) then raise exception 'Posição de convidado inválida'; end if;
  if cardinality(v_positions) > 1 then raise exception 'Informe apenas uma posição para o convidado'; end if;

  insert into public.profiles (id, name, nationality_code, rating, positions)
  values (v_profile_id, trim(p_name), coalesce(nullif(p_nationality_code,''),'BR'), 3, v_positions);
  insert into public.game_guests (game_id,name,email,nationality_code,created_by,profile_id)
  values (p_game_id,trim(p_name),nullif(lower(trim(p_email)),''),coalesce(nullif(p_nationality_code,''),'BR'),auth.uid(),v_profile_id)
  returning id into v_guest_id;
  insert into public.game_confirmations (game_id,user_id) values (p_game_id,v_profile_id);
  return query select v_profile_id,v_guest_id;
end;
$function$;
