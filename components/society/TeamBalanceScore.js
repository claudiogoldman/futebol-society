'use client';

import React from 'react';
import { calculateTeamBalance } from '../../lib/domain/game';

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
