'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapPin, Users, CalendarDays, LayoutDashboard } from 'lucide-react';
import { createPortal } from 'react-dom';

const TABS = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'players', label: 'Jogadores', icon: Users },
  { id: 'games', label: 'Partidas', icon: CalendarDays },
  { id: 'locations', label: 'Locais', icon: MapPin },
];

function classifySections(root) {
  const sections = Array.from(root.querySelectorAll(':scope > section.sf-card'));
  sections.forEach((section) => {
    const title = section.querySelector('.sf-card-title')?.textContent?.trim() || '';
    if (title.includes('Padrões do grupo')) section.dataset.groupTab = 'overview';
    else if (title.includes('Locais cadastrados')) section.dataset.groupTab = 'locations';
    else if (title.includes('Membros')) section.dataset.groupTab = 'players';
    else if (title.includes('Partidas do grupo')) section.dataset.groupTab = 'games overview';
  });
  return sections;
}

function findGroupDetail() {
  const roots = Array.from(document.querySelectorAll('.sf-detail'));
  return roots.find((root) => {
    const titles = Array.from(root.querySelectorAll(':scope > section.sf-card .sf-card-title'))
      .map((el) => el.textContent?.trim() || '');
    return titles.some((title) => title.includes('Membros') || title.includes('Partidas do grupo') || title.includes('Padrões do grupo') || title.includes('Locais cadastrados'));
  }) || null;
}

export default function GroupTabs() {
  const [target, setTarget] = useState(null);
  const [active, setActive] = useState('overview');

  useEffect(() => {
    let current = null;
    const sync = () => {
      const next = findGroupDetail();
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

  const sections = useMemo(() => (target ? classifySections(target) : []), [target]);

  useEffect(() => {
    if (!target) return undefined;
    sections.forEach((section) => {
      const tabs = (section.dataset.groupTab || '').split(' ');
      section.style.display = tabs.includes(active) ? '' : 'none';
    });
    const tabsElement = target.querySelector(':scope > .sf-group-tabs');
    const firstSection = target.querySelector(':scope > section.sf-card');
    if (tabsElement && firstSection && tabsElement.nextElementSibling !== firstSection) {
      target.insertBefore(tabsElement, firstSection);
    }
    return () => sections.forEach((section) => { section.style.display = ''; });
  }, [target, sections, active]);

  if (!target) return null;

  return createPortal(
    <div
      className="sf-group-tabs"
      role="tablist"
      aria-label="Navegação do grupo"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 6,
        margin: '10px 0 12px',
        padding: 5,
        background: 'var(--pitch-mid)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        position: 'sticky',
        top: 6,
        zIndex: 20,
      }}
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const selected = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            className="sf-group-tab"
            onClick={() => setActive(id)}
            style={{
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '9px 5px',
              borderRadius: 8,
              border: selected ? '1px solid var(--floodlight)' : '1px solid transparent',
              background: selected ? 'var(--floodlight)' : 'transparent',
              color: selected ? 'var(--pitch-dark)' : 'var(--chalk-dim)',
              fontSize: 11,
              fontWeight: selected ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>,
    target,
    'group-tabs'
  );
}
