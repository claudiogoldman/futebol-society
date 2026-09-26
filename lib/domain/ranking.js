// Pure ranking and highlight helpers used by the UI and tests.
// Ranking scoring: participation = 1, win = 3, draw = 1,
// MVP = 2, top scorer of the match = 1, wall uses the group-configured points.
// Individual goals and assists remain statistics and are used for team balance.

import { isGoalkeeper } from './game';

export function averageRatingFor(game, playerId) {
  const ratings = game.ratings || {};
  let sum = 0;
  let count = 0;

  Object.values(ratings).forEach((raterMap) => {
    if (raterMap && raterMap[playerId] != null) {
      sum += raterMap[playerId];
      count += 1;
    }
  });

  return count > 0 ? sum / count : null;
}

export function computeGameHighlights(game, options = {}) {
  const wallMaxConcededGoals = Number.isFinite(Number(options.wallMaxConcededGoals))
    ? Math.max(0, Number(options.wallMaxConcededGoals))
    : 5;
  if (!game.result) return null;

  const allPlayers = [...(game.teamA || []), ...(game.teamB || [])];
  const scorers = game.result.scorers || game.scorers || {};
  const assists = game.assists || {};

  let mvp = null;
  let mvpAverage = -1;
  let mvpVotes = 0;

  allPlayers.forEach((player) => {
    const average = averageRatingFor(game, player.id);
    if (average != null && average > mvpAverage) {
      mvpAverage = average;
      mvp = player;
      mvpVotes = Object.values(game.ratings || {})
        .filter((raterMap) => raterMap[player.id] != null)
        .length;
    }
  });

  let topScorer = null;
  let maxGoals = 0;
  allPlayers.forEach((player) => {
    const goals = scorers[player.id] || 0;
    if (goals > maxGoals) {
      maxGoals = goals;
      topScorer = player;
    }
  });

  let topAssistant = null;
  let maxAssists = 0;
  allPlayers.forEach((player) => {
    const playerAssists = assists[player.id] || 0;
    if (playerAssists > maxAssists) {
      maxAssists = playerAssists;
      topAssistant = player;
    }
  });

  // Each goalkeeper who concedes fewer than the configured threshold is a Wall.
  const goalkeeperA = (game.teamA || []).find(isGoalkeeper);
  const goalkeeperB = (game.teamB || []).find(isGoalkeeper);
  const muros = [];
  if (goalkeeperA && Number(game.result.scoreB) < wallMaxConcededGoals) muros.push(goalkeeperA);
  if (goalkeeperB && Number(game.result.scoreA) < wallMaxConcededGoals) muros.push(goalkeeperB);

  // Existing UI consumers render the legacy singular `muro` field. When there
  // is a tie, expose a display-safe combined name so both qualifying goalkeepers
  // are visible without changing the authoritative `muros` collection.
  const legacyMuro = muros.length === 2
    ? { ...muros[0], name: `${muros[0].name} e ${muros[1].name}` }
    : (muros[0] || null);
  const legacyMuroConceded = muros.length === 2
    ? 'abaixo do limite'
    : (muros.length === 1
      ? (muros[0].id === goalkeeperA?.id ? game.result.scoreB : game.result.scoreA)
      : null);

  return {
    mvp,
    mvpAvg: mvpAverage,
    mvpVotes,
    artilheiro: topScorer,
    maxGoals,
    passador: topAssistant,
    maxAssists,
    muro: legacyMuro,
    muros,
    muroConceded: legacyMuroConceded,
  };
}

export function computeRanking(profiles = [], games = [], options = {}) {
  const penalties = Array.isArray(options.penalties) ? options.penalties : [];
  const wallMaxConcededGoals = Number.isFinite(Number(options.wallMaxConcededGoals))
    ? Math.max(0, Number(options.wallMaxConcededGoals))
    : 5;
  const wallPoints = Number.isFinite(Number(options.wallPoints))
    ? Math.max(0, Number(options.wallPoints))
    : 1;
  const stats = {};

  profiles.forEach((profile) => {
    stats[profile.id] = {
      id: profile.id,
      name: profile.name,
      nationality_code: profile.nationality_code || null,
      jogos: 0,
      vit: 0,
      emp: 0,
      der: 0,
      gols: 0,
      assistencias: 0,
      pontos: 0,
      notaSum: 0,
      notaCount: 0,
      mvps: 0,
      muros: 0,
      goleadores: 0,
      penalidades: 0,
      lancamentos: [],
    };
  });

  const completedGames = games.filter((game) => game.result);

  completedGames.forEach((game) => {
    const { scoreA, scoreB } = game.result;
    const idsA = (game.teamA || []).map((player) => player.id);
    const idsB = (game.teamB || []).map((player) => player.id);

    [...idsA, ...idsB].forEach((id) => {
      if (!stats[id]) return;

      stats[id].jogos += 1;
      stats[id].pontos += 1;
      stats[id].lancamentos.push({
        date: game.date || null,
        gameId: game.id || null,
        tipo: 'participacao',
        descricao: 'Participação',
        pontos: 1,
      });

      const inA = idsA.includes(id);

      if (scoreA === scoreB) {
        stats[id].emp += 1;
        stats[id].pontos += 1;
        stats[id].lancamentos.push({ date: game.date || null, gameId: game.id || null, tipo: 'empate', descricao: 'Empate', pontos: 1 });
      } else if ((inA && scoreA > scoreB) || (!inA && scoreB > scoreA)) {
        stats[id].vit += 1;
        stats[id].pontos += 3;
        stats[id].lancamentos.push({ date: game.date || null, gameId: game.id || null, tipo: 'vitoria', descricao: 'Vitória', pontos: 3 });
      } else {
        stats[id].der += 1;
      }
    });

    // Current persistence stores match goals inside result.scorers. Keep the
    // legacy game.scorers fallback so historical in-memory shapes remain valid.
    const scorers = game.result.scorers || game.scorers || {};
    Object.entries(scorers).forEach(([id, count]) => {
      if (stats[id] && count) stats[id].gols += count;
    });

    Object.entries(game.assists || {}).forEach(([id, count]) => {
      if (stats[id] && count) stats[id].assistencias += count;
    });

    Object.values(game.ratings || {}).forEach((raterMap) => {
      Object.entries(raterMap || {}).forEach(([id, score]) => {
        if (stats[id] && score != null) {
          stats[id].notaSum += score;
          stats[id].notaCount += 1;
        }
      });
    });

    const highlights = computeGameHighlights(game, { wallMaxConcededGoals });

    if (highlights?.mvp && stats[highlights.mvp.id]) {
      stats[highlights.mvp.id].mvps += 1;
      stats[highlights.mvp.id].pontos += 2;
      stats[highlights.mvp.id].lancamentos.push({ date: game.date || null, gameId: game.id || null, tipo: 'mvp', descricao: 'MVP', pontos: 2 });
    }

    if (highlights?.artilheiro && stats[highlights.artilheiro.id]) {
      stats[highlights.artilheiro.id].goleadores += 1;
      stats[highlights.artilheiro.id].pontos += 1;
    }

    (highlights?.muros || []).forEach((wall) => {
      if (stats[wall.id]) {
        stats[wall.id].muros += 1;
        stats[wall.id].pontos += wallPoints;
        stats[wall.id].lancamentos.push({ date: game.date || null, gameId: game.id || null, tipo: 'muro', descricao: 'Muro', pontos: wallPoints });
      }
    });
  });

  // Late-cancellation penalties are persisted as participation-penalty records.
  // A penalty represents a historical -1 ranking point and remains visible in the ledger
  // even if the participation block is later released.
  penalties.forEach((penalty) => {
    const stat = stats[penalty.user_id];
    if (!stat) return;
    const canceledGame = games.find((game) => String(game.id) === String(penalty.canceled_game_id));
    stat.penalidades += 1;
    stat.pontos -= 1;
    stat.lancamentos.push({
      date: canceledGame?.date || penalty.created_at || null,
      gameId: penalty.canceled_game_id || null,
      tipo: 'penalidade_cancelamento',
      descricao: 'Cancelamento fora do prazo',
      pontos: -1,
      penaltyId: penalty.id || null,
    });
  });

  const totalCompleted = completedGames.length;

  return Object.values(stats)
    .map((stat) => ({
      ...stat,
      nota: stat.notaCount > 0 ? stat.notaSum / stat.notaCount : null,
      lancamentos: [...stat.lancamentos].sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da || String(a.tipo).localeCompare(String(b.tipo));
      }),
      presencaPct: totalCompleted > 0
        ? Math.round((stat.jogos / totalCompleted) * 100)
        : null,
    }))
    .sort((a, b) =>
      b.pontos - a.pontos ||
      b.vit - a.vit ||
      b.goleadores - a.goleadores ||
      b.assistencias - a.assistencias ||
      (b.nota ?? -1) - (a.nota ?? -1) ||
      b.jogos - a.jogos ||
      a.name.localeCompare(b.name)
    );
}