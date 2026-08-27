// Pure game-domain helpers extracted from app/page.js.
// These functions preserve the current behavior and do not access the UI or Supabase.

export function isGoalkeeper(player) {
  return Array.isArray(player?.positions) && player.positions.includes('goleiro');
}

export function physicalScore(player) {
  let score = 0;
  if (player?.weight_kg) score += (player.weight_kg - 75) / 10;
  if (player?.age) score += (player.age - 30) / 10;
  return score;
}

export function drawTeams(confirmedPlayers = [], random = Math.random) {
  const goalkeepers = confirmedPlayers.filter(isGoalkeeper);
  const outfieldPlayers = confirmedPlayers.filter((player) => !isGoalkeeper(player));

  const teamA = [];
  const teamB = [];
  let sumA = 0;
  let sumB = 0;
  let physA = 0;
  let physB = 0;

  const place = (player) => {
    const rating = player.rating || 3;
    const physical = physicalScore(player);
    const ratingGap = sumA - sumB;
    const goesToA = Math.abs(ratingGap) > 0.75 ? ratingGap <= 0 : physA <= physB;

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
    .forEach(place);

  outfieldPlayers
    .map((player) => ({ player, noisyRating: (player.rating || 3) + random() * 0.5 }))
    .sort((a, b) => b.noisyRating - a.noisyRating)
    .forEach(({ player }) => place(player));

  return { teamA, teamB };
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
