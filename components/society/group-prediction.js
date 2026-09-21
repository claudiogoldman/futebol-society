'use client';

import { Users } from 'lucide-react';

export default function GroupPrediction({ members = [] }) {
  return (
    <div className="sf-prediction-wrap">
      <div className="sf-card">
        <div className="sf-card-title"><Users size={16} /> Previsão</div>
        <div className="sf-card-subtitle">Previsão dos próximos times do grupo.</div>
        <div className="sf-muted-sm">{members.length} jogadores no grupo.</div>
      </div>
    </div>
  );
}
