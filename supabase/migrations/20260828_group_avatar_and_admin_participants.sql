-- Avatar visual do grupo e participação avulsa em partidas de grupo.
alter table public.groups
  add column if not exists avatar text not null default '⚽';

-- Admin do grupo pode adicionar/remover participante diretamente em uma partida
-- vinculada ao grupo. Isso não cria vínculo em group_members.
drop policy if exists game_confirmations_insert_self on public.game_confirmations;
create policy game_confirmations_insert_self_or_group_admin
on public.game_confirmations
for insert to authenticated
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.games g
    where g.id = game_confirmations.game_id
      and g.group_id is not null
      and public.is_group_admin(g.group_id)
  )
);

drop policy if exists game_confirmations_delete_self on public.game_confirmations;
create policy game_confirmations_delete_self_or_group_admin
on public.game_confirmations
for delete to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.games g
    where g.id = game_confirmations.game_id
      and g.group_id is not null
      and public.is_group_admin(g.group_id)
  )
);