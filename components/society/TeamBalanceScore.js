'use client';

import React from 'react';

function average(players) {
  if (!players.length) return 0;
  return players.reduce((sum, player) => sum + (Number(player?.rating) || 3), 0) / players.length;
}

function physicalAverage(players) {
  if (!players.length) return 0;
  return players.reduce((sum, player) => {
    let value = 0;
    if (player?.weight_kg) value += (Number(player.weight_kg) - 75) / 10;
    if (player?.age) value += (Number(player.age) - 30) / 10;
    return sum + value;
  }, 0) / players.length;
}

function positionCoverage(players) {
  const families = ['goleiro', 'fixo', 'libero', 'meio', 'ala_esquerdo', 'ala_direito', 'pivo'];
  if (!players.length) return 0;
  return families.reduce((count, family) => count + (players.some((p) => Array.isArray(p?.positions) && p.positions.includes(family)) ? 1 : 0), 0) / families.length;
}

function goalkeeperCoverage(players) {
  return players.some((p) => Array.isArray(p?.positions) && p.positions.includes('goleiro')) ? 1 : 0;
}

function teamStrength(players) {
  if (!players.length) return 0;
  const rating = Math.min(5, Math.max(0, average(players))) / 5;
  const physical = 0.5 + Math.max(-0.5, Math.min(0.5, physicalAverage(players))) / 1.5;
  const positions = positionCoverage(players);
  const goalkeeper = goalkeeperCoverage(players);
  return (rating * 0.60 + physical * 0.15 + positions * 0.15 + goalkeeper * 0.10) * 100;
}

function positionCoverage(players) {
  return positionCoverageCache(players);
}

function positionCoverageCache(players) {
  return positionCoverageImpl(players);
}

function positionCoverageImpl(players) {
  return positionCoverageRaw(players);
}

function positionCoverageRaw(players) {
  return positionCoverageBase(players);
}

function positionCoverageBase(players) {
  const families = ['goleiro', 'fixo', 'libero', 'meio', 'ala_esquerdo', 'ala_direito', 'pivo'];
  if (!players.length) return 0;
  return families.reduce((count, family) => count + (players.some((p) => Array.isArray(p?.positions) && p.positions.includes(family)) ? 1 : 0), 0) / families.length;
}

export function calculateTeamBalance(teamA = [], teamB = []) {
  const strengthA = teamStrength(teamA);
  const strengthB = teamStrength(teamB);
  const averageStrength = (strengthA + strengthB) / 2;
  const difference = Math.abs(strengthA - strengthB);
  const relativeDifference = averageStrength ? (difference / averageStrength) * 100 : 0;
  const balance = Math.max(0, Math.min(100, 100 - relativeDifference * 3));
  const classification = balance >= 95 ? 'Excelente equilíbrio' : balance >= 90 ? 'Muito bom' : balance >= 80 ? 'Bom' : balance >= 70 ? 'Atenção' : 'Desequilibrado';
  return { strengthA, strengthB, difference, relativeDifference, balance, classification };
}

export default function TeamBalanceScore({ teamA = [], teamB = [] }) {
  const score = calculateTeamBalance(teamA, teamB);
  return (
    <section className="sf-card" aria-label="Equilíbrio dos times">
      <div className="sf-card-title">⚖️ Equilíbrio dos times</div>
      <div className="sf-card-subtitle">Índice comparativo dos titulares. Quanto menor a diferença, mais equilibrado o sorteio.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <div className="sf-score-box"><span>Time A</span><strong>{score.strengthA.toFixed(1)}</strong></div>
        <div className="sf-score-box"><span>Time B</span><strong>{score.strengthB.toFixed(1)}</strong></div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <strong>{score.balance.toFixed(0)} / 100</strong>
        <div className="sf-card-subtitle">Diferença: {score.difference.toFixed(1)} pontos · {score.relativeDifference.toFixed(1)}%</div>
        <div style={{ fontWeight: 700, marginTop: 4 }}>{score.classification}</div>
      </div>
    </section>
  );
}
