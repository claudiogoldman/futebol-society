'use client';

import { useEffect, useMemo, useState } from 'react';
import { Settings, Users, CalendarDays, LayoutDashboard } from 'lucide-react';
import { createPortal } from 'react-dom';

const TABS = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'players', label: 'Jogadores', icon: Users },
  { id: 'games', label: 'Partidas', icon: CalendarDays },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

function classifySections(root) {
  const sections = Array.from(root.querySelectorAll(':scope > section.sf-card'));
  sections.forEach((section) => {
    const title = section.querySelector('.sf-card-title')?.textContent?.trim() || '';
    if (title.includes('Padrões do grupo')) section.dataset.groupTab = 'settings overview';
    else if (title.includes('Locais cadastrados')) section.dataset.groupTab = 'settings';
    else if (title.includes('Membros')) section.dataset.groupTab = 'players';
    else if (title.includes('Partidas do grupo')) section.dataset.groupTab = 'games overview';
  });
  return sections;
}

export default function GroupTabs() {
  const [target, setTarget] = useState(null);
  const [active, setActive] = useState('overview');

  useEffect(() => {
    let current = null;
    const sync = () => {
      const next = document.querySelector('.sf-detail');
      if (next !== current) {
        current = next;
        setTarget(next || null);
        setActive('overview');
      }
      if (next) classifySections(next);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const sections = useMemo(() => {
    if (!target) return [];
    return classifySections(target);
  }, [target]);

  useEffect(() => {
    if (!target) return;
    sections.forEach((section) => {
      const tabs = (section.dataset.groupTab || '').split(' ');
      section.style.display = tabs.includes(active) ? '' : 'none';
    });
    return () => {
      sections.forEach((section) => { section.style.display = ''; });
    };
  }, [target, sections, active]);

  if (!target) return null;

  return createPortal(
    <div className="sf-group-tabs" role="tablist" aria-label="Navegação do grupo">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          className={`sf-group-tab ${active === id ? 'sf-group-tab-on' : ''}`}
          onClick={() => setActive(id)}
        >
          <Icon size={15} />
          <span>{label}</span>
        </button>
      ))}
    </div>,
    target,
    'group-tabs'
  );
}
