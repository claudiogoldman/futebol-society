create or replace function public.promote_next_game_waitlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
  v_next public.game_waitlist;
  v_count integer;
  v_confirmed_user_id uuid;
begin
  select * into v_game
  from public.games
  where id = old.game_id
  for update;

  if not found then return old; end if;
  if v_game.score_a is not null or v_game.score_b is not null then return old; end if;
  if v_game.max_players is null then return old; end if;

  select count(*) into v_count
  from public.game_confirmations
  where game_id = old.game_id;

  if v_count >= v_game.max_players then return old; end if;

  select * into v_next
  from public.game_waitlist w
  where w.game_id = old.game_id
    and not exists (
      select 1
      from public.game_confirmations c
      where c.game_id = w.game_id
        and c.user_id = w.user_id
    )
  order by w.queued_at, w.id
  limit 1
  for update skip locked;

  if not found then return old; end if;

  insert into public.game_confirmations (game_id, user_id)
  values (old.game_id, v_next.user_id)
  on conflict (game_id, user_id) do nothing
  returning user_id into v_confirmed_user_id;

  if v_confirmed_user_id is not null then
    insert into public.notifications (
      user_id,
      actor_id,
      type,
      title,
      body,
      game_id,
      group_id
    )
    values (
      v_next.user_id,
      null,
      'game_waitlist_promoted',
      'Você foi promovido da lista de espera',
      'Uma vaga ficou disponível e sua presença foi confirmada automaticamente.',
      old.game_id,
      v_game.group_id
    );
  end if;

  delete from public.game_waitlist
  where id = v_next.id;

  return old;
end;
$$;
