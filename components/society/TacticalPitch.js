'use client';

import React, { useId } from 'react';

const POSITION_LABELS = {
  goleiro: 'Goleiro',
  fixo: 'Fixo',
  libero: 'Líbero',
  meio: 'Meio',
  ala_esquerdo: 'Ala E.',
  ala_direito: 'Ala D.',
  pivo: 'Pivô',
};

const STARTER_SLOTS = [
  { pos: 'goleiro', x: 50, y: 90 },
  { pos: 'fixo', x: 32, y: 72 },
  { pos: 'libero', x: 68, y: 72 },
  { pos: 'meio', x: 50, y: 54 },
  { pos: 'ala_esquerdo', x: 20, y: 47 },
  { pos: 'ala_direito', x: 80, y: 47 },
  { pos: 'pivo', x: 50, y: 28 },
];

const EXTRA_SLOTS = [
  { x: 35, y: 62 }, { x: 65, y: 62 }, { x: 35, y: 40 }, { x: 65, y: 40 },
  { x: 50, y: 40 }, { x: 50, y: 65 }, { x: 20, y: 62 }, { x: 80, y: 62 },
  { x: 25, y: 30 }, { x: 75, y: 30 },
];

function displayName(player) {
  const nickname = typeof player?.nickname === 'string' ? player.nickname.trim() : '';
  return nickname || player?.name || '?';
}

function initials(player) {
  return displayName(player).trim().slice(0, 2).toUpperCase();
}

function avatar(player) {
  return player?.avatar_url || player?.photo_url || player?.photoUrl || null;
}

function assignSlots(players, mirrored, playersPerTeam, reservesPerTeam) {
  const starterLimit = Math.max(0, Number(playersPerTeam) || 0);
  const reserveLimit = Math.max(0, Number(reservesPerTeam) || 0);
  const starters = players.filter((p) => p?._teamRole !== 'reserve').slice(0, starterLimit || players.length);
  const reserves = players.filter((p) => p?._teamRole === 'reserve').slice(0, reserveLimit);
  const available = STARTER_SLOTS.slice(0, Math.min(starterLimit || STARTER_SLOTS.length, STARTER_SLOTS.length)).map((slot) => ({
    ...slot,
    y: mirrored ? 100 - slot.y : slot.y,
  }));
  const extras = EXTRA_SLOTS.slice(0, Math.max(0, reserveLimit)).map((slot) => ({
    ...slot,
    y: mirrored ? 100 - slot.y : slot.y,
  }));
  const assigned = [];
  const unpositioned = [];

  [...starters].sort((a, b) => {
    const agk = Array.isArray(a?.positions) && a.positions.includes('goleiro') ? 0 : 1;
    const bgk = Array.isArray(b?.positions) && b.positions.includes('goleiro') ? 0 : 1;
    return agk - bgk;
  }).forEach((player) => {
    const positions = Array.isArray(player?.positions) ? player.positions : [];
    const index = available.findIndex((slot) => positions.includes(slot.pos));
    if (index >= 0) {
      const [slot] = available.splice(index, 1);
      assigned.push({ player, ...slot, reserve: false });
    } else {
      unpositioned.push(player);
    }
  });

  unpositioned.forEach((player) => {
    const slot = available.shift() || EXTRA_SLOTS.find((candidate) => !assigned.some((item) => item.x === candidate.x && item.y === (mirrored ? 100 - candidate.y : candidate.y)));
    if (slot) assigned.push({ player, ...slot, reserve: false });
  });

  reserves.forEach((player, index) => {
    const slot = extras[index] || { x: 50, y: mirrored ? 85 : 15 };
    assigned.push({ player, ...slot, reserve: true });
  });

  return assigned;
}

function Marker({ item, color, W, H }) {
  const player = item.player;
  const photo = avatar(player);
  const size = item.reserve ? 12 : 16;
  const cx = (item.x / 100) * W;
  const cy = (item.y / 100) * H;
  return (
    <g transform={`translate(${cx},${cy})`}>
      {photo ? (
        <image href={photo} x={-size} y={-size} width={size * 2} height={size * 2} preserveAspectRatio="xMidYMid slice" clipPath="circle(50%)" />
      ) : (
        <circle r={size} fill={color} />
      )}
      <circle r={size} fill="none" stroke={item.reserve ? '#F5C542' : '#FFFFFF'} strokeWidth={item.reserve ? 2 : 1.5} />
      {!photo && (
        <text textAnchor="middle" dy="4" fontSize={item.reserve ? 9 : 11} fontWeight="700" fill="#0B2417">{initials(player)}</text>
      )}
      <rect x={-27} y={size + 2} width="54" height="13" rx="6" fill="rgba(5,15,9,.82)" />
      <text textAnchor="middle" y={size + 11} fontSize="7.5" fontWeight="600" fill="#F2F7F3">{displayName(player).slice(0, 12)}</text>
    </g>
  );
}

export default function TacticalPitch({ teamA = [], teamB = [], playersPerTeam = 7, reservesPerTeam = 0 }) {
  const W = 280;
  const H = 400;
  const posA = assignSlots(teamA, false, playersPerTeam, reservesPerTeam);
  const posB = assignSlots(teamB, true, playersPerTeam, reservesPerTeam);
  const gradientId = `tacticalPitchGrass-${useId().replace(/:/g, '')}`;

  return (
    <div style={{ width: '100%', maxWidth: 360, margin: '0 auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Campo tático com times A e B (${playersPerTeam} titulares + ${reservesPerTeam} reservas por time)`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#174A2B" />
            <stop offset="100%" stopColor="#0F3520" />
          </linearGradient>
        </defs>
        <rect x="5" y="5" width={W - 10} height={H - 10} rx="8" fill={`url(#${gradientId})`} stroke="rgba(255,255,255,.28)" strokeWidth="2" />
        <rect x="7" y="7" width={(W - 14) / 2} height={H - 14} fill="rgba(255,255,255,.025)" />
        <line x1="5" y1={H / 2} x2={W - 5} y2={H / 2} stroke="rgba(255,255,255,.32)" strokeWidth="1.5" />
        <circle cx={W / 2} cy={H / 2} r="34" fill="none" stroke="rgba(255,255,255,.32)" strokeWidth="1.5" />
        <circle cx={W / 2} cy={H / 2} r="2.5" fill="rgba(255,255,255,.55)" />
        <rect x={W / 2 - 48} y="5" width="96" height="40" fill="none" stroke="rgba(255,255,255,.28)" />
        <rect x={W / 2 - 48} y={H - 45} width="96" height="40" fill="none" stroke="rgba(255,255,255,.28)" />
        <text x="14" y="22" fontSize="11" fontWeight="800" fill="#FFB0B0">TIME A</text>
        <text x={W - 14} y={H - 12} textAnchor="end" fontSize="11" fontWeight="800" fill="#A9E5FF">TIME B</text>
        {posA.map((item, index) => <Marker key={`a-${item.player?.id || index}`} item={item} color="#FF5C5C" W={W} H={H} />)}
        {posB.map((item, index) => <Marker key={`b-${item.player?.id || index}`} item={item} color="#4FC3F7" W={W} H={H} />)}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 11 }}>
        <span>🔴 titulares A</span><span>🔵 titulares B</span><span>🟡 reserva</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6, fontSize: 10, opacity: .75 }}>
        {Object.entries(POSITION_LABELS).map(([key, label]) => <span key={key}>{label}</span>)}
      </div>
    </div>
  );
}
