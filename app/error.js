'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('Society client error:', error);
  }, [error]);

  return (
    <main style={{ minHeight: '100vh', background: '#0B2417', color: '#EDF6EE', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#143622', border: '1px solid rgba(237,246,238,0.14)', borderRadius: 14, padding: 20, textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 20 }}>Não foi possível abrir a partida</h2>
        <p style={{ color: '#8FB39C', fontSize: 13, lineHeight: 1.5, margin: '0 0 14px' }}>
          O aplicativo encontrou um erro no navegador. Tente novamente.
        </p>
        {error?.message && (
          <details style={{ textAlign: 'left', marginBottom: 14 }}>
            <summary style={{ cursor: 'pointer', color: '#FFC53D', fontSize: 12 }}>Detalhes técnicos</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#8FB39C', fontSize: 11, marginTop: 8 }}>{error.message}</pre>
          </details>
        )}
        <button type="button" onClick={() => reset()} style={{ width: '100%', padding: '12px 16px', border: 0, borderRadius: 10, background: '#FFC53D', color: '#0B2417', fontWeight: 700, cursor: 'pointer' }}>
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
