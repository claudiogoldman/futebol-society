import assert from 'node:assert/strict';
import { drawTeams, calculateTeamBalance, playerStrength } from '../lib/domain/game.js';

function players(count, attributes = {}) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
    positions: index % 6 === 0 ? ['goleiro'] : ['meio'],
    attr_ata: 60,
    attr_def: 60,
    attr_for: 60,
    attr_hab: 60,
    ...attributes,
  }));
}

const formats = [[5, 0], [5, 2], [5, 3], [6, 2], [7, 2]];

for (const [playersPerTeam, reservesPerTeam] of formats) {
  const total = (playersPerTeam + reservesPerTeam) * 2;
  const result = drawTeams(players(total), () => 0.5, {
    playersPerTeam,
    reservesPerTeam,
    candidates: 10,
  });

  assert.equal(result.teamA.length, playersPerTeam + reservesPerTeam);
  assert.equal(result.teamB.length, playersPerTeam + reservesPerTeam);
  assert.equal(result.teamAStarters.length, playersPerTeam);
  assert.equal(result.teamBStarters.length, playersPerTeam);
  assert.equal(result.teamAReserves.length, reservesPerTeam);
  assert.equal(result.teamBReserves.length, reservesPerTeam);

  const ids = [...result.teamA, ...result.teamB].map((player) => player.id);
  assert.equal(new Set(ids).size, total);
}

assert.equal(playerStrength({ attr_ata: 100, attr_def: 100, attr_for: 100, attr_hab: 100 }), 5);
assert.equal(playerStrength({ attr_ata: 50, attr_def: 50, attr_for: 50, attr_hab: 50 }), 2.5);
assert.equal(playerStrength({ rating: 4 }), 4);
assert.equal(playerStrength({ attr_ata: 80, attr_def: 80, attr_for: 50, attr_hab: 50 }), 3.25);

const balanced = drawTeams(players(10), () => 0.5, {
  playersPerTeam: 5,
  reservesPerTeam: 0,
  candidates: 20,
});
const balance = calculateTeamBalance(balanced.teamAStarters, balanced.teamBStarters);
assert.ok(balance.balance >= 95, `expected balanced 5x5 squads, got ${balance.balance}`);

const limited = drawTeams(players(10), () => 0.5, {
  playersPerTeam: 6,
  reservesPerTeam: 2,
  candidates: 5,
});
assert.equal(limited.teamA.length + limited.teamB.length, 10, 'never invent players when fewer than configured capacity are confirmed');
assert.equal(
  limited.teamAStarters.length +
    limited.teamBStarters.length +
    limited.teamAReserves.length +
    limited.teamBReserves.length,
  10,
  'all available players remain assigned when below configured capacity',
);

// Business rule: whenever there are at least 2 confirmed players, a draw must
// be possible, even when the configured team capacity has not been reached.
for (const count of [2, 3, 4, 5, 11, 13]) {
  const result = drawTeams(players(count), () => 0.5, {
    playersPerTeam: 6,
    reservesPerTeam: 1,
    candidates: 10,
  });
  assert.equal(result.teamA.length + result.teamB.length, count, `all ${count} confirmed players must be assigned`);
  assert.ok(result.teamA.length >= 1 && result.teamB.length >= 1, `${count} players must produce two non-empty teams`);
  assert.ok(Math.abs(result.teamA.length - result.teamB.length) <= 1, `${count} players must be distributed as evenly as possible`);
  assert.ok(Math.abs(result.teamAStarters.length - result.teamBStarters.length) <= 1, `${count} starters must be distributed as evenly as possible`);
}

// Ranking is a primary balancing criterion; wins are the secondary historical
// criterion. The draw should avoid concentrating high-ranked players together.
const ranked = Array.from({ length: 10 }, (_, index) => ({
  id: `r${index + 1}`,
  name: `Ranked ${index + 1}`,
  positions: ['meio'],
  attr_ata: 60,
  attr_def: 60,
  attr_for: 60,
  attr_hab: 60,
  _rankingPoints: 10 - index,
  _wins: index < 3 ? 5 : 0,
  _confirmationOrder: index,
}));
const rankedDraw = drawTeams(ranked, () => 0.5, { playersPerTeam: 5, reservesPerTeam: 0, candidates: 30 });
const rankA = rankedDraw.teamAStarters.reduce((sum, p) => sum + p._rankingPoints, 0);
const rankB = rankedDraw.teamBStarters.reduce((sum, p) => sum + p._rankingPoints, 0);
const winsA = rankedDraw.teamAStarters.reduce((sum, p) => sum + p._wins, 0);
const winsB = rankedDraw.teamBStarters.reduce((sum, p) => sum + p._wins, 0);
assert.ok(Math.abs(rankA - rankB) <= 1, `ranking points should be nearly equal: ${rankA} x ${rankB}`);
assert.ok(Math.abs(winsA - winsB) <= 1, `wins should be nearly equal: ${winsA} x ${winsB}`);

// The latest confirmed player(s) on each side are the reserve(s).
const reserveCandidates = Array.from({ length: 12 }, (_, index) => ({
  id: `c${index + 1}`,
  name: `Confirmed ${index + 1}`,
  positions: ['meio'],
  attr_ata: 60,
  attr_def: 60,
  attr_for: 60,
  attr_hab: 60,
  _confirmationOrder: index,
}));
const reserveDraw = drawTeams(reserveCandidates, () => 0.5, { playersPerTeam: 5, reservesPerTeam: 1, candidates: 10 });
for (const [teamName, teamReserves] of [['A', reserveDraw.teamAReserves], ['B', reserveDraw.teamBReserves]]) {
  assert.equal(teamReserves.length, 1, `team ${teamName} must have one reserve`);
  const starterOrders = (teamName === 'A' ? reserveDraw.teamAStarters : reserveDraw.teamBStarters).map((p) => p._confirmationOrder);
  assert.ok(teamReserves[0]._confirmationOrder > Math.max(...starterOrders), `team ${teamName} reserve must be the latest confirmed player on that team`);
}

// With two goalkeepers, the least-conceded goalkeeper must be on the weaker
// side by ranking, or by wins when ranking is tied.
const gkScenario = [
  { id: 'gk1', name: 'GK Least Conceded', positions: ['goleiro'], attr_ata: 60, attr_def: 60, attr_for: 60, attr_hab: 60, _rankingPoints: 2, _wins: 1, _goalsConcededPerGame: 0.5, _confirmationOrder: 0 },
  { id: 'gk2', name: 'GK More Conceded', positions: ['goleiro'], attr_ata: 60, attr_def: 60, attr_for: 60, attr_hab: 60, _rankingPoints: 8, _wins: 4, _goalsConcededPerGame: 2.5, _confirmationOrder: 1 },
  ...Array.from({ length: 8 }, (_, index) => ({
    id: `f${index + 1}`,
    name: `Field ${index + 1}`,
    positions: ['meio'],
    attr_ata: 60,
    attr_def: 60,
    attr_for: 60,
    attr_hab: 60,
    _rankingPoints: index < 4 ? 5 : 1,
    _wins: index < 4 ? 3 : 0,
    _confirmationOrder: index + 2,
  })),
];
const gkDraw = drawTeams(gkScenario, () => 0.5, { playersPerTeam: 5, reservesPerTeam: 0, candidates: 20 });
const gk1InA = gkDraw.teamAStarters.some((p) => p.id === 'gk1');
const gk1InB = gkDraw.teamBStarters.some((p) => p.id === 'gk1');
const gk2InA = gkDraw.teamAStarters.some((p) => p.id === 'gk2');
const gk2InB = gkDraw.teamBStarters.some((p) => p.id === 'gk2');
assert.ok(gk1InA !== gk1InB, 'best goalkeeper must be assigned to exactly one team');
assert.ok(gk2InA !== gk2InB, 'second goalkeeper must be assigned to exactly one team');
const gk1TeamRanking = gk1InA
  ? gkDraw.teamAStarters.reduce((sum, p) => sum + p._rankingPoints, 0)
  : gkDraw.teamBStarters.reduce((sum, p) => sum + p._rankingPoints, 0);
const gk2TeamRanking = gk2InA
  ? gkDraw.teamAStarters.reduce((sum, p) => sum + p._rankingPoints, 0)
  : gkDraw.teamBStarters.reduce((sum, p) => sum + p._rankingPoints, 0);
assert.ok(gk1TeamRanking <= gk2TeamRanking, `least-conceded goalkeeper should be on the weaker-ranked team: ${gk1TeamRanking} <= ${gk2TeamRanking}`);

console.log(`Game domain tests passed: ${formats.length} configurable formats + OVR + balance + under-capacity + ranking/wins + reserve order + goalkeeper distribution.`);
