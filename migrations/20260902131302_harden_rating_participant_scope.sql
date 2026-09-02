-- Integrity rule: ratings are only allowed between participants of the same game.
-- The rater must be confirmed in the game, and the rated player must also be
-- confirmed in the game (registered player or guest profile).

DROP POLICY IF EXISTS ratings_insert_own ON public.ratings;

CREATE POLICY ratings_insert_game_participant ON public.ratings
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = rater_id
  AND EXISTS (
    SELECT 1
    FROM public.game_confirmations c
    WHERE c.game_id = ratings.game_id
      AND c.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.game_confirmations c
    WHERE c.game_id = ratings.game_id
      AND c.user_id = ratings.rated_id
  )
);

ALTER POLICY ratings_update_own ON public.ratings
USING (
  auth.uid() = rater_id
  AND EXISTS (
    SELECT 1
    FROM public.game_confirmations c
    WHERE c.game_id = ratings.game_id
      AND c.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.game_confirmations c
    WHERE c.game_id = ratings.game_id
      AND c.user_id = ratings.rated_id
  )
)
WITH CHECK (
  auth.uid() = rater_id
  AND EXISTS (
    SELECT 1
    FROM public.game_confirmations c
    WHERE c.game_id = ratings.game_id
      AND c.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.game_confirmations c
    WHERE c.game_id = ratings.game_id
      AND c.user_id = ratings.rated_id
  )
);
