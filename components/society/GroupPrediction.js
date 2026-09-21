'use client';

import { useMemo } from 'react';
import { Users, Shuffle } from 'lucide-react';
import TacticalPitch from './TacticalPitch';
import { drawTeams } from '../../lib/domain/game';
import { computeRanking } from '../../lib/domain/ranking';

const PREDICTION_PLAYERS = 12;

function displayName(player) {
  const nickname = typeof player?.nickname === 'string' ? player.nickname.trim() : '';
  return nickname || player?.name || '?';
}

function seededRandom(seed) {
  let value = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    value ^= seed.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return () => {
    value += value << 13;
    value ^= value >>> 17;
    value += value << 5;
    return ((value >>> 0) % 100000) / 100000;
  };
}

function buildPrediction(members, rankingById, criterion) {
  const ordered = [...members].sort((a, b) => {
    if (criterion === 'frequency') {
      const frequencyDifference = (rankingById[b.id]?.jogos || 0) - (rankingById[a.id]?.jogos || 0);
      if (frequencyDifference !== 0) return frequencyDifference;
    }
    const aPosition = rankingById[a.id]?.position || Number.MAX_SAFE_INTEGER;
    const bPosition = rankingById[b.id]?.position || Number.MAX_SAFE_INTEGER;
    if (aPosition !== bPosition) return aPosition - bPosition;
    return displayName(a).localeCompare(displayName(b));
  });

  const selected = ordered.slice(0, Math.min(PREDICTION_PLAYERS, ordered.length));
  const reserves = ordered.slice(selected.length);
  const playersPerTeam = Math.max(1, Math.ceil(selected.length / 2));
  const enriched = selected.map((player) => ({
    ...player,
    _rankingPoints: rankingById[player.id]?.pontos || 0,
    _wins: rankingById[player.id]?.vit || 0,
  }));
  const random = seededRandom(`${criterion}|${enriched.map((player) => player.id).sort().join(',')}`);
  const draw = drawTeams(enriched, random, { playersPerTeam, reservesPerTeam: 0, candidates: 50 });
  const teamAIds = new Set(draw.teamAStarters.map((player) => player.id));
  return {
    players: selected.map((player) => ({ ...player, _predictionTeam: teamAIds.has(player.id) ? 'A' : 'B' })),
    reserves,
    playersPerTeam,
  };
}

function PredictionTeamBlock({ title, prediction }) {
  const teamA = prediction.players.filter((player) => player._predictionTeam === 'A').map((player) => ({ ...player, _teamRole: 'starter' }));
  const teamB = prediction.players.filter((player) => player._predictionTeam === 'B').map((player) => ({ ...player, _teamRole: 'starter' }));

  return (
    <section className="sf-card">
      <div className="sf-card-title"><Shuffle size={16} /> {title}</div>
      <div className="sf-muted-sm" style={{ marginBottom: 8 }}>
        {teamA.length} no Time A · {teamB.length} no Time B · {prediction.reserves.length} suplente{prediction.reserves.length === 1 ? '' : 's'}
      </div>
      <div className="sf-prediction-teams">
        <div>
          <div className="sf-prediction-team-title sf-prediction-team-a">🔴 Time A</div>
          {teamA.map((player) => <div className="sf-prediction-player" key={player.id}>{displayName(player)}</div>)}
        </div>
        <div>
          <div className="sf-prediction-team-title sf-prediction-team-b">🔵 Time B</div>
          {teamB.map((player) => <div className="sf-prediction-player" key={player.id}>{displayName(player)}</div>)}
        </div>
      </div>
      {prediction.reserves.length > 0 && (
        <div className="sf-prediction-reserves">
          <strong>🟡 Suplentes:</strong> {prediction.reserves.map((player, index) => <span key={player.id}>{index ? ' · ' : ''}{displayName(player)}</span>)}
        </div>
      )}
      <TacticalPitch teamA={teamA} teamB={teamB} playersPerTeam={prediction.playersPerTeam} reservesPerTeam={0} />
    </section>
  );
}

export default function GroupPrediction({ members = [], games = [] }) {
  const completedGames = useMemo(() => games.filter((game) => game.result), [games]);
  const ranking = useMemo(() => computeRanking(members, completedGames), [members, completedGames]);
  const rankingById = useMemo(
    () => Object.fromEntries(ranking.map((item, index) => [item.id, { ...item, position: index + 1 }])),
    [ranking],
  );
  const frequencyPrediction = useMemo(
    () => buildPrediction(members, rankingById, 'frequency'),
    [members, rankingById],
  );
  const rankingPrediction = useMemo(
    () => buildPrediction(members, rankingById, 'ranking'),
    [members, rankingById],
  );

  const frequencyIds = new Set(frequencyPrediction.players.map((player) => player.id));
  const rankingIds = new Set(rankingPrediction.players.map((player) => player.id));
  const both = frequencyPrediction.players.filter((player) => rankingIds.has(player.id));
  const onlyFrequency = frequencyPrediction.players.filter((player) => !rankingIds.has(player.id));
  const onlyRanking = rankingPrediction.players.filter((player) => !frequencyIds.has(player.id));

  if (!members.length) {
    return <div className="sf-empty"><Users size={28} color="#5C7A67" /><p>Nenhum jogador no grupo.</p></div>;
  }

  return (
    <div className="sf-prediction-wrap">
      <div className="sf-card sf-prediction-summary">
        <div className="sf-card-title"><Shuffle size={16} /> Previsão</div>
        <div className="sf-card-subtitle">
          Os 12 previstos por frequência ou os 12 primeiros do ranking. A simulação dos times não altera nenhuma partida.
        </div>
        <div className="sf-prediction-summary-grid">
          <div><strong>{both.length}</strong><span>nos dois critérios</span></div>
          <div><strong>{onlyFrequency.length}</strong><span>só por frequência</span></div>
          <div><strong>{onlyRanking.length}</strong><span>só por ranking</span></div>
          <div><strong>{completedGames.length}</strong><span>partidas usadas</span></div>
        </div>
      </div>
      <PredictionTeamBlock title="Por frequência" prediction={frequencyPrediction} />
      <PredictionTeamBlock title="Por ranking" prediction={rankingPrediction} />
    </div>
  );
}
