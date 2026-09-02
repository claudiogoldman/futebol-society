'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  getMyWaitlistPosition,
  leaveMyWaitlist,
  loadMyActiveWaitlist,
} from '../services/game-waitlist-service';

/**
 * Presentation-facing waitlist state. Database access is delegated to the
 * service so RLS-sensitive queries and FIFO position logic stay centralized.
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

    try {
      const active = await loadMyActiveWaitlist(user.id);
      const enriched = await Promise.all(active.map(async (item) => {
        try {
          return { ...item, position: await getMyWaitlistPosition(item.game_id) };
        } catch {
          return { ...item, position: null };
        }
      }));
      setItems(enriched);
    } catch {
      setItems([]);
    }
  }, []);

  const leaveWaitlist = useCallback(async (id) => {
    await leaveMyWaitlist(id);
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
