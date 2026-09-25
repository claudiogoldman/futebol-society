'use client';

import { useEffect, useMemo, useState } from 'react';
import { Shuffle, LockKeyhole, Unlock, RefreshCw } from 'lucide-react';
import TacticalPitch from './TacticalPitch';
import DrawHistory from './DrawHistory';
import { supabase } from '../../lib/supabaseClient';
import { computeRanking } from '../../lib/domain/ranking';
import { getGameDrawHistory, setValidGameDraw, deleteGameDraw, adjustGameDrawForPlayerReplacement, promoteDrawReserveToStarter, getGameParticipationPenalties, releaseGameParticipationPenalty } from '../../lib/services/society-service';

export default function GameTeamsSection({
  game, roster, activePlayers, canManage, hasTeams, playersPerTeam, reservesPerTeam,
  editingTeams, teamDraft, setTeamDraft, setEditingTeams, onDraw, onSaveTeams, onGameRefresh, isGoalkeeper,
}) {
  const [drawHistory, setDrawHistory] = useState([]);
  const [teams, setTeams] = useState({ teamA: game.teamA || [], teamB: game.teamB || [] });
  const [historyError, setHistoryError] = useState('');
  const [penalties, setPenalties] = useState([]);
  const [penaltyError, setPenaltyError] = useState('');
  const [releasingPenaltyId, setReleasingPenaltyId] = useState(null);
  const [adjustingDraw, setAdjustingDraw] = useState(false);

  const playersById = useMemo(() => new Map(roster.map((player) => [String(player.id), player])), [roster]);
  const resolvePlayers = (ids) => (Array.isArray(ids) ? ids : []).map((id) => playersById.get(String(id))).filter(Boolean);
  const canDraw = activePlayers.length >= 2;

  const loadHistory = async () => {
    if (!game?.id) return;
    const { data, error } = await getGameDrawHistory(game.id);
    if (error) {
      setHistoryError(error.message || 'Não foi possível carregar o histórico de sorteios.');
      return;
    }
    setHistoryError('');
    const history = data || [];
    setDrawHistory(history);
    const displayDraw = history.find((item) => item.is_valid);
    if (!(game.teamA?.length || game.teamB?.length) && displayDraw) {
      setTeams({
        teamA: [
          ...resolvePlayers(displayDraw.team_a_starters),
          ...resolvePlayers(displayDraw.team_a_reserves),
        ],
        teamB: [
          ...resolvePlayers(displayDraw.team_b_starters),
          ...resolvePlayers(displayDraw.team_b_reserves),
        ],
      });
    }
  };

  const loadPenalties = async () => {
    if (!game?.groupId) { setPenalties([]); return; }
    const { data, error } = await getGameParticipationPenalties(game.groupId);
    if (error) { setPenaltyError(error.message || 'Não foi possível carregar os bloqueios.'); return; }
    setPenaltyError('');
    setPenalties(data || []);
  };

  useEffect(() => {
    setTeams({ teamA: game.teamA || [], teamB: game.teamB || [] });
    loadHistory();
    loadPenalties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, game?.teamA, game?.teamB, game?.groupId]);

  const buildDrawPlayers = async () => {
    const basePlayers = activePlayers.map((player, index) => ({ ...player, _confirmationOrder: index }));
    if (!game?.groupId || basePlayers.length < 2) return basePlayers;

    const { data: gameRows, error: gamesError } = await supabase
      .from('games')
      .select('id,group_id,score_a,score_b')
      .eq('group_id', game.groupId);
    if (gamesError || !gameRows?.length) return basePlayers;

    const gameIds = gameRows.map((row) => row.id);
    const [teamsRes, goalsRes, ratingsRes] = await Promise.all([
      supabase.from('game_teams').select('game_id,user_id,team,role').in('game_id', gameIds),
      supabase.from('goals').select('game_id,user_id,goals').in('game_id', gameIds),
      supabase.from('ratings').select('game_id,rater_id,rated_id,score').in('game_id', gameIds),
    ]);
    if (teamsRes.error) return basePlayers;

    const profileById = new Map(roster.map((player) => [String(player.id), player]));
    const teamsByGame = new Map();
    (teamsRes.data || []).forEach((row) => {
      if (!teamsByGame.has(row.game_id)) teamsByGame.set(row.game_id, []);
      teamsByGame.get(row.game_id).push(row);
    });
    const scorersByGame = new Map();
    (goalsRes.data || []).forEach((row) => {
      if (!scorersByGame.has(row.game_id)) scorersByGame.set(row.game_id, {});
      scorersByGame.get(row.game_id)[row.user_id] = Number(row.goals) || 0;
    });
    const ratingsByGame = new Map();
    (ratingsRes.data || []).forEach((row) => {
      if (!ratingsByGame.has(row.game_id)) ratingsByGame.set(row.game_id, {});
      const byRater = ratingsByGame.get(row.game_id);
      if (!byRater[row.rater_id]) byRater[row.rater_id] = {};
      byRater[row.rater_id][row.rated_id] = row.score;
    });

    const completedGames = gameRows.filter((row) => row.score_a != null && row.score_b != null).map((row) => {
      const rows = teamsByGame.get(row.id) || [];
      return {
        result: { scoreA: Number(row.score_a), scoreB: Number(row.score_b), scorers: scorersByGame.get(row.id) || {} },
        assists: {},
        ratings: ratingsByGame.get(row.id) || {},
        teamA: rows.filter((teamRow) => teamRow.team === 'A' && (teamRow.role === 'starter' || teamRow.role == null)).map((teamRow) => profileById.get(String(teamRow.user_id))).filter(Boolean),
        teamB: rows.filter((teamRow) => teamRow.team === 'B' && (teamRow.role === 'starter' || teamRow.role == null)).map((teamRow) => profileById.get(String(teamRow.user_id))).filter(Boolean),
      };
    });

    const ranking = computeRanking(roster, completedGames);
    const rankingById = new Map(ranking.map((row) => [String(row.id), row]));
    const conceded = new Map();
    completedGames.forEach((completedGame) => {
      const scoreA = completedGame.result.scoreA;
      const scoreB = completedGame.result.scoreB;
      completedGame.teamA.forEach((player) => {
        if (!isGoalkeeper(player)) return;
        const current = conceded.get(String(player.id)) || { goals: 0, games: 0 };
        current.goals += scoreB;
        current.games += 1;
        conceded.set(String(player.id), current);
      });
      completedGame.teamB.forEach((player) => {
        if (!isGoalkeeper(player)) return;
        const current = conceded.get(String(player.id)) || { goals: 0, games: 0 };
        current.goals += scoreA;
        current.games += 1;
        conceded.set(String(player.id), current);
      });
    });

    return basePlayers.map((player) => {
      const stat = rankingById.get(String(player.id));
      const keeperStat = conceded.get(String(player.id));
      return {
        ...player,
        _rankingPoints: stat?.pontos || 0,
        _wins: stat?.vit || 0,
        _goalsConcededPerGame: keeperStat && keeperStat.games > 0 ? keeperStat.goals / keeperStat.games : null,
      };
    });
  };

  const handleDraw = async () => {
    if (!canDraw) return false;
    const drawPlayers = await buildDrawPlayers();
    const result = await onDraw(game.id, drawPlayers);
    await loadHistory();
    return result;
  };

  const handleSaveTeams = async () => {
    const ok = await onSaveTeams(game.id, teamDraft, activePlayers);
    if (ok) { setEditingTeams(false); await loadHistory(); }
    return ok;
  };

  const latestDraw = drawHistory[0] || null;
  const latestDrawIds = useMemo(() => [
    ...(latestDraw?.team_a_starters || []), ...(latestDraw?.team_b_starters || []),
    ...(latestDraw?.team_a_reserves || []), ...(latestDraw?.team_b_reserves || []),
  ].map(String), [latestDraw]);
  const activeIds = useMemo(() => new Set(activePlayers.map((player) => String(player.id))), [activePlayers]);
  const drawIdsSet = useMemo(() => new Set(latestDrawIds), [latestDrawIds]);
  const replacedOutPlayers = useMemo(() => resolvePlayers(latestDrawIds.filter((id) => !activeIds.has(id))), [latestDrawIds, activeIds, playersById]);
  const replacementInPlayers = useMemo(() => activePlayers.filter((player) => !drawIdsSet.has(String(player.id))), [activePlayers, drawIdsSet]);
  const canAdjustSingleReplacement = !!(
    canManage && latestDraw && !latestDraw.is_valid &&
    replacedOutPlayers.length === 1 && replacementInPlayers.length === 1 &&
    activePlayers.length === latestDrawIds.length
  );
  const latestStarterCountA = latestDraw ? (latestDraw.team_a_starters || []).length : 0;
  const latestStarterCountB = latestDraw ? (latestDraw.team_b_starters || []).length : 0;
  const latestReserveCount = latestDraw ? (latestDraw.team_a_reserves || []).length + (latestDraw.team_b_reserves || []).length : 0;
  const canPromoteSingleReserve = !!(
    canManage && latestDraw &&
    latestReserveCount === 1 &&
    ((latestStarterCountA === Math.max(1, Number(playersPerTeam) || 5) - 1 && latestStarterCountB === Math.max(1, Number(playersPerTeam) || 5)) ||
     (latestStarterCountB === Math.max(1, Number(playersPerTeam) || 5) - 1 && latestStarterCountA === Math.max(1, Number(playersPerTeam) || 5))) &&
    latestDrawIds.length === activePlayers.length
  );
  const displayHasTeams = !!(
    (teams.teamA?.length || teams.teamB?.length) || hasTeams ||
    drawHistory.some((item) => (item.team_a_starters || []).length || (item.team_b_starters || []).length)
  );

  const handlePromoteSingleReserve = async () => {
    if (!canPromoteSingleReserve) return false;
    setAdjustingDraw(true);
    setHistoryError('');
    const { data, error } = await promoteDrawReserveToStarter(game.id, latestDraw.id);
    if (error) {
      setHistoryError(error.message || 'Não foi possível colocar a reserva em campo.');
      setAdjustingDraw(false);
      return false;
    }
    await onGameRefresh?.();
    await loadHistory();
    setAdjustingDraw(false);
    return !!data;
  };

  const handleAdjustSingleReplacement = async () => {
    if (!canAdjustSingleReplacement) return false;
    const outPlayer = replacedOutPlayers[0];
    const inPlayer = replacementInPlayers[0];
    setAdjustingDraw(true);
    setHistoryError('');
    const { data, error } = await adjustGameDrawForPlayerReplacement(game.id, latestDraw.id, outPlayer.id, inPlayer.id);
    if (error) {
      setHistoryError(error.message || 'Não foi possível ajustar o sorteio.');
      setAdjustingDraw(false);
      return false;
    }
    await onGameRefresh?.();
    await loadHistory();
    setAdjustingDraw(false);
    return !!data;
  };

  const handleDeleteDraw = async (drawId) => {
    const selected = drawHistory.find((item) => String(item.id) === String(drawId));
    if (!selected) return false;
    const confirmed = window.confirm(selected.is_valid
      ? 'Excluir este sorteio válido? Os times atuais serão removidos e nenhum outro sorteio será validado automaticamente.'
      : 'Excluir este sorteio do histórico?');
    if (!confirmed) return false;
    const { data, error } = await deleteGameDraw(game.id, drawId);
    if (error) {
      setHistoryError(error.message || 'Não foi possível excluir o sorteio.');
      return false;
    }
    setTeams({ teamA: [], teamB: [] });
    setHistoryError('');
    await onGameRefresh?.();
    await loadHistory();
    return !!data;
  };

  const handleRestoreDraw = async (drawId) => {
    const { data, error } = await setValidGameDraw(game.id, drawId);
    if (error) {
      const code = error.message || '';
      setHistoryError(code.includes('DRAW_REQUIRES_FULL_ROSTER')
        ? `Não é possível tornar este sorteio válido porque a partida tem ${activePlayers.length} jogadores confirmados e o sorteio possui ${latestDrawIds.length}. Confirme o novo jogador antes de validar.`
        : code || 'Não foi possível restaurar o sorteio.');
      return false;
    }
    const selected = drawHistory.find((item) => String(item.id) === String(drawId));
    if (selected) setTeams({
      teamA: [
        ...resolvePlayers(selected.team_a_starters),
        ...resolvePlayers(selected.team_a_reserves),
      ],
      teamB: [
        ...resolvePlayers(selected.team_b_starters),
        ...resolvePlayers(selected.team_b_reserves),
      ],
    });
    setHistoryError('');
    await onGameRefresh?.();
    await loadHistory();
    return !!data;
  };

  const handleReleasePenalty = async (penaltyId) => {
    setReleasingPenaltyId(penaltyId);
    const { error } = await releaseGameParticipationPenalty(penaltyId);
    if (error) setPenaltyError(error.message || 'Não foi possível liberar o bloqueio.');
    else { await loadPenalties(); await onGameRefresh?.(); }
    setReleasingPenaltyId(null);
  };

  const blockedPlayers = penalties.map((penalty) => ({ penalty, player: playersById.get(String(penalty.user_id)) })).filter(({ player }) => !!player);

  return (
    <section className="sf-card">
      <div className="sf-card-title"><Shuffle size={16} /> Times</div>

      {blockedPlayers.length > 0 && (
        <div style={{ marginBottom: 12, padding: 10, border: '1px solid var(--sf-border)', borderRadius: 10, background: 'rgba(255, 193, 7, 0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, marginBottom: 7 }}><LockKeyhole size={15} /> Participações bloqueadas</div>
          <div className="sf-muted-sm" style={{ marginBottom: 8 }}>Estes jogadores não podem ser adicionados ao próximo jogo. Um administrador pode liberar a participação antecipadamente.</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {blockedPlayers.map(({ penalty, player }) => (
              <div key={penalty.id} className="sf-rsvp-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LockKeyhole size={14} /><span style={{ flex: 1 }}>{player.name} <span className="sf-muted-sm">· bloqueado</span></span>
                {canManage && <button type="button" className="sf-btn-ghost" disabled={releasingPenaltyId === penalty.id} onClick={() => handleReleasePenalty(penalty.id)} title="Liberar participação neste jogo"><Unlock size={14} /> {releasingPenaltyId === penalty.id ? 'Liberando...' : 'Liberar'}</button>}
              </div>
            ))}
          </div>
        </div>
      )}
      {canManage && penaltyError && <div className="sf-muted-sm" role="alert" style={{ marginBottom: 8 }}>{penaltyError}</div>}
      {historyError && <div className="sf-muted-sm" role="alert" style={{ marginBottom: 8 }}>{historyError}</div>}

      {canPromoteSingleReserve && (
        <div style={{ marginBottom: 12, padding: 12, border: '1px solid var(--sf-border)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, marginBottom: 5 }}><RefreshCw size={15} /> Corrigir distribuição</div>
          <div className="sf-muted-sm" style={{ marginBottom: 9 }}>Há uma vaga titular vazia e uma reserva no sorteio. A reserva será colocada em campo sem realizar um novo sorteio.</div>
          <button type="button" className="sf-btn-primary" disabled={adjustingDraw} onClick={handlePromoteSingleReserve}><RefreshCw size={16} /> {adjustingDraw ? 'Corrigindo...' : 'Colocar reserva em campo'}</button>
        </div>
      )}

      {canAdjustSingleReplacement && (
        <div style={{ marginBottom: 12, padding: 12, border: '1px solid var(--sf-border)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, marginBottom: 5 }}><RefreshCw size={15} /> Sorteio precisa de ajuste</div>
          <div className="sf-muted-sm" style={{ marginBottom: 9 }}>{replacedOutPlayers[0].name} saiu e {replacementInPlayers[0].name} entrou. É possível substituir somente este jogador, preservando os demais times.</div>
          <button type="button" className="sf-btn-primary" disabled={adjustingDraw} onClick={handleAdjustSingleReplacement}><RefreshCw size={16} /> {adjustingDraw ? 'Ajustando sorteio...' : 'Ajustar sorteio'}</button>
        </div>
      )}

      {!displayHasTeams && !canManage ? (
        <div className="sf-muted">O organizador ainda não sorteou os times.</div>
      ) : activePlayers.length < 2 && !displayHasTeams ? (
        <div className="sf-muted">Confirme pelo menos 2 jogadores para sortear.</div>
      ) : (
        <>
          {canManage && canDraw && <div className="sf-muted-sm" role="status" style={{ marginBottom: 8 }}>Sorteio disponível com {activePlayers.length} jogadores. A configuração da partida define o limite de cada time; com menos jogadores, a distribuição fica a mais equilibrada possível.</div>}
          {canManage && <div className="sf-modal-actions">
            <button type="button" className="sf-btn-primary" onClick={handleDraw} disabled={!canDraw}><Shuffle size={16} /> {displayHasTeams ? 'Sortear novamente' : 'Sortear times'}</button>
            {displayHasTeams && !editingTeams && !canAdjustSingleReplacement && <button type="button" className="sf-btn-ghost" onClick={() => {
              const draft = {};
              const currentA = new Map((teams.teamA || []).map((p) => [String(p.id), p]));
              const currentB = new Map((teams.teamB || []).map((p) => [String(p.id), p]));
              const starterCountA = (teams.teamA || []).filter((p) => p._teamRole !== 'reserve').length;
              const starterCountB = (teams.teamB || []).filter((p) => p._teamRole !== 'reserve').length;
              const reserveCountA = (teams.teamA || []).filter((p) => p._teamRole === 'reserve').length;
              const reserveCountB = (teams.teamB || []).filter((p) => p._teamRole === 'reserve').length;
              const reservesAllowed = activePlayers.length > playersPerTeam * 2;
              activePlayers.forEach((p) => {
                const id = String(p.id);
                if (currentA.has(id)) draft[p.id] = currentA.get(id)._teamRole === 'reserve' ? 'A-reserve' : 'A';
                else if (currentB.has(id)) draft[p.id] = currentB.get(id)._teamRole === 'reserve' ? 'B-reserve' : 'B';
                else if (reservesAllowed && reserveCountA < reservesPerTeam) draft[p.id] = 'A-reserve';
                else if (reservesAllowed && reserveCountB < reservesPerTeam) draft[p.id] = 'B-reserve';
                else draft[p.id] = starterCountA <= starterCountB ? 'A' : 'B';
              });
              setTeamDraft(draft);
              setEditingTeams(true);
            }}>Remanejar times</button>}
          </div>}
          {displayHasTeams && <>
            {editingTeams && <div className="sf-card" style={{ marginTop: 10, padding: 10, background: 'var(--pitch-dark)' }}>
              <div className="sf-card-subtitle" style={{ marginTop: 0 }}>Distribuição dos times</div>
              <div className="sf-muted-sm" style={{ marginBottom: 8 }}>
                Todos os jogadores confirmados aparecem aqui. Você pode colocar um novo jogador como titular ou reserva.
              </div>
              {activePlayers.map((p) => {
                const selected = teamDraft[p.id] || '';
                const canReserve = activePlayers.length > playersPerTeam * 2 && reservesPerTeam > 0;
                const choices = [
                  { value: 'A', label: 'A · Titular' },
                  { value: 'B', label: 'B · Titular' },
                  ...(canReserve ? [
                    { value: 'A-reserve', label: 'A · Reserva' },
                    { value: 'B-reserve', label: 'B · Reserva' },
                  ] : []),
                ];
                return (
                  <div key={p.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                      <span style={{ flex: 1, fontWeight: 600 }}>{p.name}{isGoalkeeper(p) ? ' (GOL)' : ''}</span>
                      <span className="sf-muted-sm" style={{ marginTop: 0 }}>
                        {selected ? choices.find((choice) => choice.value === selected)?.label : 'Escolha o time'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: canReserve ? '1fr 1fr' : '1fr 1fr', gap: 6 }}>
                      {choices.map((choice) => (
                        <button
                          key={choice.value}
                          type="button"
                          onClick={() => setTeamDraft((d) => ({ ...d, [p.id]: choice.value }))}
                          style={{
                            padding: '9px 6px',
                            borderRadius: 8,
                            border: selected === choice.value ? '2px solid var(--floodlight)' : '1px solid var(--line)',
                            background: selected === choice.value ? 'rgba(255,197,61,0.14)' : 'var(--pitch-dark)',
                            color: selected === choice.value ? 'var(--floodlight)' : 'var(--chalk-dim)',
                            fontWeight: selected === choice.value ? 700 : 500,
                            cursor: 'pointer',
                          }}
                        >
                          {choice.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="sf-modal-actions"><button type="button" className="sf-btn-ghost" onClick={() => setEditingTeams(false)}>Cancelar</button><button type="button" className="sf-btn-primary" onClick={handleSaveTeams}>Salvar times</button></div>
            </div>}
            <TacticalPitch teamA={teams.teamA} teamB={teams.teamB} playersPerTeam={playersPerTeam} reservesPerTeam={reservesPerTeam} />
            <div className="sf-teams-legend"><div><span className="sf-dot sf-dot-a" /> Time A — {teams.teamA.map((p) => isGoalkeeper(p) ? `${p.name} (GOL)` : p.name).join(', ')}</div><div><span className="sf-dot sf-dot-b" /> Time B — {teams.teamB.map((p) => isGoalkeeper(p) ? `${p.name} (GOL)` : p.name).join(', ')}</div></div>
          </>}
        </>
      )}

      <DrawHistory history={drawHistory} roster={roster} canManage={canManage} onRestore={handleRestoreDraw} onDelete={handleDeleteDraw} />
    </section>
  );
}
