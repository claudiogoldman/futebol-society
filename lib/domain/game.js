// Pure game-domain helpers used by the UI and tests.
// Keep team drawing and rateio rules here as the single source of truth.

export function isGoalkeeper(player) {
  return Array.isArray(player?.positions) && player.positions.includes('goleiro');
}

export function physicalScore(player) {
  let score = 0;
  if (player?.weight_kg) score += (player.weight_kg - 75) / 10;
  if (player?.age) score += (player.age - 30) / 10;
  return score;
}

/**
 * Draw balanced teams and, when configured, split each team into starters and
 * reserves. Reserves are part of the draw, but never occupy a starter slot.
 * The old two-argument API remains valid and means "draw everyone as starters".
 */
export function drawTeams(confirmedPlayers = [], random = Math.random, config = {}) {
  const playersPerTeam = Math.max(1, Number(config.playersPerTeam) || Math.ceil(confirmedPlayers.length / 2));
  const reservesPerTeam = Math.max(0, Number(config.reservesPerTeam) || 0);
  const teamCapacity = playersPerTeam + reservesPerTeam;
  const players = [...confirmedPlayers].slice(0, teamCapacity * 2);
  const goalkeepers = players.filter(isGoalkeeper);
  const outfieldPlayers = players.filter((player) => !isGoalkeeper(player));
  let teamA = [];
  let teamB = [];
  let sumA = 0;
  let sumB = 0;
  let physA = 0;
  let physB = 0;

  const place = (player, preferredTeam = null) => {
    const rating = player.rating || 3;
    const physical = physicalScore(player);
    let goesToA;
    if (preferredTeam === 'A' && teamA.length < teamCapacity) goesToA = true;
    else if (preferredTeam === 'B' && teamB.length < teamCapacity) goesToA = false;
    else if (teamA.length >= teamCapacity) goesToA = false;
    else if (teamB.length >= teamCapacity) goesToA = true;
    else {
      const ratingGap = sumA - sumB;
      goesToA = Math.abs(ratingGap) > 0.75 ? ratingGap <= 0 : physA <= physB;
    }

    if (goesToA) {
      teamA.push(player);
      sumA += rating;
      physA += physical;
    } else {
      teamB.push(player);
      sumB += rating;
      physB += physical;
    }
  };

  [...goalkeepers]
    .sort((a, b) => (b.rating || 3) - (a.rating || 3))
    .forEach((player, index) => place(player, index % 2 === 0 ? 'A' : 'B'));

  outfieldPlayers
    .map((player) => ({ player, noisyRating: (player.rating || 3) + random() * 0.5 }))
    .sort((a, b) => b.noisyRating - a.noisyRating)
    .forEach(({ player }) => place(player));

  return {
    teamA,
    teamB,
    teamAStarters: teamA.slice(0, playersPerTeam),
    teamBStarters: teamB.slice(0, playersPerTeam),
    teamAReserves: teamA.slice(playersPerTeam),
    teamBReserves: teamB.slice(playersPerTeam),
  };
}

export function calculateRateio({ cost = 0, activePlayers = [], goalkeeperPays = true }) {
  const payingPlayers = goalkeeperPays
    ? activePlayers
    : activePlayers.filter((player) => !isGoalkeeper(player));

  return {
    payingPlayers,
    amountPerPlayer: payingPlayers.length > 0 ? cost / payingPlayers.length : 0,
  };
}

export function splitConfirmedPlayers(confirmedPlayers = [], maxPlayers = null) {
  if (!maxPlayers) {
    return { activePlayers: confirmedPlayers, waitlistPlayers: [] };
  }

  return {
    activePlayers: confirmedPlayers.slice(0, maxPlayers),
    waitlistPlayers: confirmedPlayers.slice(maxPlayers),
  };
}
