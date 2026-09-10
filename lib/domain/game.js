// Pure game-domain helpers used by the UI and tests.
// Keep team drawing and rateio rules here as the single source of truth.

export const FIELD_POSITIONS = ['fixo', 'libero', 'meio', 'ala_esquerdo', 'ala_direito', 'pivo'];

export function isGoalkeeper(player) {
  return Array.isArray(player?.positions) && player.positions.includes('goleiro');
}

export function physicalScore(player) {
  let score = 0;
  if (player?.weight_kg) score += (player.weight_kg - 75) / 10;
  if (player?.age) score += (player.age - 30) / 10;
  return score;
}

function knownPositions(player) {
  return Array.isArray(player?.positions)
    ? player.positions.filter((position) => FIELD_POSITIONS.includes(position) || position === 'goleiro')
    : [];
}

function positionFamilyScore(team, player) {
  const positions = knownPositions(player);
  if (!positions.length) return 0;

  // Position is a preference, not a hard constraint. Reward a team that still
  // lacks a natural position, with a small bonus for wide-pair coverage.
  let score = 0;
  positions.forEach((position) => {
    const alreadyCovered = team.some((member) => knownPositions(member).includes(position));
    if (!alreadyCovered) score += 1;
  });

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
  const coverage = positionFamilyScore(team, player);

  // Competitive balance is primary; position coverage is only a soft tie-breaker.
  return coverage * 0.8 - projectedRatingImbalance * 0.2 - projectedPhysicalImbalance * 0.05;
}

/**
 * Draw balanced teams and, when configured, split each team into starters and
 * reserves. Reserves are part of the draw, but never occupy a starter slot.
 * The old two-argument API remains valid and means "draw everyone as starters".
 *
 * Position preferences are considered when choosing between otherwise similar
 * placements. They are deliberately soft constraints: every confirmed player
 * can still be placed on either side when required by capacity/balance.
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
    const rating = Number(player?.rating) || 3;
    const physical = physicalScore(player);
    let goesToA;

    if (preferredTeam === 'A' && teamA.length < teamCapacity) {
      goesToA = true;
    } else if (preferredTeam === 'B' && teamB.length < teamCapacity) {
      goesToA = false;
    } else if (teamA.length >= teamCapacity) {
      goesToA = false;
    } else if (teamB.length >= teamCapacity) {
      goesToA = true;
    } else {
      const scoreA = teamScore(teamA, player, sumA, sumB, physA, physB);
      const scoreB = teamScore(teamB, player, sumB, sumA, physB, physA);

      // Rating remains the primary balance signal. Position coverage only
      // breaks close decisions, while random noise prevents identical draws.
      const ratingGap = sumA - sumB;
      const physicalGap = physA - physB;
      if (Math.abs(ratingGap) > 0.75) {
        goesToA = ratingGap <= 0;
      } else if (Math.abs(physicalGap) > 0.75) {
        goesToA = physicalGap <= 0;
      } else if (Math.abs(scoreA - scoreB) > 0.15) {
        goesToA = scoreA > scoreB;
      } else {
        goesToA = random() >= 0.5;
      }
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

  // Goalkeepers are intentionally distributed first so that, when there are
  // two or more, each side gets one whenever capacity permits.
  [...goalkeepers]
    .sort((a, b) => (Number(b.rating) || 3) - (Number(a.rating) || 3))
    .forEach((player, index) => place(player, index % 2 === 0 ? 'A' : 'B'));

  // Players with rarer positional profiles are placed before generic players.
  // This improves coverage without turning positions into hard requirements.
  outfieldPlayers
    .map((player) => {
      const positions = knownPositions(player);
      const rarity = positions.length ? 1 / positions.length : 0;
      return {
        player,
        noisyRating: (Number(player.rating) || 3) + random() * 0.5,
        rarity,
      };
    })
    .sort((a, b) => b.rarity - a.rarity || b.noisyRating - a.noisyRating)
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
