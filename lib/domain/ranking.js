// Pure ranking and highlight helpers used by the UI and tests.
// General ranking scoring: participation = 1, win = 3, draw = 1,
// MVP = 2, top scorer of the match = 1, wall = 1.
// Individual goals and assists remain statistics and do not add ranking points.

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

export function computeGameHighlights(game) {
  if (!game.result) return null;

  const allPlayers = [...(game.teamA || []), ...(game.teamB || [])];
  const scorers = game.result.scorers || {};
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

  // A match can have up to two Walls: one goalkeeper from each team.
  // The Wall point is awarded only when both teams have a goalkeeper.
  const goalkeeperA = (game.teamA || []).find(isGoalkeeper);
  const goalkeeperB = (game.teamB || []).find(isGoalkeeper);
  const muros = [];

  if (goalkeeperA && goalkeeperB) {
    const concededA = game.result.scoreB;
    const concededB = game.result.scoreA;

    if (concededA < concededB) {
      muros.push(goalkeeperA);
    } else if (concededB < concededA) {
      muros.push(goalkeeperB);
    } else {
      // Equal goals conceded: both goalkeepers are Walls.
      muros.push(goalkeeperA, goalkeeperB);
    }
  }

  // Existing UI consumers render the legacy singular `muro` field. When there
  // is a tie, expose a display-safe combined name so both qualifying goalkeepers
  // are visible without changing the authoritative `muros` collection.
  const legacyMuro = muros.length === 2
    ? { ...muros[0], name: `${muros[0].name} e ${muros[1].name}` }
    : (muros[0] || null);
  const legacyMuroConceded = muros.length === 2
    ? game.result.scoreA
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

export function computeRanking(profiles = [], games = []) {
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

      const inA = idsA.includes(id);

      if (scoreA === scoreB) {
        stats[id].emp += 1;
        stats[id].pontos += 1;
      } else if ((inA && scoreA > scoreB) || (!inA && scoreB > scoreA)) {
        stats[id].vit += 1;
        stats[id].pontos += 3;
      } else {
        stats[id].der += 1;
      }
    });

    Object.entries(game.scorers || {}).forEach(([id, count]) => {
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

    const highlights = computeGameHighlights(game);

    if (highlights?.mvp && stats[highlights.mvp.id]) {
      stats[highlights.mvp.id].mvps += 1;
      stats[highlights.mvp.id].pontos += 2;
    }

    if (highlights?.artilheiro && stats[highlights.artilheiro.id]) {
      stats[highlights.artilheiro.id].goleadores += 1;
      stats[highlights.artilheiro.id].pontos += 1;
    }

    (highlights?.muros || []).forEach((wall) => {
      if (stats[wall.id]) {
        stats[wall.id].muros += 1;
        stats[wall.id].pontos += 1;
      }
    });
  });

  const totalCompleted = completedGames.length;

  return Object.values(stats)
    .map((stat) => ({
      ...stat,
      nota: stat.notaCount > 0 ? stat.notaSum / stat.notaCount : null,
      presencaPct: totalCompleted > 0
        ? Math.round((stat.jogos / totalCompleted) * 100)
        : null,
    }))
    .sort((a, b) => b.pontos - a.pontos || b.vit - a.vit || b.jogos - a.jogos || a.name.localeCompare(b.name));
}
