'use client';

import { useMemo } from 'react';
import { Clock3, Star, Trophy, Users } from 'lucide-react';
import { calculateTeamBalance } from '../../lib/domain/game';

function drawIds(value) {
  return Array.isArray(value) ? value.map((id) => String(id)) : [];
}

function formatDrawDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function DrawHistory({ history = [], roster = [], canManage = false, onRestore }) {
  const playersById = useMemo(() => new Map(roster.map((p) => [String(p.id), p])), [roster]);

  const resolvePlayers = (value) => drawIds(value).map((id) => playersById.get(id)).filter(Boolean);
  const teamNames = (value) => resolvePlayers(value).map((p) => p.nickname?.trim() || p.name || '?');
  const balanceFor = (item) => {
    const a = resolvePlayers(item.team_a_starters);
    const b = resolvePlayers(item.team_b_starters);
    if (a.length < 1 || b.length < 1) return null;
    return calculateTeamBalance(a, b)?.balance ?? null;
  };

  if (!history.length) {
    return (
      <section className="sf-card">
        <div className="sf-card-title"><Clock3 size={16} /> Sorteios</div>
        <div className="sf-muted">Nenhum sorteio foi registrado ainda.</div>
        <div className="sf-muted-sm" style={{ marginTop: 6 }}>Cada novo sorteio ficará salvo aqui e poderá ser recuperado pelo organizador.</div>
      </section>
    );
  }

  return (
    <section className="sf-card" id="sf-game-draw-history">
      <div className="sf-card-title"><Clock3 size={16} /> Histórico de sorteios</div>
      <div className="sf-muted-sm" style={{ marginBottom: 10 }}>O sorteio marcado como válido é o time oficial da partida.</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {history.map((item) => {
          const balance = balanceFor(item);
          const teamA = teamNames(item.team_a_starters);
          const teamB = teamNames(item.team_b_starters);
          const reservesA = teamNames(item.team_a_reserves);
          const reservesB = teamNames(item.team_b_reserves);
          return (
            <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, background: item.is_valid ? 'rgba(255,197,61,.08)' : 'rgba(255,255,255,.02)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', fontWeight: 700 }}>
                  <Trophy size={15} /> Sorteio #{item.draw_number}
                  {item.is_valid && <span className="sf-waitlist-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Star size={11} /> VÁLIDO</span>}
                </div>
                {balance != null && <span className="sf-mono-value">{Math.round(balance)}% equilíbrio</span>}
              </div>
              <div className="sf-muted-sm" style={{ marginTop: 5 }}><Clock3 size={12} style={{ verticalAlign: '-2px' }} /> {formatDrawDate(item.created_at)} · <Users size={12} style={{ verticalAlign: '-2px' }} /> {item.players_per_team} titulares{item.reserves_per_team ? ` + ${item.reserves_per_team} reserva${item.reserves_per_team === 1 ? '' : 's'}` : ''}</div>
              <div className="sf-muted-sm" style={{ marginTop: 8, lineHeight: 1.5 }}>
                <div><strong>TIME A</strong> — {teamA.join(', ') || '—'}</div>
                <div><strong>TIME B</strong> — {teamB.join(', ') || '—'}</div>
                {reservesA.length > 0 && <div>Reservas A — {reservesA.join(', ')}</div>}
                {reservesB.length > 0 && <div>Reservas B — {reservesB.join(', ')}</div>}
              </div>
              {canManage && !item.is_valid && (
                <div className="sf-modal-actions" style={{ marginTop: 8 }}>
                  <button type="button" className="sf-btn-primary" onClick={() => onRestore?.(item.id)}><Star size={15} /> Tornar válido</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
