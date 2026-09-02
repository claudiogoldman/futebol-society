'use client';

import { Layers } from 'lucide-react';

/**
 * Presentation-only section for group defaults.
 * Persistence remains owned by the existing GroupDetail callbacks.
 */
export default function GroupDefaults({
  group,
  locations,
  editing,
  onStartEditing,
  onSave,
  onCancel,
  children,
}) {
  const defaultLocation = locations.find((location) => location.is_default || location.isDefault);

  return (
    <section className="sf-card">
      <div className="sf-card-title"><Layers size={16} /> Padrões do grupo</div>
      {!editing ? (
        <div className="sf-group-defaults-summary">
          <div className="sf-cost-row"><span className="sf-muted">Local padrão</span><span className="sf-mono-value">{defaultLocation?.name || '—'}</span></div>
          <div className="sf-cost-row"><span className="sf-muted">Dia</span><span className="sf-mono-value">{group.defaultDayOfWeek != null ? ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][group.defaultDayOfWeek] : '—'}</span></div>
          <div className="sf-cost-row"><span className="sf-muted">Horário</span><span className="sf-mono-value">{group.defaultTime || '—'}</span></div>
          <div className="sf-cost-row"><span className="sf-muted">Vagas</span><span className="sf-mono-value">{group.defaultMaxPlayers || 'sem limite'}</span></div>
          <button className="sf-btn-primary" onClick={onStartEditing}>Editar padrões</button>
        </div>
      ) : (
        <div>
          {children}
          <div className="sf-modal-actions">
            <button className="sf-btn-ghost" onClick={onCancel}>Cancelar</button>
            <button className="sf-btn-primary" onClick={onSave}>Salvar padrões</button>
          </div>
        </div>
      )}
    </section>
  );
}
