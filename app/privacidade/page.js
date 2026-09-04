export const metadata = {
  title: 'Política de Privacidade — Futebol Society',
  description: 'Política de Privacidade do aplicativo Futebol Society.',
};

const sectionStyle = { marginBottom: 28 };
const headingStyle = { fontSize: 20, margin: '0 0 10px', color: '#0B2417' };
const textStyle = { lineHeight: 1.65, margin: '0 0 10px', color: '#26352C' };

export default function PrivacyPolicyPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#F5F8F5', color: '#26352C', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '32px 18px' }}>
      <article style={{ maxWidth: 820, margin: '0 auto', background: '#fff', borderRadius: 16, padding: '32px 28px', boxShadow: '0 4px 24px rgba(11,36,23,0.08)' }}>
        <header style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: '#6B7F70', textTransform: 'uppercase', marginBottom: 8 }}>Futebol Society</div>
          <h1 style={{ fontSize: 32, lineHeight: 1.15, margin: 0, color: '#0B2417' }}>Política de Privacidade</h1>
          <p style={{ ...textStyle, marginTop: 12, color: '#5C6D62' }}>Última atualização: 4 de setembro de 2026.</p>
        </header>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>1. Sobre esta política</h2>
          <p style={textStyle}>Esta Política de Privacidade explica como o aplicativo Futebol Society trata informações relacionadas aos seus usuários. O aplicativo é destinado à organização de partidas de futebol society, grupos, presença, escalação, estatísticas, avaliações e rateio de custos.</p>
          <p style={textStyle}>Responsável pelo aplicativo: Claudio Fernando Goldman. Contato de privacidade: claudio.goldman@gmail.com.</p>
          <p style={textStyle}>A política foi preparada considerando as funcionalidades e os dados atualmente utilizados pelo aplicativo. Alterações relevantes no tratamento de dados poderão resultar em atualização desta política.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>2. Dados tratados</h2>
          <p style={textStyle}>Dependendo das funcionalidades utilizadas, o Futebol Society pode tratar:</p>
          <ul style={{ ...textStyle, paddingLeft: 22 }}>
            <li>dados de autenticação e identificação da conta, incluindo endereço de e-mail e identificadores técnicos da conta;</li>
            <li>nome e foto de perfil, quando fornecidos pelo usuário;</li>
            <li>telefone, idade, peso, pé preferido, posições de jogo, nacionalidade e atributos esportivos, quando preenchidos no perfil;</li>
            <li>dados de participação em grupos e partidas, incluindo confirmações de presença, lista de espera, times, gols, assistências, avaliações e ranking;</li>
            <li>dados de partidas e locais cadastrados para as partidas, como nome do local, endereço, cidade, estado e coordenadas geográficas do local da partida, quando informadas;</li>
            <li>informações de pagamento utilizadas para o rateio, incluindo situação de pagamento e, quando cadastrada pelo responsável, chave Pix, nome do recebedor e cidade;</li>
            <li>imagens enviadas para avatar de perfil ou imagem de grupo.</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>3. Como os dados são usados</h2>
          <p style={textStyle}>Os dados são utilizados para criar e administrar contas, grupos e partidas; organizar presença e lista de espera; montar times; registrar resultados e estatísticas; calcular rankings; administrar rateios e informações de Pix; exibir os dados necessários aos integrantes autorizados dos grupos e partidas; e manter a segurança e o funcionamento do serviço.</p>
          <p style={textStyle}>O aplicativo não utiliza os dados pessoais para publicidade comportamental como finalidade da funcionalidade de organização de partidas.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>4. Localização</h2>
          <p style={textStyle}>O Futebol Society pode armazenar endereço e coordenadas geográficas associadas ao <strong>local de uma partida ou local cadastrado pelo grupo</strong>. Essas informações servem para identificar e facilitar o acesso ao local do jogo.</p>
          <p style={textStyle}>O aplicativo não depende de rastreamento contínuo da localização física do usuário para funcionar. As coordenadas tratadas pelo serviço correspondem ao local esportivo cadastrado na partida ou no grupo.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>5. Compartilhamento e acesso</h2>
          <p style={textStyle}>Os dados são armazenados e processados por serviços de infraestrutura utilizados pelo aplicativo, incluindo autenticação, banco de dados e armazenamento de arquivos fornecidos pelo Supabase, além da infraestrutura de hospedagem utilizada pelo aplicativo.</p>
          <p style={textStyle}>Dentro do Futebol Society, determinados dados podem ser exibidos aos integrantes de um grupo ou aos participantes de uma partida quando necessários para a organização da atividade. O acesso é limitado pelas regras de autorização do aplicativo.</p>
          <p style={textStyle}>Não vendemos dados pessoais dos usuários.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>6. Segurança</h2>
          <p style={textStyle}>O aplicativo utiliza autenticação, controles de acesso no banco de dados e comunicação protegida por HTTPS/TLS para reduzir riscos de acesso, alteração ou divulgação não autorizada. As permissões de acesso aos dados são aplicadas de acordo com as regras de segurança configuradas no serviço.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>7. Retenção e exclusão</h2>
          <p style={textStyle}>Os dados são mantidos enquanto forem necessários para disponibilizar as funcionalidades do serviço, cumprir obrigações legais ou resolver questões de segurança e integridade. Quando a conta for excluída, os dados pessoais associados deverão ser removidos ou tratados de forma compatível com as obrigações legais aplicáveis.</p>
          <p style={textStyle}>O usuário pode solicitar a exclusão da conta e dos dados pessoais associados na página <a href="/exclusao-conta" style={{ color: '#0B2417', fontWeight: 700 }}>Exclusão de conta</a>. A solicitação será validada e processada pelo canal informado nessa página.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>8. Direitos do titular</h2>
          <p style={textStyle}>Nos termos da legislação aplicável, o usuário pode solicitar informações sobre o tratamento de seus dados, correção de dados incompletos ou incorretos e exclusão dos dados pessoais quando cabível, além de outros direitos previstos em lei.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>9. Contato de privacidade</h2>
          <p style={textStyle}>O responsável pelo aplicativo é Claudio Fernando Goldman. Para dúvidas, solicitações relacionadas à privacidade ou pedidos de exclusão de conta e dados, entre em contato pelo e-mail <a href="mailto:claudio.goldman@gmail.com" style={{ color: '#0B2417', fontWeight: 700 }}>claudio.goldman@gmail.com</a> ou utilize a página <a href="/exclusao-conta" style={{ color: '#0B2417', fontWeight: 700 }}>Exclusão de conta</a>.</p>
        </section>

        <section style={{ ...sectionStyle, marginBottom: 0 }}>
          <h2 style={headingStyle}>10. Alterações desta política</h2>
          <p style={textStyle}>Esta Política de Privacidade poderá ser atualizada para refletir mudanças no aplicativo, nos serviços utilizados ou nas exigências legais. A versão vigente será publicada nesta mesma página.</p>
        </section>
      </article>
    </main>
  );
}
