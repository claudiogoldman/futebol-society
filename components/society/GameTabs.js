'use client';

import { MapPin, Users, Shuffle, Wallet, Trophy } from 'lucide-react';

const TABS = [
  { id: 'local', label: 'Local', Icon: MapPin },
  { id: 'participantes', label: 'Participantes', Icon: Users },
  { id: 'times', label: 'Times', Icon: Shuffle },
  { id: 'rateio', label: 'Rateio', Icon: Wallet },
  { id: 'resultado', label: 'Resultado', Icon: Trophy },
];

export default function GameTabs({ activeTab, onChange }) {
  return (
    <div className="sf-game-tabs" role="tablist" aria-label="Seções da partida">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={activeTab === id}
          className={`sf-game-tab ${activeTab === id ? 'sf-game-tab-active' : ''}`}
          onClick={() => onChange(id)}
        >
          <Icon size={15} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
