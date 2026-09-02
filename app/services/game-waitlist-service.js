import { supabase } from '../../lib/supabaseClient';

/**
 * Waitlist data access lives outside the UI hook so FIFO/RLS-sensitive
 * operations stay in one place.
 */
export async function loadMyActiveWaitlist(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('game_waitlist')
    .select('id,game_id,queued_at,games:game_id(id,date,local,score_a,score_b)')
    .eq('user_id', userId)
    .order('queued_at', { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).filter((item) => {
    const game = Array.isArray(item.games) ? item.games[0] : item.games;
    return game && game.score_a == null && game.score_b == null;
  });
}

export async function getMyWaitlistPosition(gameId) {
  const { data, error } = await supabase.rpc(
    'get_game_waitlist_position',
    { p_game_id: gameId },
  );

  if (error) throw new Error(error.message);
  return data == null ? null : data;
}

export async function leaveMyWaitlist(entryId) {
  const { error } = await supabase
    .from('game_waitlist')
    .delete()
    .eq('id', entryId);

  if (error) throw new Error(error.message);
}
