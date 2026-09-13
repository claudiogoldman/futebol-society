// Pure game-domain helpers used by the UI and tests.
// Keep team drawing and balance rules here as the single source of truth.

export const FIELD_POSITIONS = ['fixo', 'libero', 'meio', 'ala_esquerdo', 'ala_direito', 'pivo'];

export function isGoalkeeper(player) {
  return Array.isArray(player?.positions) && player.positions.includes('goleiro');
}

export function physicalScore(player) {
  let score = 0;
  if (player?.weight_kg) score += (Number(player.weight_kg) - 75) / 10;
  if (player?.age) score += (Number(player.age) - 30) / 10;
  return score;
}

export function playerStrength(player) {
  const attributes = ['attr_ata', 'attr_def', 'attr_for', 'attr_hab'].map((key) => player?.[key]);
  const hasAttributes = attributes.some((value) => value !== null && value !== '');
  if (hasAttributes) {
    const values = attributes.map((value) => {
      const numeric = Number(value);
      return value === null || value === '' || !Number.isFinite(numeric) ? 50 : numeric;
    });
    const overall = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.min(5, Math.max(0, overall / 20));
  }
  return Math.min(5, Math.max(0, Number(player?.rating) || 3));
}

function knownPositions(player) {
  return Array.isArray(player?.positions) ? player.positions.filter((position) => FIELD_POSITIONS.includes(position) || position === 'goleiro') : [];
}

function positionFamilyScore(team, player) {
  const positions = knownPositions(player);
  if (!positions.length) return 0;
  let score = 0;
  positions.forEach((position) => { if (!team.some((member) => knownPositions(member).includes(position))) score += 1; });
  const hasLeft = team.some((member) => knownPositions(member).includes('ala_esquerdo'));
  const hasRight = team.some((member) => knownPositions(member).includes('ala_direito'));
  if (positions.includes('ala_esquerdo') && !hasLeft) score += 0.25;
  if (positions.includes('ala_direito') && !hasRight) score += 0.25;
  return score;
}

function teamScore(team, player, ownRating, otherRating, ownPhysical, otherPhysical, ownRanking, otherRanking, ownWins, otherWins) {
  const rating = playerStrength(player);
  const physical = physicalScore(player);
  const rankingPoints = Number(player?._rankingPoints) || 0;
  const wins = Number(player?._wins) || 0;
  const projectedRatingImbalance = Math.abs((ownRating + rating) - otherRating);
  const projectedPhysicalImbalance = Math.abs((ownPhysical + physical) - otherPhysical);
  const projectedRankingImbalance = Math.abs((ownRanking + rankingPoints) - otherRanking);
  const projectedWinsImbalance = Math.abs((ownWins + wins) - otherWins);
  return positionFamilyScore(team, player) * 0.55
    - projectedRankingImbalance * 0.65
    - projectedWinsImbalance * 0.30
    - projectedRatingImbalance * 0.12
    - projectedPhysicalImbalance * 0.03;
}

function sumMetric(players, key) {
  return players.reduce((sum, player) => {
    const value = Number(player?.[key]);
    return Number.isFinite(value) && value > 0 ? sum + value : sum;
  }, 0);
}

function countMetric(players, key) {
  return players.reduce((count, player) => {
    const value = Number(player?.[key]);
    return Number.isFinite(value) && value > 0 ? count + 1 : count;
  }, 0);
}

function rankingPointsTotal(players) {
  return players.reduce((sum, player) => sum + (Number(player?._rankingPoints) || 0), 0);
}

function winsTotal(players) {
  return players.reduce((sum, player) => sum + (Number(player?._wins) || 0), 0);
}

function goalkeeperConceded(player) {
  const value = Number(player?._goalsConcededPerGame);
  return Number.isFinite(value) ? value : Infinity;
}

function rebalanceGoalkeepers(teamA, teamB) {
  const goalkeepersA = teamA.filter(isGoalkeeper);
  const goalkeepersB = teamB.filter(isGoalkeeper);
  if (goalkeepersA.length === 0 && goalkeepersB.length === 0) return;

  const goalkeepers = [...goalkeepersA, ...goalkeepersB];
  if (goalkeepers.length < 2) return;

  const sorted = [...goalkeepers].sort((a, b) => {
    const aMetric = goalkeeperConceded(a);
    const bMetric = goalkeeperConceded(b);
    if (aMetric !== bMetric) return aMetric - bMetric;
    return (Number(b?._rankingPoints) || 0) - (Number(a?._rankingPoints) || 0);
  });
  const bestGoalkeeper = sorted[0];

  const rankingA = rankingPointsTotal(teamA);
  const rankingB = rankingPointsTotal(teamB);
  const winsA = winsTotal(teamA);
  const winsB = winsTotal(teamB);
  const weakerIsA = rankingA !== rankingB ? rankingA < rankingB : winsA !== winsB ? winsA < winsB : teamA.reduce((s, p) => s + playerStrength(p), 0) <= teamB.reduce((s, p) => s + playerStrength(p), 0);
  const weakerTeam = weakerIsA ? teamA : teamB;
  const strongerTeam = weakerIsA ? teamB : teamA;

  const otherGoalkeeper = goalkeepers.find((player) => player.id !== bestGoalkeeper.id);
  if (!otherGoalkeeper) return;

  if (weakerTeam.some((player) => player.id === bestGoalkeeper.id)) return;

  const bestIndex = strongerTeam.findIndex((player) => player.id === bestGoalkeeper.id);
  const otherIndex = weakerTeam.findIndex((player) => player.id === otherGoalkeeper.id);
  if (bestIndex < 0 || otherIndex < 0) return;

  strongerTeam[bestIndex] = otherGoalkeeper;
  weakerTeam[otherIndex] = bestGoalkeeper;
}

function applyReserveOrder(team, reservesPerTeam, playersPerTeam) {
  if (!reservesPerTeam || team.length <= playersPerTeam) return { starters: [...team], reserves: [] };
  // Confirmation order is ascending: the latest confirmed player has the
  // greatest _confirmationOrder and therefore occupies the reserve slot.
  const ordered = [...team].sort((a, b) => {
    const ao = Number(a?._confirmationOrder);
    const bo = Number(b?._confirmationOrder);
    if (Number.isFinite(ao) && Number.isFinite(bo) && ao !== bo) return ao - bo;
    if (Number.isFinite(ao) && !Number.isFinite(bo)) return -1;
    if (!Number.isFinite(ao) && Number.isFinite(bo)) return 1;
    return 0;
  });
  const reserveCount = Math.min(reservesPerTeam, Math.max(0, ordered.length - playersPerTeam));
  const reserves = reserveCount ? ordered.slice(-reserveCount) : [];
  const reserveIds = new Set(reserves.map((player) => String(player.id)));
  const starters = ordered.filter((player) => !reserveIds.has(String(player.id)));
  return { starters, reserves };
}

/** Aggregate objective team metrics used by the pitch and draw diagnostics. */
export function teamMetrics(team = []) {
  const starters = team.filter((player) => player?._teamRole !== 'reserve');
  const ages = sumMetric(starters, 'age');
  const weights = sumMetric(starters, 'weight_kg');
  const ageCount = countMetric(starters, 'age');
  const weightCount = countMetric(starters, 'weight_kg');
  return {
    players: starters.length,
    ageTotal: ages,
    ageAverage: ageCount ? ages / ageCount : null,
    ageCount,
    weightTotal: weights,
    weightAverage: weightCount ? weights / weightCount : null,
    weightCount,
    overallTotal: starters.reduce((sum, player) => sum + playerStrength(player), 0),
  };
}

/** Compare starting squads and return a normalized 0-100 balance index. */
export function calculateTeamBalance(teamA = [], teamB = []) {
  const startersA = teamA.filter((player) => player?._teamRole !== 'reserve');
  const startersB = teamB.filter((player) => player?._teamRole !== 'reserve');
  const average = (players, selector) => players.length ? players.reduce((sum, player) => sum + selector(player), 0) / players.length : 0;
  const rating = (players) => Math.min(5, Math.max(0, average(players, playerStrength))) / 5;
  const coverage = (players) => {
    if (!players.length) return 0;
    const families = ['goleiro', ...FIELD_POSITIONS];
    return families.filter((position) => players.some((p) => knownPositions(p).includes(position))).length / families.length;
  };
  const goalkeeper = (players) => players.some(isGoalkeeper) ? 1 : 0;
  const strengthA = (rating(startersA) * 0.60 + coverage(startersA) * 0.15 + goalkeeper(startersA) * 0.10) * 100;
  const strengthB = (rating(startersB) * 0.60 + coverage(startersB) * 0.15 + goalkeeper(startersB) * 0.10) * 100;
  const metricsA = teamMetrics(startersA);
  const metricsB = teamMetrics(startersB);
  const mean = (strengthA + strengthB) / 2;
  const technicalDifference = mean ? Math.abs(strengthA - strengthB) / mean * 100 : 0;
  const ageBase = Math.max(1, ((metricsA.ageTotal + metricsB.ageTotal) / 2) || 1);
  const weightBase = Math.max(1, ((metricsA.weightTotal + metricsB.weightTotal) / 2) || 1);
  const ageDifference = Math.abs(metricsA.ageTotal - metricsB.ageTotal);
  const weightDifference = Math.abs(metricsA.weightTotal - metricsB.weightTotal);
  const ageRelativeDifference = metricsA.ageCount && metricsB.ageCount ? ageDifference / ageBase * 100 : 0;
  const weightRelativeDifference = metricsA.weightCount && metricsB.weightCount ? weightDifference / weightBase * 100 : 0;
  const relativeDifference = technicalDifference * 0.75 + ageRelativeDifference * 0.10 + weightRelativeDifference * 0.15;
  const balance = Math.max(0, Math.min(100, 100 - relativeDifference * 3));
  const classification = balance >= 95 ? 'Excelente equilíbrio' : balance >= 90 ? 'Muito bom' : balance >= 80 ? 'Bom' : balance >= 70 ? 'Atenção' : 'Desequilibrado';
  return {
    strengthA,
    strengthB,
    difference: Math.abs(strengthA - strengthB),
    relativeDifference,
    technicalDifference,
    ageDifference,
    ageRelativeDifference,
    weightDifference,
    weightRelativeDifference,
    metricsA,
    metricsB,
    balance,
    classification,
  };
}

function drawTeamsOnce(confirmedPlayers = [], random = Math.random, config = {}) {
  const playersPerTeam = Math.max(1, Number(config.playersPerTeam) || Math.ceil(confirmedPlayers.length / 2));
  const reservesPerTeam = Math.max(0, Number(config.reservesPerTeam) || 0);
  const teamCapacity = playersPerTeam + reservesPerTeam;
  const players = [...confirmedPlayers].slice(0, teamCapacity * 2);
  const goalkeepers = players.filter(isGoalkeeper);
  const outfieldPlayers = players.filter((player) => !isGoalkeeper(player));
  let teamA = [], teamB = [], sumA = 0, sumB = 0, physA = 0, physB = 0, rankingA = 0, rankingB = 0, winsA = 0, winsB = 0;
  const place = (player, preferredTeam = null) => {
    const rating = playerStrength(player);
    const physical = physicalScore(player);
    const rankingPoints = Number(player?._rankingPoints) || 0;
    const wins = Number(player?._wins) || 0;
    let goesToA;
    if (preferredTeam === 'A' && teamA.length < teamCapacity) goesToA = true;
    else if (preferredTeam === 'B' && teamB.length < teamCapacity) goesToA = false;
    else if (teamA.length >= teamCapacity) goesToA = false;
    else if (teamB.length >= teamCapacity) goesToA = true;
    else {
      const scoreA = teamScore(teamA, player, sumA, sumB, physA, physB, rankingA, rankingB, winsA, winsB);
      const scoreB = teamScore(teamB, player, sumB, sumA, physB, physA, rankingB, rankingA, winsB, winsA);
      const rankingGap = rankingA - rankingB;
      const winsGap = winsA - winsB;
      if (Math.abs(rankingGap) > 2) goesToA = rankingGap <= 0;
      else if (Math.abs(winsGap) > 1) goesToA = winsGap <= 0;
      else if (Math.abs(scoreA - scoreB) > 0.10) goesToA = scoreA > scoreB;
      else goesToA = random() >= 0.5;
    }
    if (goesToA) { teamA.push(player); sumA += rating; physA += physical; rankingA += rankingPoints; winsA += wins; }
    else { teamB.push(player); sumB += rating; physB += physical; rankingB += rankingPoints; winsB += wins; }
  };

  [...goalkeepers].sort((a, b) => playerStrength(b) - playerStrength(a)).forEach((player, index) => place(player, index % 2 === 0 ? 'A' : 'B'));
  outfieldPlayers.map((player) => {
    const positions = knownPositions(player);
    return { player, noisyRating: playerStrength(player) + random() * 0.5, rarity: positions.length ? 1 / positions.length : 0 };
  }).sort((a, b) => b.rarity - a.rarity || b.noisyRating - a.noisyRating).forEach(({ player }) => place(player));

  rebalanceGoalkeepers(teamA, teamB);

  const splitA = applyReserveOrder(teamA, reservesPerTeam, playersPerTeam);
  const splitB = applyReserveOrder(teamB, reservesPerTeam, playersPerTeam);
  const teamAStarters = splitA.starters;
  const teamBStarters = splitB.starters;
  const teamAReserves = splitA.reserves;
  const teamBReserves = splitB.reserves;
  return {
    teamA: [...teamAStarters, ...teamAReserves],
    teamB: [...teamBStarters, ...teamBReserves],
    teamAStarters,
    teamBStarters,
    teamAReserves,
    teamBReserves,
  };
}

/** Draw bounded candidate combinations and keep the most balanced one. */
export function drawTeams(confirmedPlayers = [], random = Math.random, config = {}) {
  const candidates = Math.max(1, Math.min(50, Number(config.candidates) || 20));
  let best = null;
  let bestImbalance = Infinity;
  for (let i = 0; i < candidates; i += 1) {
    const candidate = drawTeamsOnce(confirmedPlayers, random, config);
    const balance = calculateTeamBalance(candidate.teamAStarters, candidate.teamBStarters);
    const rankingDifference = Math.abs(rankingPointsTotal(candidate.teamAStarters) - rankingPointsTotal(candidate.teamBStarters));
    const winsDifference = Math.abs(winsTotal(candidate.teamAStarters) - winsTotal(candidate.teamBStarters));
    const objective = balance.relativeDifference + rankingDifference * 0.35 + winsDifference * 0.20;
    if (best === null || objective < bestImbalance) { best = candidate; bestImbalance = objective; }
  }
  return best || drawTeamsOnce(confirmedPlayers, random, config);
}

export function calculateRateio({ cost = 0, activePlayers = [], goalkeeperPays = true }) {
  const payingPlayers = goalkeeperPays ? activePlayers : activePlayers.filter((player) => !isGoalkeeper(player));
  return { payingPlayers, amountPerPlayer: payingPlayers.length > 0 ? cost / payingPlayers.length : 0 };
}

export function splitConfirmedPlayers(confirmedPlayers = [], maxPlayers = null) {
  if (!maxPlayers) return { activePlayers: confirmedPlayers, waitlistPlayers: [] };
  return { activePlayers: confirmedPlayers.slice(0, maxPlayers), waitlistPlayers: confirmedPlayers.slice(maxPlayers) };
}
