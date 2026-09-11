'use client';

import React, { useId } from 'react';
import { calculateTeamBalance, teamMetrics } from '../../lib/domain/game';

const POSITION_LABELS = {
  goleiro: 'Goleiro', fixo: 'Fixo', libero: 'Líbero', meio: 'Meio', ala_esquerdo: 'Ala E.', ala_direito: 'Ala D.', pivo: 'Pivô',
};

// Team A occupies the upper half and Team B the lower half. Each starter role
// has a dedicated slot; duplicate/unrecognized roles use collision-free fallbacks.
const STARTER_SLOTS = [
  { pos: 'goleiro', x: 50, y: 15 },
  { pos: 'fixo', x: 22, y: 27 },
  { pos: 'libero', x: 78, y: 27 },
  { pos: 'meio', x: 50, y: 36 },
  { pos: 'ala_esquerdo', x: 18, y: 45 },
  { pos: 'ala_direito', x: 82, y: 45 },
  { pos: 'pivo', x: 50, y: 47 },
];
const FALLBACK_SLOTS = [
  { x: 12, y: 18 }, { x: 88, y: 18 }, { x: 12, y: 36 }, { x: 88, y: 36 },
  { x: 32, y: 47 }, { x: 68, y: 47 }, { x: 38, y: 22 }, { x: 62, y: 22 },
];

function displayName(player) {
  const nickname = typeof player?.nickname === 'string' ? player.nickname.trim() : '';
  return nickname || player?.name || '?';
}
function initials(player) { return displayName(player).trim().slice(0, 2).toUpperCase(); }
function avatar(player) { return player?.avatar_url || player?.photo_url || player?.photoUrl || null; }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function assignSlots(players, mirrored, playersPerTeam, reservesPerTeam) {
  const starterLimit = Math.max(0, Number(playersPerTeam) || 0);
  const reserveLimit = Math.max(0, Number(reservesPerTeam) || 0);
  const starters = players.filter((p) => p?._teamRole !== 'reserve').slice(0, starterLimit || players.length);
  const reserves = players.filter((p) => p?._teamRole === 'reserve').slice(0, reserveLimit);
  const transform = (slot) => ({ ...slot, y: mirrored ? 100 - slot.y : slot.y });
  const roleSlots = STARTER_SLOTS.map(transform);
  const fallbackSlots = FALLBACK_SLOTS.map(transform);
  const assigned = [];
  const used = [];

  const isFree = (slot) => used.every((item) => distance(slot, item) >= 13);
  const takeSlot = (preferred) => {
    const candidates = [preferred, ...roleSlots, ...fallbackSlots].filter(Boolean);
    const slot = candidates.find((candidate) => isFree(candidate));
    if (slot) used.push(slot);
    return slot;
  };

  starters.forEach((player) => {
    const positions = Array.isArray(player?.positions) ? player.positions : [];
    const preferred = roleSlots.find((slot) => positions.includes(slot.pos) && isFree(slot));
    const slot = takeSlot(preferred);
    if (slot) assigned.push({ player, ...slot, reserve: false });
  });

  // Reserves are deliberately rendered outside the tactical field below.
  // This prevents a reserve from visually colliding with a starter or crossing halves.
  return { assigned, reserves };
}

function Marker({ item, color, W, H }) {
  const player = item.player;
  const photo = avatar(player);
  const size = 15;
  const cx = (item.x / 100) * W;
  const cy = (item.y / 100) * H;
  const name = displayName(player).slice(0, 12);
  return (
    <g transform={`translate(${cx},${cy})`}>
      {photo ? <image href={photo} x={-size} y={-size} width={size * 2} height={size * 2} preserveAspectRatio="xMidYMid slice" clipPath="circle(50%)" /> : <circle r={size} fill={color} />}
      <circle r={size} fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
      {!photo && <text textAnchor="middle" dy="4" fontSize="10" fontWeight="700" fill="#0B2417">{initials(player)}</text>}
      <rect x={-27} y={size + 2} width="54" height="13" rx="6" fill="rgba(5,15,9,.86)" />
      <text textAnchor="middle" y={size + 11} fontSize="7.5" fontWeight="600" fill="#F2F7F3">{name}</text>
    </g>
  );
}

function Metric({ label, valueA, valueB, unit = '' }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 6, alignItems: 'center', fontSize: 11 }}>
    <span>Time A <strong>{valueA == null ? '—' : `${valueA}${unit}`}</strong></span>
    <span style={{ opacity: .65 }}>{label}</span>
    <span style={{ textAlign: 'right' }}><strong>{valueB == null ? '—' : `${valueB}${unit}`}</strong> Time B</span>
  </div>;
}

function ReserveList({ label, players }) {
  if (!players.length) return null;
  return (
    <div style={{ marginTop: 7, fontSize: 10, opacity: .88 }}>
      <strong>{label} — reservas:</strong> {players.map((player, index) => <span key={player?.id || index}>{index ? ' · ' : ''}{displayName(player)}</span>)}
    </div>
  );
}

export default function TacticalPitch({ teamA = [], teamB = [], playersPerTeam = 7, reservesPerTeam = 0 }) {
  const W = 280;
  const H = 400;
  const layoutA = assignSlots(teamA, false, playersPerTeam, reservesPerTeam);
  const layoutB = assignSlots(teamB, true, playersPerTeam, reservesPerTeam);
  const balance = calculateTeamBalance(teamA, teamB);
  const metricsA = teamMetrics(teamA);
  const metricsB = teamMetrics(teamB);
  const gradientId = `tacticalPitchGrass-${useId().replace(/:/g, '')}`;

  return <div style={{ width: '100%', maxWidth: 360, margin: '0 auto' }}>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Campo tático com times A e B (${playersPerTeam} titulares + ${reservesPerTeam} reservas por time)`}>
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#174A2B" /><stop offset="100%" stopColor="#0F3520" /></linearGradient></defs>
      <rect x="5" y="5" width={W - 10} height={H - 10} rx="8" fill={`url(#${gradientId})`} stroke="rgba(255,255,255,.28)" strokeWidth="2" />
      <rect x="7" y="7" width={W - 14} height={(H - 14) / 2} fill="rgba(255,255,255,.025)" />
      <line x1="5" y1={H / 2} x2={W - 5} y2={H / 2} stroke="rgba(255,255,255,.38)" strokeWidth="1.5" />
      <circle cx={W / 2} cy={H / 2} r="34" fill="none" stroke="rgba(255,255,255,.32)" strokeWidth="1.5" />
      <circle cx={W / 2} cy={H / 2} r="2.5" fill="rgba(255,255,255,.55)" />
      <rect x={W / 2 - 48} y="5" width="96" height="40" fill="none" stroke="rgba(255,255,255,.28)" />
      <rect x={W / 2 - 48} y={H - 45} width="96" height="40" fill="none" stroke="rgba(255,255,255,.28)" />
      <text x="14" y="22" fontSize="11" fontWeight="800" fill="#FFB0B0">TIME A</text>
      <text x={W - 14} y={H - 12} textAnchor="end" fontSize="11" fontWeight="800" fill="#A9E5FF">TIME B</text>
      {layoutA.assigned.map((item, index) => <Marker key={`a-${item.player?.id || index}`} item={item} color="#FF5C5C" W={W} H={H} />)}
      {layoutB.assigned.map((item, index) => <Marker key={`b-${item.player?.id || index}`} item={item} color="#4FC3F7" W={W} H={H} />)}
    </svg>
    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 11 }}><span>🔴 titulares A</span><span>🔵 titulares B</span><span>🟡 reserva</span></div>
    <ReserveList label="Time A" players={layoutA.reserves} />
    <ReserveList label="Time B" players={layoutB.reserves} />
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6, fontSize: 10, opacity: .75 }}>{Object.entries(POSITION_LABELS).map(([key, label]) => <span key={key}>{label}</span>)}</div>
    <div style={{ marginTop: 12, padding: 10, border: '1px solid rgba(255,255,255,.12)', borderRadius: 10 }} aria-label="Indicadores de equilíbrio">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><strong>⚖️ Equilíbrio</strong><strong>{balance.balance.toFixed(0)}/100</strong></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 7, fontSize: 11 }}><span>Time A <strong>{balance.strengthA.toFixed(1)}</strong></span><span style={{ textAlign: 'right' }}>Time B <strong>{balance.strengthB.toFixed(1)}</strong></span></div>
      <div style={{ marginTop: 9, display: 'grid', gap: 5 }}>
        <Metric label="idade total" valueA={metricsA.ageTotal || null} valueB={metricsB.ageTotal || null} unit=" anos" />
        <Metric label="idade média" valueA={metricsA.ageAverage == null ? null : metricsA.ageAverage.toFixed(1)} valueB={metricsB.ageAverage == null ? null : metricsB.ageAverage.toFixed(1)} unit=" anos" />
        <Metric label="peso total" valueA={metricsA.weightTotal || null} valueB={metricsB.weightTotal || null} unit=" kg" />
        <Metric label="peso médio" valueA={metricsA.weightAverage == null ? null : metricsA.weightAverage.toFixed(1)} valueB={metricsB.weightAverage == null ? null : metricsB.weightAverage.toFixed(1)} unit=" kg" />
        <Metric label="OVR total" valueA={metricsA.overallTotal.toFixed(1)} valueB={metricsB.overallTotal.toFixed(1)} />
      </div>
      <div style={{ textAlign: 'center', marginTop: 7, fontSize: 10, opacity: .8 }}>Diferença técnica {balance.technicalDifference.toFixed(1)}% · idade {balance.ageDifference.toFixed(0)} · peso {balance.weightDifference.toFixed(1)} kg · {balance.classification}</div>
    </div>
  </div>;
}
