export const metadata = {
  title: 'Exclusão de Conta — Futebol Society',
  description: 'Solicitação de exclusão de conta e dados do Futebol Society.',
};

export default function AccountDeletionPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#F5F8F5', color: '#26352C', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '32px 18px' }}>
      <article style={{ maxWidth: 720, margin: '0 auto', background: '#fff', borderRadius: 16, padding: '32px 28px', boxShadow: '0 4px 24px rgba(11,36,23,0.08)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: '#6B7F70', textTransform: 'uppercase', marginBottom: 8 }}>Futebol Society</div>
        <h1 style={{ fontSize: 32, lineHeight: 1.15, margin: '0 0 14px', color: '#0B2417' }}>Exclusão de conta</h1>
        <p style={{ lineHeight: 1.65, margin: '0 0 14px' }}>
          Você pode solicitar a exclusão da sua conta e dos dados pessoais associados ao Futebol Society.
        </p>
        <div style={{ background: '#EEF5EF', borderRadius: 12, padding: 18, margin: '20px 0' }}>
          <h2 style={{ fontSize: 18, margin: '0 0 8px', color: '#0B2417' }}>Se você está conectado ao aplicativo</h2>
          <p style={{ lineHeight: 1.6, margin: '0 0 14px' }}>
            Você pode realizar a exclusão diretamente. A ação é permanente e requer confirmação explícita.
          </p>
          <a href="/exclusao-conta/confirmar" style={{ display: 'inline-block', background: '#B42318', color: '#fff', textDecoration: 'none', padding: '12px 18px', borderRadius: 10, fontWeight: 700 }}>
            Excluir minha conta
          </a>
        </div>
        <div style={{ borderTop: '1px solid #D9E3DB', paddingTop: 20 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 8px', color: '#0B2417' }}>Se você não está conectado</h2>
          <p style={{ lineHeight: 1.65, margin: '0 0 14px' }}>
            Envie a solicitação a partir do endereço de e-mail associado à conta. Para facilitar a identificação, informe o e-mail usado no aplicativo.
          </p>
          <a
            href="mailto:claudio.goldman@gmail.com?subject=Solicitação%20de%20exclusão%20de%20conta%20—%20Futebol%20Society&body=Solicito%20a%20exclusão%20da%20minha%20conta%20e%20dos%20dados%20pessoais%20associados%20ao%20Futebol%20Society.%0A%0AE-mail%20da%20conta:%20"
            style={{ display: 'inline-block', background: '#0B2417', color: '#fff', textDecoration: 'none', padding: '12px 18px', borderRadius: 10, fontWeight: 700 }}
          >
            Solicitar exclusão por e-mail
          </a>
        </div>
        <p style={{ lineHeight: 1.65, margin: '22px 0 0', color: '#5C6D62', fontSize: 14 }}>
          A exclusão remove os dados pessoais do perfil e os registros de participação associados. Grupos e partidas criados por você podem ser preservados sem referências pessoais de propriedade quando necessário para manter a integridade das atividades dos demais usuários.
        </p>
        <p style={{ marginTop: 20 }}>
          <a href="/privacidade" style={{ color: '#0B2417', fontWeight: 700 }}>Voltar à Política de Privacidade</a>
        </p>
      </article>
    </main>
  );
}
