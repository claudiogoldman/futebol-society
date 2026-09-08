-- Game chat v1: one persistent chat room per game.
-- Access rule: only authenticated users who are members/confirmed participants of the game may read/write messages.
-- Team-private chat is intentionally deferred to a later migration after team membership rules are finalized.

create table if not exists public.game_chat_messages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_chat_messages_message_not_blank check (length(btrim(message)) > 0),
  constraint game_chat_messages_message_max_length check (length(message) <= 2000)
);

create index if not exists idx_game_chat_messages_game_created
  on public.game_chat_messages(game_id, created_at);

alter table public.game_chat_messages enable row level security;

create policy game_chat_messages_select_member
  on public.game_chat_messages for select to authenticated
  using (public.is_game_member(game_id));

create policy game_chat_messages_insert_member
  on public.game_chat_messages for insert to authenticated
  with check (auth.uid() = user_id and public.is_game_member(game_id));

create policy game_chat_messages_update_author
  on public.game_chat_messages for update to authenticated
  using (auth.uid() = user_id and public.is_game_member(game_id))
  with check (auth.uid() = user_id and public.is_game_member(game_id));

create policy game_chat_messages_delete_author
  on public.game_chat_messages for delete to authenticated
  using (auth.uid() = user_id and public.is_game_member(game_id));

-- Keep updated_at correct when a message is edited.
create or replace function public.set_game_chat_message_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_game_chat_message_updated_at on public.game_chat_messages;
create trigger trg_game_chat_message_updated_at
before update on public.game_chat_messages
for each row execute function public.set_game_chat_message_updated_at();

-- Realtime publication is enabled for the message table when available.
do $$
begin
  alter publication supabase_realtime add table public.game_chat_messages;
exception
  when duplicate_object then null;
end $$;
