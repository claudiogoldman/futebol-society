'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, LogIn } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export default function GroupInviteNotice() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = new URLSearchParams(window.location.search).get('joinGroup');
    if (!token) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase.rpc('get_group_invite_info', { p_token: token });
      if (!cancelled && data?.[0]) setInfo(data[0]);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  if (!info && !loading) return null;

  return (
    <div style={{ position: 'fixed', top: 12, left: 12, right: 12, zIndex: 1000, maxWidth: 560, margin: '0 auto', padding: 14, border: '1px solid var(--sf-border)', borderRadius: 14, background: 'var(--pitch-dark)', boxShadow: '0 12px 32px rgba(0,0,0,.35)' }}>
      {loading ? (
        <div className="sf-muted-sm">Carregando informações do convite...</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
            <AlertTriangle size={17} /> Convite para {info.group_name}
          </div>
          <div style={{ marginTop: 8, fontWeight: 700 }}>Regra de participação</div>
          {info.participation_penalty_enabled ? (
            <div className="sf-muted-sm" style={{ marginTop: 4 }}>
              Cancelamentos ou remoções com menos de <strong>{info.participation_penalty_hours} horas</strong> de antecedência geram bloqueio nos próximos <strong>{info.participation_penalty_games} {info.participation_penalty_games === 1 ? 'jogo' : 'jogos'}</strong> do grupo.
              Um administrador pode liberar a participação antes do fim da penalidade.
            </div>
          ) : (
            <div className="sf-muted-sm" style={{ marginTop: 4 }}>Este grupo não aplica penalidade por cancelamento ou remoção tardia.</div>
          )}
          <div className="sf-muted-sm" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
            <LogIn size={13} /> Entre com sua conta para participar do grupo.
          </div>
        </>
      )}
    </div>
  );
}
