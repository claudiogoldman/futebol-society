'use client';

import { useEffect, useMemo, useState } from 'react';
import { Shuffle, LockKeyhole, Unlock } from 'lucide-react';
import TacticalPitch from './TacticalPitch';
import DrawHistory from './DrawHistory';
import { getGameDrawHistory, setValidGameDraw, getGameParticipationPenalties, releaseGameParticipationPenalty } from '../../lib/services/society-service';

export default function GameTeamsSection({
  game,
  roster,
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
  onGameRefresh,
  isGoalkeeper,
}) {
  const [drawHistory, setDrawHistory] = useState([]);
  const [teams, setTeams] = useState({ teamA: game.teamA || [], teamB: game.teamB || [] });
  const [historyError, setHistoryError] = useState('');
  const [penalties, setPenalties] = useState([]);
  const [penaltyError, setPenaltyError] = useState('');
  const [releasingPenaltyId, setReleasingPenaltyId] = useState(null);

  const playersById = useMemo(
    () => new Map(roster.map((player) => [String(player.id), player])),
    [roster]
  );

  const resolvePlayers = (ids) => (Array.isArray(ids) ? ids : [])
    .map((id) => playersById.get(String(id)))
    .filter(Boolean);

  const loadHistory = async () => {
    if (!game?.id) return;
    const { data, error } = await getGameDrawHistory(game.id);
    if (error) {
      setHistoryError(error.message || 'Não foi possível carregar o histórico de sorteios.');
      return;
    }
    setHistoryError('');
    setDrawHistory(data || []);
  };

  const loadPenalties = async () => {
    if (!game?.groupId) {
      setPenalties([]);
      return;
    }
    const { data, error } = await getGameParticipationPenalties(game.groupId);
    if (error) {
      setPenaltyError(error.message || 'Não foi possível carregar os bloqueios.');
      return;
    }
    setPenaltyError('');
    setPenalties(data || []);
  };

  useEffect(() => {
    setTeams({ teamA: game.teamA || [], teamB: game.teamB || [] });
    loadHistory();
    loadPenalties();
    // game.id identifies the history scope; team arrays are synchronized from parent below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, game?.teamA, game?.teamB, game?.groupId]);

  const handleDraw = async () => {
    const result = await onDraw(game.id, activePlayers);
    await loadHistory();
    return result;
  };

  const handleSaveTeams = async () => {
    const ok = await onSaveTeams(game.id, teamDraft, activePlayers);
    if (ok) {
      setEditingTeams(false);
      await loadHistory();
    }
    return ok;
  };

  const handleRestoreDraw = async (drawId) => {
    const { data, error } = await setValidGameDraw(game.id, drawId);
    if (error) {
      setHistoryError(error.message || 'Não foi possível restaurar o sorteio.');
      return false;
    }

    const selected = drawHistory.find((item) => String(item.id) === String(drawId));
    if (selected) {
      setTeams({
        teamA: resolvePlayers(selected.team_a_starters),
        teamB: resolvePlayers(selected.team_b_starters),
      });
    }
    setHistoryError('');
    await onGameRefresh?.();
    await loadHistory();
    return !!data;
  };

  const handleReleasePenalty = async (penaltyId) => {
    setReleasingPenaltyId(penaltyId);
    const { error } = await releaseGameParticipationPenalty(penaltyId);
    if (error) {
      setPenaltyError(error.message || 'Não foi possível liberar o bloqueio.');
    } else {
      await loadPenalties();
      await onGameRefresh?.();
    }
    setReleasingPenaltyId(null);
  };

  const blockedPlayers = penalties
    .map((penalty) => ({ penalty, player: playersById.get(String(penalty.user_id)) }))
    .filter(({ player }) => !!player);

  return (
    <section className="sf-card">
      <div className="sf-card-title"><Shuffle size={16} /> Times</div>

      {canManage && blockedPlayers.length > 0 && (
        <div style={{ marginBottom: 12, padding: 10, border: '1px solid var(--sf-border)', borderRadius: 10, background: 'rgba(255, 193, 7, 0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, marginBottom: 7 }}>
            <LockKeyhole size={15} /> Participações bloqueadas
          </div>
          <div className="sf-muted-sm" style={{ marginBottom: 8 }}>
            Estes jogadores não podem ser adicionados a este próximo jogo. O bloqueio pode ser liberado por um administrador.
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {blockedPlayers.map(({ penalty, player }) => (
              <div key={penalty.id} className="sf-rsvp-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LockKeyhole size={14} />
                <span style={{ flex: 1 }}>{player.name} <span className="sf-muted-sm">· próximo jogo</span></span>
                <button
                  type="button"
                  className="sf-btn-ghost"
                  disabled={releasingPenaltyId === penalty.id}
                  onClick={() => handleReleasePenalty(penalty.id)}
                  title="Liberar participação neste jogo"
                >
                  <Unlock size={14} /> {releasingPenaltyId === penalty.id ? 'Liberando...' : 'Liberar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {canManage && penaltyError && <div className="sf-muted-sm" role="alert" style={{ marginBottom: 8 }}>{penaltyError}</div>}
      {historyError && <div className="sf-muted-sm" role="alert" style={{ marginBottom: 8 }}>{historyError}</div>}
      {!hasTeams && !canManage ? (
        <div className="sf-muted">O organizador ainda não sorteou os times.</div>
      ) : activePlayers.length < 2 && !hasTeams ? (
        <div className="sf-muted">Confirme pelo menos 2 jogadores para sortear.</div>
      ) : (
        <>
          {canManage && (
            <div className="sf-modal-actions">
              <button type="button" className="sf-btn-primary" onClick={handleDraw}>
                <Shuffle size={16} /> {hasTeams ? 'Sortear novamente' : 'Sortear times'}
              </button>
              {hasTeams && !editingTeams && (
                <button type="button" className="sf-btn-ghost" onClick={() => {
                  const draft = {};
                  [...(teams.teamA || []), ...(teams.teamB || [])].forEach((p) => {
                    draft[p.id] = (teams.teamA || []).some((x) => x.id === p.id) ? 'A' : 'B';
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
                  {[...(teams.teamA || []), ...(teams.teamB || [])].map((p) => (
                    <div key={p.id} className="sf-cost-row">
                      <span>{p.name}{isGoalkeeper(p) ? ' (GOL)' : ''}</span>
                      <select className="sf-input-inline" value={teamDraft[p.id] || ''} onChange={(e) => setTeamDraft((d) => ({ ...d, [p.id]: e.target.value }))}>
                        <option value="A">Time A</option>
                        <option value="B">Time B</option>
                      </select>
                    </div>
                  ))}
                  <div className="sf-modal-actions">
                    <button type="button" className="sf-btn-ghost" onClick={() => setEditingTeams(false)}>Cancelar</button>
                    <button type="button" className="sf-btn-primary" onClick={handleSaveTeams}>Salvar times</button>
                  </div>
                </div>
              )}
              <TacticalPitch
                teamA={teams.teamA}
                teamB={teams.teamB}
                playersPerTeam={playersPerTeam}
                reservesPerTeam={reservesPerTeam}
              />
              <div className="sf-teams-legend">
                <div><span className="sf-dot sf-dot-a" /> Time A — {teams.teamA.map((p) => isGoalkeeper(p) ? `${p.name} (GOL)` : p.name).join(', ')}</div>
                <div><span className="sf-dot sf-dot-b" /> Time B — {teams.teamB.map((p) => isGoalkeeper(p) ? `${p.name} (GOL)` : p.name).join(', ')}</div>
              </div>
            </>
          )}
        </>
      )}

      <DrawHistory
        history={drawHistory}
        roster={roster}
        canManage={canManage}
        onRestore={handleRestoreDraw}
      />
    </section>
  );
}
