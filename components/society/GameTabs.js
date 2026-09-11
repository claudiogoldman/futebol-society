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
    <>
      <style>{`
        .sf-game-tabs {
          display: flex;
          gap: 6px;
          width: 100%;
          margin: 0 0 12px;
          overflow-x: auto;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .sf-game-tabs::-webkit-scrollbar { display: none; }
        .sf-game-tab {
          flex: 1 1 0;
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          min-height: 42px;
          padding: 8px 7px;
          border: 1px solid rgba(237,246,238,0.14);
          border-radius: 9px;
          background: #143622;
          color: #8FB39C;
          font: 600 11px/1.1 Inter, sans-serif;
          white-space: nowrap;
          cursor: pointer;
          transition: background .15s ease, color .15s ease, border-color .15s ease;
        }
        .sf-game-tab:hover { color: #EDF6EE; border-color: rgba(255,197,61,0.45); }
        .sf-game-tab-active {
          background: #FFC53D;
          color: #0B2417;
          border-color: #FFC53D;
        }
        @media (max-width: 380px) {
          .sf-game-tabs { gap: 4px; }
          .sf-game-tab { padding-left: 5px; padding-right: 5px; font-size: 10px; }
          .sf-game-tab svg { width: 14px; height: 14px; }
        }
      `}</style>
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
    </>
  );
}
