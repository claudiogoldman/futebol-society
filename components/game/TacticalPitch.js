'use client';

import React, { useMemo } from 'react';

const POSITION_LABELS = {
  goleiro: 'Goleiro',
  fixo: 'Fixo',
  libero: 'Líbero',
  meio: 'Meio',
  ala_esquerdo: 'Ala Esq.',
  ala_direito: 'Ala Dir.',
  pivo: 'Pivô',
};

const PRIMARY_SLOTS = [
  { pos: 'goleiro', x: 50, y: 90 },
  { pos: 'fixo', x: 30, y: 74 },
  { pos: 'libero', x: 70, y: 74 },
  { pos: 'meio', x: 50, y: 55 },
  { pos: 'ala_esquerdo', x: 20, y: 46 },
  { pos: 'ala_direito', x: 80, y: 46 },
  { pos: 'pivo', x: 50, y: 28 },
];

const EXTRA_SLOTS = [
  { x: 35, y: 62 }, { x: 65, y: 62 },
  { x: 35, y: 39 }, { x: 65, y: 39 },
  { x: 50, y: 40 }, { x: 50, y: 66 },
  { x: 22, y: 61 }, { x: 78, y: 61 },
  { x: 30, y: 52 }, { x: 70, y: 52 },
];

function nameOf(player) {
  const nickname = typeof player?.nickname === 'string' ? player.nickname.trim() : '';
  return nickname || player?.name || '?';
}

function positionsOf(player) {
  return Array.isArray(player?.positions)
    ? player.positions.filter((position) => POSITION_LABELS[position])
    : [];
}

function initials(player) {
  return nameOf(player)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';
}

function assignPlayers(team, mirrored) {
  const slots = PRIMARY_SLOTS.map((slot) => ({
    ...slot,
    y: mirrored ? 100 - slot.y : slot.y,
  }));
  const extras = EXTRA_SLOTS.map((slot) => ({
    ...slot,
    y: mirrored ? 100 - slot.y : slot.y,
  }));
  const available = [...slots];
  const assigned = [];
  const pending = [];

  // Goalkeepers first, then players with the rarest preferred position.
  const ordered = [...team].sort((a, b) => {
    const ap = positionsOf(a);
    const bp = positionsOf(b);
    const agk = ap.includes('goleiro') ? 0 : 1;
    const bgk = bp.includes('goleiro') ? 0 : 1;
    if (agk !== bgk) return agk - bgk;
    return ap.length - bp.length;
  });

  ordered.forEach((player) => {
    const positions = positionsOf(player);
    const index = positions.length
      ? available.findIndex((slot) => positions.includes(slot.pos))
      : -1;
    if (index >= 0) {
      const [slot] = available.splice(index, 1);
      assigned.push({ player, ...slot, preferred: true });
    } else {
      pending.push(player);
    }
  });

  pending.forEach((player) => {
    const slot = available.shift() || extras.shift();
    if (slot) assigned.push({ player, ...slot, preferred: false });
  });

  return assigned;
}

function Marker({ item, color, W, H }) {
  const { player, x, y, preferred } = item;
  const name = nameOf(player);
  const avatar = typeof player?.avatar_url === 'string' ? player.avatar_url.trim() : '';
  const isReserve = player?._teamRole === 'reserve' || player?.teamRole === 'reserve';
  const isGoalkeeper = positionsOf(player).includes('goleiro');
  const cx = (x / 100) * W;
  const cy = (y / 100) * H;

  return (
    <g transform={`translate(${cx} ${cy})`}>
      {isReserve ? (
        <circle r="18" fill="rgba(11,36,23,0.88)" stroke="rgba(237,246,238,0.65)" strokeWidth="2" strokeDasharray="4 3" />
      ) : null}
      <circle r="15" fill={color} stroke={isGoalkeeper ? '#FFC53D' : '#0B2417'} strokeWidth="2.5" opacity={isReserve ? 0.72 : 1} />
      {avatar ? (
        <image href={avatar} x="-12" y="-12" width="24" height="24" preserveAspectRatio="xMidYMid slice" clipPath="circle(12px at 12px 12px)" />
      ) : (
        <text textAnchor="middle" dy="4" fontSize="9.5" fontWeight="800" fill="#0B2417" fontFamily="Inter, sans-serif">
          {initials(player)}
        </text>
      )}
      <text textAnchor="middle" y="27" fontSize="7.5" fontWeight="700" fill="#EDF6EE" fontFamily="Inter, sans-serif">
        {name.length > 13 ? `${name.slice(0, 12)}…` : name}
      </text>
      {preferred && positionsOf(player).length ? (
        <text textAnchor="middle" y="-21" fontSize="6.5" fontWeight="700" fill="#FFC53D" fontFamily="Inter, sans-serif">
          {POSITION_LABELS[positionsOf(player)[0]]}
        </text>
      ) : null}
      {isReserve ? (
        <text textAnchor="middle" y="-27" fontSize="6" fontWeight="800" fill="#EDF6EE" fontFamily="Inter, sans-serif">
          RESERVA
        </text>
      ) : null}
    </g>
  );
}

export default function TacticalPitch({ teamA = [], teamB = [], height = 440 }) {
  const posA = useMemo(() => assignPlayers(teamA, false), [teamA]);
  const posB = useMemo(() => assignPlayers(teamB, true), [teamB]);
  const W = 280;
  const H = height;

  return (
    <div className="sf-tactical-pitch">
      <div className="sf-tactical-pitch-header">
        <span>TIME A</span>
        <span>CAMPO TÁTICO</span>
        <span>TIME B</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Campo tático com os jogadores dos dois times">
        <defs>
          <linearGradient id="sf-pitch-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#17472A" />
            <stop offset="1" stopColor="#0F321F" />
          </linearGradient>
        </defs>
        <rect x="5" y="5" width={W - 10} height={H - 10} rx="8" fill="url(#sf-pitch-gradient)" stroke="rgba(237,246,238,0.32)" strokeWidth="2" />
        <rect x="5" y="5" width={W - 10} height={H / 2 - 5} fill="rgba(255,255,255,0.025)" />
        <rect x="5" y={H / 2} width={W - 10} height={H / 2 - 5} fill="rgba(0,0,0,0.035)" />
        <line x1="5" y1={H / 2} x2={W - 5} y2={H / 2} stroke="rgba(237,246,238,0.35)" />
        <circle cx={W / 2} cy={H / 2} r="31" fill="none" stroke="rgba(237,246,238,0.35)" />
        <circle cx={W / 2} cy={H / 2} r="2.5" fill="rgba(237,246,238,0.6)" />
        <rect x={W / 2 - 48} y="5" width="96" height="38" fill="none" stroke="rgba(237,246,238,0.3)" />
        <rect x={W / 2 - 48} y={H - 43} width="96" height="38" fill="none" stroke="rgba(237,246,238,0.3)" />
        <line x1="5" y1="25" x2={W - 5} y2="25" stroke="rgba(237,246,238,0.08)" />
        <line x1="5" y1={H - 25} x2={W - 5} y2={H - 25} stroke="rgba(237,246,238,0.08)" />
        {posA.map((item, index) => <Marker key={`a-${item.player?.id || index}`} item={item} color="#FF5C5C" W={W} H={H} />)}
        {posB.map((item, index) => <Marker key={`b-${item.player?.id || index}`} item={item} color="#4FC3F7" W={W} H={H} />)}
      </svg>
      <div className="sf-tactical-pitch-legend">
        <span>● Titular</span>
        <span>◌ Reserva</span>
        <span>Goleiro destacado</span>
      </div>
    </div>
  );
}
