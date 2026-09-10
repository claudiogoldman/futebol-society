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

function teamScore(team, player, ownRating, otherRating, ownPhysical, otherPhysical) {
  const rating = Number(player?.rating) || 3;
  const physical = physicalScore(player);
  const projectedRatingImbalance = Math.abs((ownRating + rating) - otherRating);
  const projectedPhysicalImbalance = Math.abs((ownPhysical + physical) - otherPhysical);
  return positionFamilyScore(team, player) * 0.8 - projectedRatingImbalance * 0.2 - projectedPhysicalImbalance * 0.05;
}

/** Compare starting squads and return a normalized 0-100 balance index. */
export function calculateTeamBalance(teamA = [], teamB = []) {
  const startersA = teamA.filter((player) => player?._teamRole !== 'reserve');
  const startersB = teamB.filter((player) => player?._teamRole !== 'reserve');
  const average = (players, selector) => players.length ? players.reduce((sum, player) => sum + selector(player), 0) / players.length : 0;
  const rating = (players) => Math.min(5, Math.max(0, average(players, (p) => Number(p?.rating) || 3))) / 5;
  const physical = (players) => {
    if (!players.length) return 0.5;
    const avg = average(players, physicalScore);
    return 0.5 + Math.max(-0.5, Math.min(0.5, avg)) / 1.5;
  };
  const coverage = (players) => {
    if (!players.length) return 0;
    const families = ['goleiro', ...FIELD_POSITIONS];
    return families.filter((position) => players.some((p) => knownPositions(p).includes(position))).length / families.length;
  };
  const goalkeeper = (players) => players.some(isGoalkeeper) ? 1 : 0;
  const strength = (players) => (rating(players) * 0.60 + physical(players) * 0.15 + coverage(players) * 0.15 + goalkeeper(players) * 0.10) * 100;
  const strengthA = strength(startersA);
  const strengthB = strength(startersB);
  const mean = (strengthA + strengthB) / 2;
  const difference = Math.abs(strengthA - strengthB);
  const relativeDifference = mean ? (difference / mean) * 100 : 0;
  const balance = Math.max(0, Math.min(100, 100 - relativeDifference * 3));
  const classification = balance >= 95 ? 'Excelente equilíbrio' : balance >= 90 ? 'Muito bom' : balance >= 80 ? 'Bom' : balance >= 70 ? 'Atenção' : 'Desequilibrado';
  return { strengthA, strengthB, difference, relativeDifference, balance, classification };
}

function drawTeamsOnce(confirmedPlayers = [], random = Math.random, config = {}) {
  const playersPerTeam = Math.max(1, Number(config.playersPerTeam) || Math.ceil(confirmedPlayers.length / 2));
  const reservesPerTeam = Math.max(0, Number(config.reservesPerTeam) || 0);
  const teamCapacity = playersPerTeam + reservesPerTeam;
  const players = [...confirmedPlayers].slice(0, teamCapacity * 2);
  const goalkeepers = players.filter(isGoalkeeper);
  const outfieldPlayers = players.filter((player) => !isGoalkeeper(player));
  let teamA = [], teamB = [], sumA = 0, sumB = 0, physA = 0, physB = 0;
  const place = (player, preferredTeam = null) => {
    const rating = Number(player?.rating) || 3;
    const physical = physicalScore(player);
    let goesToA;
    if (preferredTeam === 'A' && teamA.length < teamCapacity) goesToA = true;
    else if (preferredTeam === 'B' && teamB.length < teamCapacity) goesToA = false;
    else if (teamA.length >= teamCapacity) goesToA = false;
    else if (teamB.length >= teamCapacity) goesToA = true;
    else {
      const scoreA = teamScore(teamA, player, sumA, sumB, physA, physB);
      const scoreB = teamScore(teamB, player, sumB, sumA, physB, physA);
      const ratingGap = sumA - sumB;
      const physicalGap = physA - physB;
      if (Math.abs(ratingGap) > 0.75) goesToA = ratingGap <= 0;
      else if (Math.abs(physicalGap) > 0.75) goesToA = physicalGap <= 0;
      else if (Math.abs(scoreA - scoreB) > 0.15) goesToA = scoreA > scoreB;
      else goesToA = random() >= 0.5;
    }
    if (goesToA) { teamA.push(player); sumA += rating; physA += physical; }
    else { teamB.push(player); sumB += rating; physB += physical; }
  };
  [...goalkeepers].sort((a, b) => (Number(b.rating) || 3) - (Number(a.rating) || 3)).forEach((player, index) => place(player, index % 2 === 0 ? 'A' : 'B'));
  outfieldPlayers.map((player) => {
    const positions = knownPositions(player);
    return { player, noisyRating: (Number(player.rating) || 3) + random() * 0.5, rarity: positions.length ? 1 / positions.length : 0 };
  }).sort((a, b) => b.rarity - a.rarity || b.noisyRating - a.noisyRating).forEach(({ player }) => place(player));
  return { teamA, teamB, teamAStarters: teamA.slice(0, playersPerTeam), teamBStarters: teamB.slice(0, playersPerTeam), teamAReserves: teamA.slice(playersPerTeam), teamBReserves: teamB.slice(playersPerTeam) };
}

/** Draw bounded candidate combinations and keep the most balanced one. */
export function drawTeams(confirmedPlayers = [], random = Math.random, config = {}) {
  const candidates = Math.max(1, Math.min(50, Number(config.candidates) || 20));
  let best = null;
  let bestImbalance = Infinity;
  for (let i = 0; i < candidates; i += 1) {
    const candidate = drawTeamsOnce(confirmedPlayers, random, config);
    const balance = calculateTeamBalance(candidate.teamAStarters, candidate.teamBStarters);
    if (best === null || balance.relativeDifference < bestImbalance) { best = candidate; bestImbalance = balance.relativeDifference; }
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
