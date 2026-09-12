'use client';

import { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { getGroupParticipationPenaltySettings, setGroupParticipationPenaltySettings } from '../../lib/services/group-penalty-service';

/**
 * Presentation and persistence section for group defaults.
 * The participation penalty is a group-level rule and is configurable only by group admins through the existing group edit flow.
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
  const read = (camel, snake, fallback) => group?.[camel] ?? group?.[snake] ?? fallback;
  const [penaltyEnabled, setPenaltyEnabled] = useState(Boolean(read('participationPenaltyEnabled', 'participation_penalty_enabled', true)));
  const [penaltyHours, setPenaltyHours] = useState(Number(read('participationPenaltyHours', 'participation_penalty_hours', 24)));
  const [penaltyGames, setPenaltyGames] = useState(Number(read('participationPenaltyGames', 'participation_penalty_games', 1)));
  const [penaltySaving, setPenaltySaving] = useState(false);
  const [penaltyError, setPenaltyError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadPenaltySettings = async () => {
      const fallbackEnabled = Boolean(read('participationPenaltyEnabled', 'participation_penalty_enabled', true));
      const fallbackHours = Number(read('participationPenaltyHours', 'participation_penalty_hours', 24));
      const fallbackGames = Number(read('participationPenaltyGames', 'participation_penalty_games', 1));
      if (!group?.id) {
        setPenaltyEnabled(fallbackEnabled);
        setPenaltyHours(fallbackHours);
        setPenaltyGames(fallbackGames);
        return;
      }
      const { data, error } = await getGroupParticipationPenaltySettings(group.id);
      if (cancelled) return;
      if (error || !data) {
        setPenaltyEnabled(fallbackEnabled);
        setPenaltyHours(fallbackHours);
        setPenaltyGames(fallbackGames);
        return;
      }
      setPenaltyEnabled(Boolean(data.participation_penalty_enabled));
      setPenaltyHours(Number(data.participation_penalty_hours));
      setPenaltyGames(Number(data.participation_penalty_games));
    };
    loadPenaltySettings();
    return () => { cancelled = true; };
  }, [group?.id, group?.participationPenaltyEnabled, group?.participationPenaltyHours, group?.participationPenaltyGames, group?.participation_penalty_enabled, group?.participation_penalty_hours, group?.participation_penalty_games]);

  const savePenalty = async () => {
    if (!group?.id) return true;
    if (penaltyHours < 0 || penaltyHours > 168) {
      setPenaltyError('Informe um prazo entre 0 e 168 horas.');
      return false;
    }
    if (penaltyGames < 0 || penaltyGames > 10) {
      setPenaltyError('Informe entre 0 e 10 jogos de penalidade.');
      return false;
    }
    setPenaltySaving(true);
    setPenaltyError('');
    const { error } = await setGroupParticipationPenaltySettings(group.id, {
      enabled: penaltyEnabled,
      hours: penaltyHours,
      games: penaltyGames,
    });
    setPenaltySaving(false);
    if (error) {
      setPenaltyError(error.message || 'Não foi possível salvar a regra de penalidade.');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    const penaltySaved = await savePenalty();
    if (!penaltySaved) return;
    await onSave?.();
  };

  const penaltySummary = !penaltyEnabled
    ? 'Desativada'
    : `${penaltyHours}h de antecedência · ${penaltyGames} ${penaltyGames === 1 ? 'jogo' : 'jogos'}`;

  return (
    <section className="sf-card">
      <div className="sf-card-title"><Layers size={16} /> Padrões do grupo</div>
      {!editing ? (
        <div className="sf-group-defaults-summary">
          <div className="sf-cost-row"><span className="sf-muted">Local padrão</span><span className="sf-mono-value">{defaultLocation?.name || '—'}</span></div>
          <div className="sf-cost-row"><span className="sf-muted">Dia</span><span className="sf-mono-value">{group.defaultDayOfWeek != null ? ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][group.defaultDayOfWeek] : '—'}</span></div>
          <div className="sf-cost-row"><span className="sf-muted">Horário</span><span className="sf-mono-value">{group.defaultTime || '—'}</span></div>
          <div className="sf-cost-row"><span className="sf-muted">Vagas</span><span className="sf-mono-value">{group.defaultMaxPlayers || 'sem limite'}</span></div>
          <div className="sf-cost-row"><span className="sf-muted">Penalidade</span><span className="sf-mono-value">{penaltySummary}</span></div>
          <button className="sf-btn-primary" onClick={onStartEditing}>Editar padrões</button>
        </div>
      ) : (
        <div>
          {children}
          <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--sf-border)', borderRadius: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Regra de cancelamento e remoção</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <input type="checkbox" checked={penaltyEnabled} onChange={(e) => setPenaltyEnabled(e.target.checked)} />
              Aplicar penalidade por cancelamento/remoção tardia
            </label>
            <div className="sf-cost-row">
              <label htmlFor="participation-penalty-hours">Cancelar com menos de</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input id="participation-penalty-hours" className="sf-input-inline" type="number" min="0" max="168" step="1" value={penaltyHours} disabled={!penaltyEnabled} onChange={(e) => setPenaltyHours(Number(e.target.value))} />
                <span>horas antes do jogo</span>
              </div>
            </div>
            <div className="sf-cost-row">
              <label htmlFor="participation-penalty-games">Jogos de penalidade</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input id="participation-penalty-games" className="sf-input-inline" type="number" min="0" max="10" step="1" value={penaltyGames} disabled={!penaltyEnabled} onChange={(e) => setPenaltyGames(Number(e.target.value))} />
                <span>próximo(s) jogo(s) do grupo</span>
              </div>
            </div>
            <div className="sf-muted-sm" style={{ marginTop: 8 }}>
              A regra vale tanto para o cancelamento feito pelo jogador quanto para a remoção feita por administrador. O administrador pode liberar a participação antes do fim da penalidade.
            </div>
            {penaltyError && <div className="sf-muted-sm" role="alert" style={{ marginTop: 8 }}>{penaltyError}</div>}
            {penaltySaving && <div className="sf-muted-sm" style={{ marginTop: 8 }}>Salvando regra de penalidade...</div>}
          </div>
          <div className="sf-modal-actions">
            <button className="sf-btn-ghost" onClick={onCancel}>Cancelar</button>
            <button className="sf-btn-primary" onClick={handleSave} disabled={penaltySaving}>Salvar padrões</button>
          </div>
        </div>
      )}
    </section>
  );
}
