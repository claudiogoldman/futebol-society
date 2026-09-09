alter table public.games add column if not exists players_per_team integer;
alter table public.games add column if not exists reserves_per_team integer;

update public.games
set players_per_team = greatest(1, floor(coalesce(max_players, 10) / 2.0)::integer),
    reserves_per_team = 0
where players_per_team is null;

alter table public.games alter column players_per_team set default 5;
alter table public.games alter column reserves_per_team set default 0;
alter table public.games alter column players_per_team set not null;
alter table public.games alter column reserves_per_team set not null;

alter table public.games drop constraint if exists games_players_per_team_check;
alter table public.games add constraint games_players_per_team_check check (players_per_team between 1 and 11);
alter table public.games drop constraint if exists games_reserves_per_team_check;
alter table public.games add constraint games_reserves_per_team_check check (reserves_per_team between 0 and 20);

alter table public.game_teams add column if not exists role text;
update public.game_teams set role = 'starter' where role is null;
alter table public.game_teams alter column role set default 'starter';
alter table public.game_teams alter column role set not null;
alter table public.game_teams drop constraint if exists game_teams_role_check;
alter table public.game_teams add constraint game_teams_role_check check (role in ('starter','reserve'));

create or replace function public.set_game_teams(
  p_game_id uuid,
  p_team_a uuid[],
  p_team_b uuid[],
  p_team_a_reserves uuid[] default array[]::uuid[],
  p_team_b_reserves uuid[] default array[]::uuid[]
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_game public.games%rowtype;
  v_is_admin boolean;
  v_all_ids uuid[];
  v_distinct_count integer;
  v_starter_limit integer;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'Partida não encontrada'; end if;
  v_is_admin := v_game.group_id is not null and public.is_group_admin(v_game.group_id);
  if not (v_game.created_by = auth.uid() or v_is_admin) then raise exception 'Somente organizador ou administrador pode definir os times'; end if;
  if (v_game.score_a is not null or v_game.score_b is not null) and not v_is_admin then raise exception 'Após o encerramento, somente administradores podem alterar os times'; end if;
  if coalesce(cardinality(p_team_a),0)=0 or coalesce(cardinality(p_team_b),0)=0 then raise exception 'Os dois times precisam ter jogadores'; end if;
  if coalesce(cardinality(p_team_a),0) <> coalesce(cardinality(p_team_b),0) then raise exception 'Os dois times precisam ter o mesmo número de titulares'; end if;
  v_starter_limit := coalesce(v_game.players_per_team, floor(coalesce(v_game.max_players,10)/2.0)::integer);
  if cardinality(p_team_a) > v_starter_limit or cardinality(p_team_b) > v_starter_limit then raise exception 'Quantidade de titulares excede a configuração da partida'; end if;
  if coalesce(cardinality(p_team_a_reserves),0) <> coalesce(cardinality(p_team_b_reserves),0) then raise exception 'Os dois times precisam ter o mesmo número de reservas'; end if;
  if coalesce(cardinality(p_team_a_reserves),0) > coalesce(v_game.reserves_per_team,0) then raise exception 'Quantidade de reservas excede a configuração da partida'; end if;

  v_all_ids := coalesce(p_team_a,array[]::uuid[]) || coalesce(p_team_b,array[]::uuid[]) || coalesce(p_team_a_reserves,array[]::uuid[]) || coalesce(p_team_b_reserves,array[]::uuid[]);
  select count(*) into v_distinct_count from (select distinct unnest(v_all_ids)) x;
  if v_distinct_count <> cardinality(v_all_ids) then raise exception 'Um jogador não pode estar em dois grupos do sorteio'; end if;
  if exists (select 1 from unnest(v_all_ids) as x where not exists (select 1 from public.game_confirmations c where c.game_id=p_game_id and c.user_id=x)) then raise exception 'Todos os jogadores dos times precisam estar confirmados na partida'; end if;

  delete from public.game_teams where game_id=p_game_id;
  insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'A','starter' from unnest(p_team_a) x;
  insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'B','starter' from unnest(p_team_b) x;
  insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'A','reserve' from unnest(p_team_a_reserves) x;
  insert into public.game_teams(game_id,user_id,team,role) select p_game_id,x,'B','reserve' from unnest(p_team_b_reserves) x;
  return true;
end;
$function$;
