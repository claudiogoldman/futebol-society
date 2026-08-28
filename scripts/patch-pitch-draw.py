from pathlib import Path
import re

path = Path('app/page.js')
text = path.read_text(encoding='utf-8')

new_draw = r'''// Draws balanced teams while keeping positional coverage when possible.
// Positions are preferences only: a player can be assigned to another slot when
// needed to complete both teams. Players without positions are distributed by
// the normal rating balance and receive fallback positions in the pitch view.
function drawTeams(confirmedPlayers) {
  const players = [...confirmedPlayers];
  const goleiros = players.filter(isGoleiro);
  const linha = players.filter((p) => !isGoleiro(p));
  let teamA = [], teamB = [], sumA = 0, sumB = 0, physA = 0, physB = 0;

  const place = (p, preferredTeam = null) => {
    const rating = p.rating || 3;
    const phys = physicalScore(p);
    let toA;
    if (preferredTeam === 'A') toA = true;
    else if (preferredTeam === 'B') toA = false;
    else {
      const ratingGap = sumA - sumB;
      toA = Math.abs(ratingGap) > 0.75 ? ratingGap <= 0 : physA <= physB;
    }
    if (toA) { teamA.push(p); sumA += rating; physA += phys; }
    else { teamB.push(p); sumB += rating; physB += phys; }
  };

  // Put the strongest goalkeepers on opposite teams first.
  const sortedGks = [...goleiros].sort((a, b) => (b.rating || 3) - (a.rating || 3));
  sortedGks.forEach((p, i) => place(p, i % 2 === 0 ? 'A' : 'B'));

  // Then balance outfield players by rating. Position preferences are retained
  // on each profile and are used by PitchView to place each player on the field.
  const noisy = linha.map((p) => ({ ...p, _r: (p.rating || 3) + Math.random() * 0.5 }));
  noisy.sort((a, b) => b._r - a._r);
  noisy.forEach((p) => {
    const { _r, ...clean } = p;
    place(clean);
  });
  return { teamA, teamB };
}
'''

text2, n1 = re.subn(
    r"// distributes goalkeepers[\\s\\S]*?function avgRatingFor",
    new_draw + "\nfunction avgRatingFor",
    text,
    count=1,
)
if n1 != 1:
    raise SystemExit(f'Could not replace drawTeams block: {n1}')

new_pitch = r'''function PitchView({ teamA, teamB }) {
  // Position slots are expressed as percentages of the SVG. Each team attacks
  // toward the opposite goal. A preferred position is used when a free slot
  // exists; otherwise an unpositioned/duplicate player receives a random free
  // outfield slot. With too many players for the standard slots, extra players
  // are placed in deterministic fallback slots rather than overlapping.
  const baseSlots = [
    { pos: 'goleiro', x: 50, y: 90 },
    { pos: 'fixo', x: 30, y: 72 },
    { pos: 'libero', x: 70, y: 72 },
    { pos: 'meio', x: 50, y: 54 },
    { pos: 'ala_esquerdo', x: 20, y: 48 },
    { pos: 'ala_direito', x: 80, y: 48 },
    { pos: 'pivo', x: 50, y: 28 },
  ];
  const extraSlots = [
    { x: 35, y: 60 }, { x: 65, y: 60 }, { x: 35, y: 38 }, { x: 65, y: 38 },
    { x: 50, y: 40 }, { x: 50, y: 65 }, { x: 20, y: 62 }, { x: 80, y: 62 },
  ];

  const assignSlots = (team, mirrored) => {
    const slots = baseSlots.map((s) => ({ ...s, y: mirrored ? 100 - s.y : s.y }));
    const extras = extraSlots.map((s) => ({ ...s, y: mirrored ? 100 - s.y : s.y }));
    const available = [...slots];
    const assigned = [];
    const positional = [];
    const unpositioned = [];

    team.forEach((player) => {
      const positions = Array.isArray(player.positions) ? player.positions : [];
      const known = positions.filter((p) => POSITION_LABELS[p]);
      if (known.length) positional.push({ player, positions: known });
      else unpositioned.push(player);
    });

    // More specific roles get first choice. Goleiro is always preferred for the
    // goalkeeper slot, while other roles use the player's declared positions.
    positional.sort((a, b) => {
      const aGk = a.positions.includes('goleiro') ? 0 : 1;
      const bGk = b.positions.includes('goleiro') ? 0 : 1;
      return aGk - bGk;
    });

    positional.forEach(({ player, positions }) => {
      const slotIndex = available.findIndex((slot) => positions.includes(slot.pos));
      if (slotIndex >= 0) {
        const [slot] = available.splice(slotIndex, 1);
        assigned.push({ player, ...slot });
      } else {
        unpositioned.push(player);
      }
    });

    // Randomize only players with no usable position (or a duplicated role).
    for (let i = unpositioned.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unpositioned[i], unpositioned[j]] = [unpositioned[j], unpositioned[i]];
    }
    unpositioned.forEach((player) => {
      const slot = available.shift() || extras.shift();
      if (slot) assigned.push({ player, ...slot });
    });

    // If there are more players than configured slots, spread them across
    // generated fallback coordinates so no marker is rendered on top of another.
    team.slice(assigned.length).forEach((player, i) => {
      const angle = (i / Math.max(1, team.length)) * Math.PI * 2;
      const x = Math.max(10, Math.min(90, 50 + Math.cos(angle) * 34));
      const rawY = 50 + Math.sin(angle) * 28;
      const y = mirrored ? 100 - rawY : rawY;
      assigned.push({ player, x, y });
    });
    return assigned;
  };

  const posA = assignSlots(teamA, false);
  const posB = assignSlots(teamB, true);
  const H = 380, W = 260;
  const Marker = ({ p, x, y, color }) => {
    const isGK = isGoleiro(p);
    return (
      <g transform={`translate(${(x / 100) * W}, ${(y / 100) * H})`}>
        <circle r="15" fill={color} stroke={isGK ? '#FFC53D' : '#0B2417'} strokeWidth={isGK ? '3' : '2'} />
        <text textAnchor="middle" dy="5" fontSize="12" fontWeight="700" fill="#0B2417" fontFamily="Inter, sans-serif">
          {(p.name || '?').trim().slice(0, 2).toUpperCase()}
        </text>
      </g>
    );
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 340, display: 'block', margin: '0 auto' }}>
      <rect x="4" y="4" width={W - 8} height={H - 8} rx="6" fill="#153A24" stroke="rgba(237,246,238,0.25)" strokeWidth="2" />
      <line x1="4" y1={H / 2} x2={W - 4} y2={H / 2} stroke="rgba(237,246,238,0.25)" strokeWidth="1.5" />
      <circle cx={W / 2} cy={H / 2} r="34" fill="none" stroke="rgba(237,246,238,0.25)" strokeWidth="1.5" />
      <rect x={W / 2 - 45} y="4" width="90" height="34" fill="none" stroke="rgba(237,246,238,0.25)" strokeWidth="1.5" />
      <rect x={W / 2 - 45} y={H - 38} width="90" height="34" fill="none" stroke="rgba(237,246,238,0.25)" strokeWidth="1.5" />
      {posA.map((pp, i) => <Marker key={'a' + i} p={pp.player} x={pp.x} y={pp.y} color="#FF5C5C" />)}
      {posB.map((pp, i) => <Marker key={'b' + i} p={pp.player} x={pp.x} y={pp.y} color="#4FC3F7" />)}
    </svg>
  );
}
'''

text3, n2 = re.subn(
    r"function PitchView\([\\s\\S]*?\n}\n\n// ---------- login",
    new_pitch + "\n// ---------- login",
    text2,
    count=1,
)
if n2 != 1:
    raise SystemExit(f'Could not replace PitchView block: {n2}')

path.write_text(text3, encoding='utf-8')
print('Patched app/page.js successfully')
