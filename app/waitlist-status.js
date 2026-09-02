'use client';

import { useState } from 'react';
import { Clock3, X } from 'lucide-react';
import { useGameWaitlist } from './hooks/use-game-waitlist';

export default function WaitlistStatus() {
  const { session, items, leaveWaitlist } = useGameWaitlist();
  const [open, setOpen] = useState(false);

  if (!session || !items.length) return null;

  const handleLeave = async (id) => {
    try {
      await leaveWaitlist(id);
    } catch (error) {
      alert('Não foi possível sair da lista: ' + error.message);
    }
  };

  return (
    <>
      <button
        className="sf-waitlist-trigger"
        onClick={() => setOpen(true)}
        title="Minhas listas de suplentes"
        aria-label={`Abrir lista de suplentes (${items.length})`}
      >
        <Clock3 size={15} /> <span>Suplente ({items.length})</span>
      </button>

      {open && (
        <div className="sf-waitlist-backdrop" onClick={() => setOpen(false)}>
          <div className="sf-waitlist-panel" role="dialog" aria-modal="true" aria-labelledby="waitlist-title" onClick={(event) => event.stopPropagation()}>
            <div className="sf-waitlist-head">
              <div>
                <strong id="waitlist-title">Lista de suplentes</strong>
                <small>Você está inscrito e será promovido automaticamente quando surgir uma vaga.</small>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="sf-waitlist-list">
              {items.map((item) => {
                const game = Array.isArray(item.games) ? item.games[0] : item.games;
                return (
                  <div className="sf-waitlist-row" key={item.id}>
                    <div>
                      <strong>{game?.local || 'Local a definir'}</strong>
                      <small>{game?.date ? new Date(`${game.date}T12:00:00`).toLocaleDateString('pt-BR') : 'Data a definir'}</small>
                    </div>
                    <span>{item.position != null ? `#${item.position}` : 'suplente'}</span>
                    <button className="sf-waitlist-leave" onClick={() => handleLeave(item.id)}>Sair</button>
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
