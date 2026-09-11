'use client';

import { Shuffle } from 'lucide-react';
import TacticalPitch from './TacticalPitch';

export default function GameTeamsSection({
  game,
  activePlayers,
  canManage,
  hasTeams,
  playersPerTeam,
  reservesPerTeam,
  editingTeams,
  teamDraft,
  setTeamDraft,
  setEditingTeams,
  onDraw,
  onSaveTeams,
  isGoalkeeper,
}) {
  return (
    <section className="sf-card">
      <div className="sf-card-title"><Shuffle size={16} /> Times</div>
      {!hasTeams && !canManage ? (
        <div className="sf-muted">O organizador ainda não sorteou os times.</div>
      ) : activePlayers.length < 2 && !hasTeams ? (
        <div className="sf-muted">Confirme pelo menos 2 jogadores para sortear.</div>
      ) : (
        <>
          {canManage && (
            <div className="sf-modal-actions">
              <button className="sf-btn-primary" onClick={() => onDraw(game.id, activePlayers)}>
                <Shuffle size={16} /> {hasTeams ? 'Sortear novamente' : 'Sortear times'}
              </button>
              {hasTeams && !editingTeams && (
                <button className="sf-btn-ghost" onClick={() => {
                  const draft = {};
                  [...(game.teamA || []), ...(game.teamB || [])].forEach((p) => {
                    draft[p.id] = (game.teamA || []).some((x) => x.id === p.id) ? 'A' : 'B';
                  });
                  setTeamDraft(draft);
                  setEditingTeams(true);
                }}>Remanejar times</button>
              )}
            </div>
          )}
          {hasTeams && (
            <>
              {editingTeams && (
                <div className="sf-card" style={{ marginTop: 10, padding: 10, background: 'var(--pitch-dark)' }}>
                  <div className="sf-card-subtitle" style={{ marginTop: 0 }}>Distribuição dos times</div>
                  {[...(game.teamA || []), ...(game.teamB || [])].map((p) => (
                    <div key={p.id} className="sf-cost-row">
                      <span>{p.name}{isGoalkeeper(p) ? ' (GOL)' : ''}</span>
                      <select className="sf-input-inline" value={teamDraft[p.id] || ''} onChange={(e) => setTeamDraft((d) => ({ ...d, [p.id]: e.target.value }))}>
                        <option value="A">Time A</option><option value="B">Time B</option>
                      </select>
                    </div>
                  ))}
                  <div className="sf-modal-actions">
                    <button className="sf-btn-ghost" onClick={() => setEditingTeams(false)}>Cancelar</button>
                    <button className="sf-btn-primary" onClick={async () => { const ok = await onSaveTeams(game.id, teamDraft, activePlayers); if (ok) setEditingTeams(false); }}>Salvar times</button>
                  </div>
                </div>
              )}
              <TacticalPitch teamA={game.teamA} teamB={game.teamB} playersPerTeam={playersPerTeam} reservesPerTeam={reservesPerTeam} />
              <div className="sf-teams-legend">
                <div><span className="sf-dot sf-dot-a" /> Time A — {game.teamA.map((p) => isGoalkeeper(p) ? `${p.name} (GOL)` : p.name).join(', ')}</div>
                <div><span className="sf-dot sf-dot-b" /> Time B — {game.teamB.map((p) => isGoalkeeper(p) ? `${p.name} (GOL)` : p.name).join(', ')}</div>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
