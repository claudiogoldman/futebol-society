'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Shuffle } from 'lucide-react';
import TacticalPitch from '../../../components/society/TacticalPitch';
import { getPublicTeamSimulation } from '../../../lib/services/society-service';

export default function SharedSimulationPage({ params }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const id = (await params).id;
      const { data: result, error } = await getPublicTeamSimulation(id);
      if (active) {
        setData(error ? null : result);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [params]);

  if (loading) return <main style={{ minHeight: '100vh', background: '#0B2417', color: '#EDF6EE', display: 'grid', placeItems: 'center' }}><Loader2 className="sf-spin" /></main>;
  if (!data) return <main style={{ minHeight: '100vh', background: '#0B2417', color: '#EDF6EE', padding: 24 }}><h2>Simulação não encontrada</h2><p>O link pode estar incorreto ou a simulação foi removida.</p><a href="/" style={{ color: '#FFC53D' }}>Abrir Society</a></main>;

  const teamA = data.team_a || [];
  const teamB = data.team_b || [];
  return (
    <main style={{ minHeight: '100vh', background: '#0B2417', color: '#EDF6EE', maxWidth: 480, margin: '0 auto', padding: 16, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <a href="/" style={{ color: '#EDF6EE', display: 'flex' }}><ArrowLeft size={19} /></a>
        <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#FFC53D', letterSpacing: 1 }}>Simulação compartilhada</div><h1 style={{ margin: 2, fontSize: 21 }}>{data.title}</h1></div>
      </div>
      <div style={{ background: '#143622', border: '1px solid rgba(237,246,238,.14)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 12, opacity: .75 }}>{data.source_label || 'Grupo'}</div>
        <div style={{ marginTop: 6, fontSize: 13 }}>{(data.players || []).length} participantes nesta simulação.</div>
      </div>
      <TacticalPitch teamA={teamA} teamB={teamB} playersPerTeam={Math.max(teamA.length, teamB.length)} reservesPerTeam={0} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
        {[['A', teamA], ['B', teamB]].map(([label, team]) => (
          <div key={label} style={{ background: '#143622', border: '1px solid rgba(237,246,238,.14)', borderRadius: 10, padding: 10 }}>
            <strong>Time {label}</strong>
            {team.map((p) => <div key={p.id} style={{ padding: '7px 0', borderBottom: '1px solid rgba(237,246,238,.08)', fontSize: 13 }}>{p.name}</div>)}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, fontSize: 11, opacity: .65, textAlign: 'center' }}>Esta é uma fotografia da simulação no momento em que o link foi compartilhado.</div>
    </main>
  );
}
