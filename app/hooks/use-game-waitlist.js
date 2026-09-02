'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

/**
 * Loads the authenticated user's active game waitlist entries and their FIFO
 * position. The position is resolved by the database RPC because waitlist
 * rows are intentionally protected by RLS.
 */
export function useGameWaitlist() {
  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    const { data: authData } = await supabase.auth.getSession();
    const user = authData?.session?.user;

    if (!user) {
      setSession(null);
      setItems([]);
      return;
    }

    setSession(authData.session);

    const { data, error } = await supabase
      .from('game_waitlist')
      .select('id,game_id,queued_at,games:game_id(id,date,local,score_a,score_b)')
      .eq('user_id', user.id)
      .order('queued_at', { ascending: true });

    if (error) {
      setItems([]);
      return;
    }

    const active = (data || []).filter((item) => {
      const game = Array.isArray(item.games) ? item.games[0] : item.games;
      return game && game.score_a == null && game.score_b == null;
    });

    const enriched = await Promise.all(active.map(async (item) => {
      const { data: position, error: positionError } = await supabase.rpc(
        'get_game_waitlist_position',
        { p_game_id: item.game_id },
      );

      return {
        ...item,
        position: positionError || position == null ? null : position,
      };
    }));

    setItems(enriched);
  }, []);

  const leaveWaitlist = useCallback(async (id) => {
    const { error } = await supabase.from('game_waitlist').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await load();
  }, [load]);

  useEffect(() => {
    load();

    const onFocus = () => load();
    const interval = window.setInterval(load, 30000);
    window.addEventListener('focus', onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  return { session, items, leaveWaitlist, reload: load };
}
