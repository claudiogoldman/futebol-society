'use client';

import { useEffect, useState } from 'react';
import { Clock3, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function WaitlistStatus() {
  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data: authData } = await supabase.auth.getSession();
    const user = authData?.session?.user;
    if (!user) return setItems([]);
    setSession(authData.session);

    const { data } = await supabase
      .from('game_waitlist')
      .select('id,game_id,queued_at,games:game_id(id,date,local,score_a,score_b)')
      .eq('user_id', user.id)
      .order('queued_at', { ascending: true });

    const active = (data || []).filter((item) => {
      const game = Array.isArray(item.games) ? item.games[0] : item.games;
      return game && game.score_a == null && game.score_b == null;
    });

    const enriched = await Promise.all(active.map(async (item) => {
      const { count } = await supabase
        .from('game_waitlist')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', item.game_id)
        .lte('queued_at', item.queued_at);
      return { ...item, position: count || 1 };
    }));

    setItems(enriched);
  };

  const leaveWaitlist = async (id) => {
    const { error } = await supabase.from('game_waitlist').delete().eq('id', id);
    if (error) return alert('Não foi possível sair da lista: ' + error.message);
    await load();
  };

  useEffect(() => {
    load();
    const onFocus = () => load();
    const interval = window.setInterval(load, 30000);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (!session || !items.length) return null;

  return (
    <>
      <button className="sf-waitlist-trigger" onClick={() => setOpen(true)} title="Minhas listas de suplentes">
        <Clock3 size={15} /> <span>Suplente ({items.length})</span>
      </button>

      {open && (
        <div className="sf-waitlist-backdrop" onClick={() => setOpen(false)}>
          <div className="sf-waitlist-panel" onClick={(event) => event.stopPropagation()}>
            <div className="sf-waitlist-head">
              <div>
                <strong>Lista de suplentes</strong>
                <small>Você será promovido automaticamente quando surgir uma vaga.</small>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="sf-waitlist-list">
              {items.map((item) => {
                const game = Array.isArray(item.games) ? item.games[0] : item.games;
                return (
                  <div className="sf-waitlist-row" key={item.id}>
                    <div>
                      <strong>{game.local || 'Local a definir'}</strong>
                      <small>{game.date ? new Date(`${game.date}T12:00:00`).toLocaleDateString('pt-BR') : 'Data a definir'}</small>
                    </div>
                    <span>#{item.position}</span>
                    <button className="sf-waitlist-leave" onClick={() => leaveWaitlist(item.id)}>Sair</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
