'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Loader2, Share2, Shuffle, UserPlus, UserRound, X } from 'lucide-react';
import TacticalPitch from '../../../components/society/TacticalPitch';
import { drawTeams } from '../../lib/domain/game';
import { computeRanking } from '../../lib/domain/ranking';
import { createTeamSimulation, updateTeamSimulation } from '../../lib/services/society-service';

function nameOf(p) { return p?.nickname?.trim() || p?.name || '?'; }

function snapshotPlayer(p) {
  return {
    id: p.id,
    name: nameOf(p),
    nickname: p.nickname || null,
    avatar_url: p.avatar_url || null,
    positions: Array.isArray(p.positions) ? p.positions : [],
    rating: p.rating ?? 0,
    attr_ata: p.attr_ata ?? 50,
    attr_def: p.attr_def ?? 50,
    attr_for: p.attr_for ?? 50,
    attr_hab: p.attr_hab ?? 50,
  };
}

export default function TeamSimulation({
  group,
  members = [],
  games = [],
  initialPlayers = null,
  sourceGameId = null,
  sourceLabel = 'Grupo',
  onClose,
}) {
  const basePlayers = initialPlayers?.length ? initialPlayers : members;
  const [selectedIds, setSelectedIds] = useState(() => new Set(basePlayers.map((p) => String(p.id))));
  const [simulationId, setSimulationId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const saveTimer = useRef(null);

  const historicalRanking = useMemo(() => {
    return computeRanking(members, games, {
      wallMaxConcededGoals: group.wallMaxConcededGoals,
      wallPoints: group.wallPoints,
    });
  }, [members, games, group]);

  const rankingById = useMemo(
    () => Object.fromEntries(historicalRanking.map((item) => [String(item.id), item])),
    [historicalRanking],
  );

  const selectedPlayers = useMemo(() => {
    const pool = new Map(members.map((p) => [String(p.id), p]));
    basePlayers.forEach((p) => pool.set(String(p.id), p));
    return [...selectedIds].map((id) => pool.get(id)).filter(Boolean).map((player) => {
      const stats = rankingById[String(player.id)] || {};
      return {
        ...player,
        _rankingPoints: stats.pontos || 0,
        _wins: stats.vit || 0,
        _goals: stats.gols || 0,
        _assists: stats.assistencias || 0,
        _rating: stats.nota || 0,
      };
    });
  }, [selectedIds, members, basePlayers, rankingById]);

  const teams = useMemo(() => {
    if (selectedPlayers.length < 2) return { teamA: [], teamB: [] };
    const result = drawTeams(selectedPlayers, Math.random, {
      playersPerTeam: Math.ceil(selectedPlayers.length / 2) > 5 ? 5 : Math.ceil(selectedPlayers.length / 2),
      reservesPerTeam: selectedPlayers.length > 10 ? Math.max(0, Number(group.defaultReservesPerTeam) || 0) : 0,
      balanceRankingWeight: group.balanceRankingWeight,
      balanceWinsWeight: group.balanceWinsWeight,
      balanceGoalsWeight: group.balanceGoalsWeight,
      balanceAssistsWeight: group.balanceAssistsWeight,
      balanceRatingWeight: group.balanceRatingWeight,
      candidates: 40,
    });
    return result;
  }, [selectedPlayers, group]);

  const playerSnapshots = useMemo(() => selectedPlayers.map(snapshotPlayer), [selectedPlayers]);
  const snapshotMap = useMemo(() => Object.fromEntries(playerSnapshots.map((p) => [String(p.id), p])), [playerSnapshots]);
  const teamA = teams.teamA.map((p) => snapshotMap[String(p.id)] || snapshotPlayer(p));
  const teamB = teams.teamB.map((p) => snapshotMap[String(p.id)] || snapshotPlayer(p));

  const persist = async () => {
    if (selectedPlayers.length < 2) return;
    setSaving(true);
    try {
      const fields = {
        group_id: group.id,
        source_game_id: sourceGameId || null,
        title: sourceLabel ? `Simulação · ${sourceLabel}` : 'Simulação',
        player_ids: selectedPlayers.map((p) => p.id),
        players: playerSnapshots,
        team_a: teamA,
        team_b: teamB,
        source_label: sourceLabel,
      };
      const response = simulationId
        ? await updateTeamSimulation(simulationId, fields)
        : await createTeamSimulation(fields);
      if (!response.error && response.data?.id) setSimulationId(response.data.id);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (selectedPlayers.length < 2) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persist, 450);
    return () => clearTimeout(saveTimer.current);
  }, [selectedIds, teamA, teamB]);

  const togglePlayer = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(String(id))) next.delete(String(id));
      else next.add(String(id));
      return next;
    });
  };

  const share = async () => {
    if (!simulationId) {
      await persist();
      return;
    }
    const url = `${window.location.origin}/simulacao/${simulationId}`;
    const text = `⚽ ${group.name} — ${sourceLabel}\nVeja a simulação dos times: ${url}`;
    try {
      if (navigator.share) await navigator.share({ title: `Simulação · ${group.name}`, text, url });
      else {
        await navigator.clipboard.writeText(text);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 1800);
      }
    } catch {}
  };

  return (
    <div className="sf-card" style={{ marginBottom: 12 }}>
      <div className="sf-card-title">
        <Shuffle size={16} /> Simulação de times
        {saving && <span className="sf-muted-sm" style={{ marginLeft: 'auto' }}><Loader2 size={12} className="sf-spin" /> salvando</span>}
      </div>
      <div className="sf-muted-sm" style={{ marginBottom: 10 }}>
        Adicione ou retire jogadores. A divisão muda automaticamente. Com 2 jogadores já há 1×1; com 4, 2×2.
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {members.map((p) => {
          const on = selectedIds.has(String(p.id));
          return (
            <button key={p.id} type="button" onClick={() => togglePlayer(p.id)}
              className={on ? 'sf-btn-primary' : 'sf-btn-ghost'}
              style={{ width: 'auto', padding: '7px 10px', marginTop: 0, fontSize: 12 }}>
              {on ? <Check size={13} /> : <UserPlus size={13} />}
              {nameOf(p).split(' ')[0]}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>{selectedPlayers.length} jogador{selectedPlayers.length === 1 ? '' : 'es'}</strong>
        <span className="sf-muted-sm">A divisão é uma simulação, não altera a partida.</span>
      </div>

      {selectedPlayers.length < 2 ? (
        <div className="sf-empty" style={{ padding: '30px 10px' }}>
          <UserRound size={28} />
          <div>Adicione pelo menos 2 jogadores para formar os times.</div>
        </div>
      ) : (
        <>
          <TacticalPitch teamA={teamA} teamB={teamB} playersPerTeam={Math.ceil(selectedPlayers.length / 2) > 5 ? 5 : Math.ceil(selectedPlayers.length / 2)} reservesPerTeam={selectedPlayers.length > 10 ? Number(group.defaultReservesPerTeam) || 0 : 0} />
          <div className="sf-draw-preview-teams" style={{ marginTop: 10 }}>
            {[['A', teamA], ['B', teamB]].map(([label, team]) => (
              <div key={label} className="sf-card" style={{ marginBottom: 0 }}>
                <div className="sf-card-title">Time {label} · {team.length}</div>
                {team.map((p) => <div key={p.id} className="sf-rsvp-row" style={{ padding: '7px 9px', marginBottom: 5 }}><span>{nameOf(p)}</span></div>)}
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
        <button type="button" className="sf-btn-ghost" onClick={onClose}><X size={15} /> Fechar</button>
        <button type="button" className="sf-btn-primary" onClick={share} disabled={selectedPlayers.length < 2 || saving}>
          {shareCopied ? <><Copy size={15} /> Link copiado</> : <><Share2 size={15} /> Compartilhar</>}
        </button>
      </div>
      {simulationId && <div className="sf-muted-sm" style={{ justifyContent: 'center', marginTop: 7 }}>Salvo automaticamente · qualquer pessoa com o link pode visualizar.</div>}
    </div>
  );
}
