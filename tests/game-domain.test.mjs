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

console.log(`Game domain tests passed: ${formats.length} configurable formats + OVR + balance + under-capacity scenarios.`);
