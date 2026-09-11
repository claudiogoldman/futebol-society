-- Enforce the post-match rating rules at the database boundary.
-- Ratings are only allowed after a game is completed, only by a confirmed
-- participant, only for another confirmed participant, and never self-rating.

drop policy if exists ratings_insert_game_participant on public.ratings;
drop policy if exists ratings_update_own on public.ratings;

create policy ratings_insert_game_participant_after_completion
on public.ratings
for insert
to authenticated
with check (
  auth.uid() = rater_id
  and rater_id <> rated_id
  and is_game_completed(game_id)
  and exists (
    select 1 from public.game_confirmations c
    where c.game_id = ratings.game_id and c.user_id = auth.uid()
  )
  and exists (
    select 1 from public.game_confirmations c
    where c.game_id = ratings.game_id and c.user_id = ratings.rated_id
  )
);

create policy ratings_update_own_after_completion
on public.ratings
for update
to authenticated
using (
  auth.uid() = rater_id
  and rater_id <> rated_id
  and is_game_completed(game_id)
  and exists (
    select 1 from public.game_confirmations c
    where c.game_id = ratings.game_id and c.user_id = auth.uid()
  )
  and exists (
    select 1 from public.game_confirmations c
    where c.game_id = ratings.game_id and c.user_id = ratings.rated_id
  )
)
with check (
  auth.uid() = rater_id
  and rater_id <> rated_id
  and is_game_completed(game_id)
  and exists (
    select 1 from public.game_confirmations c
    where c.game_id = ratings.game_id and c.user_id = auth.uid()
  )
  and exists (
    select 1 from public.game_confirmations c
    where c.game_id = ratings.game_id and c.user_id = ratings.rated_id
  )
);
