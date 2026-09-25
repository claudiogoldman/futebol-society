'use client';

import { Component } from 'react';

/**
 * Isola falhas de renderização da aplicação Society do restante do Next.js.
 * Não altera regras de negócio nem tratamento de erros das operações Supabase.
 */
export default class SocietyErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Society render error', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="sf-app sf-loading" role="alert">
        <section className="sf-card" style={{ maxWidth: 520, textAlign: 'center' }}>
          <h1>Não foi possível carregar o Futebol Society</h1>
          <p>Ocorreu um erro na interface. Recarregue a página para tentar novamente.</p>
          {this.state.error?.message ? (
            <pre style={{ marginTop: 12, padding: 10, textAlign: 'left', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 11, background: '#f5f5f5', color: '#222', borderRadius: 8 }}>{this.state.error.message}</pre>
          ) : null}
          <button type="button" onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </section>
      </main>
    );
  }
}
