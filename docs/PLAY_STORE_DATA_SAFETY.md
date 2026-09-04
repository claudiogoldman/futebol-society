# Google Play — Data Safety (auditoria técnica)

> **Status:** auditoria técnica do build atual. O formulário do Play Console deve ser conferido novamente no momento do envio, principalmente se houver alteração de código, SDK ou modelo de dados.

## 1. Dados identificados no aplicativo

### Informações pessoais
- **Nome** — perfil e identificação dentro de grupos/partidas.
- **Endereço de e-mail** — autenticação e conta.
- **IDs de usuário** — identificação técnica da conta.
- **Número de telefone** — quando informado pelo usuário.
- **Outras informações pessoais** — idade e nacionalidade, quando informadas.

### Saúde e fitness
- **Informações sobre condicionamento físico** — peso e informações esportivas/de atividade física mantidas no perfil.

A classificação como fitness é a interpretação técnica mais adequada para os dados esportivos identificados; confirmar no formulário vigente caso o Play Console apresente nomenclatura diferente.

### Fotos e vídeos
- **Fotos** — avatar/foto de perfil e imagens fornecidas para grupos.

### Informações financeiras
- **Informações de pagamento** — dados relacionados ao rateio/Pix, incluindo chave Pix quando cadastrada, nome do recebedor, cidade do recebedor e situação de pagamento.

A classificação exata de cada campo deve seguir as opções apresentadas pelo Play Console.

### Atividade no app
- participação em grupos e partidas;
- presença e lista de espera;
- escalação/times;
- gols, assistências e resultados;
- avaliações e ranking.

Esses dados são necessários para as funcionalidades esportivas e de organização do aplicativo.

## 2. Localização

A revisão do código não identificou `navigator.geolocation` nem rastreamento contínuo da localização física do usuário/dispositivo.

O aplicativo pode armazenar endereço e coordenadas **do local esportivo cadastrado para a partida/grupo**. Esses dados representam o local do evento, não a localização física do dispositivo do usuário.

Portanto, não há evidência técnica para declarar coleta de localização do dispositivo no Data Safety com base apenas nesses campos de local esportivo.

## 3. Coleta e finalidade

Os dados acima são coletados quando o usuário fornece ou gera informações por meio das funcionalidades do aplicativo e são usados para:

- criação e manutenção da conta;
- identificação do usuário;
- formação e administração de grupos;
- organização de partidas;
- controle de presença e lista de espera;
- formação de times;
- resultados, estatísticas, avaliações e ranking;
- organização/conferência de rateios e pagamentos via Pix;
- exibição de informações necessárias a integrantes autorizados dos grupos e participantes das partidas.

Não foi identificado propósito de publicidade comportamental.

## 4. Compartilhamento e provedores

O aplicativo utiliza Supabase para autenticação, banco de dados e armazenamento e Vercel para hospedagem.

Esses serviços atuam como infraestrutura do aplicativo. A resposta de **compartilhamento** no Play Console deve seguir a definição vigente de service provider e as perguntas específicas do formulário; não deve ser presumido compartilhamento para publicidade ou venda de dados.

Dentro do próprio aplicativo, determinadas informações podem ser apresentadas a usuários autorizados de um grupo/partida como parte da funcionalidade do serviço.

## 5. Segurança

Foram identificados:
- autenticação;
- políticas de controle de acesso no Supabase;
- comunicação HTTPS/TLS;
- fluxo autenticado de exclusão da própria conta.

## 6. Exclusão de conta e dados

O aplicativo possui:

- página pública: `/exclusao-conta`;
- fluxo autenticado: `/exclusao-conta/confirmar`;
- confirmação explícita antes da exclusão;
- função `public.delete_my_account()` restrita a usuários autenticados.

A exclusão remove os dados pessoais associados à conta e os objetos de avatar pertencentes ao usuário. Referências necessárias para preservar a atividade de grupos/partidas de outros usuários são desvinculadas em vez de apagar a atividade coletiva.

> **Validação:** a estrutura, ACL e dependências da rotina foram auditadas. A execução destrutiva contra uma conta real não foi realizada; portanto, a validação end-to-end de exclusão permanece como teste controlado pendente.

## 7. URLs públicas

**Política de privacidade:**
`https://futebol-society-app.vercel.app/privacidade`

**Exclusão de conta:**
`https://futebol-society-app.vercel.app/exclusao-conta`

As duas páginas estão publicadas e acessíveis publicamente.

## 8. Publicidade e analytics

Na revisão do repositório não foram identificados SDKs de publicidade ou analytics como Google Analytics, AdSense ou Firebase Analytics.

Essa conclusão deve ser revalidada contra o build final caso sejam adicionados novos scripts, SDKs ou serviços de terceiros.

## 9. Checklist antes do envio ao Play Console

- [x] Política de privacidade pública.
- [x] Política de privacidade acessível dentro do aplicativo.
- [x] Página pública de exclusão de conta.
- [x] Caminho de exclusão dentro do aplicativo.
- [x] Função de exclusão protegida por autenticação.
- [x] Build Android assinado gerado em CI.
- [x] Digital Asset Links publicados em produção.
- [x] Target API 36 configurado no build Android.
- [ ] Executar teste controlado de exclusão com conta descartável.
- [ ] Conferir o formulário Data Safety vigente no Play Console contra o build final.
- [ ] Confirmar classificação de Pix/pagamentos no formulário vigente.
- [ ] Confirmar classificação de peso/dados esportivos como fitness.
- [ ] Confirmar todas as declarações de coleta/compartilhamento para cada tipo de dado.
- [ ] Preencher declaração de exclusão de dados no Play Console.
- [ ] Preparar screenshots e demais assets da ficha da loja.

## 10. Referências oficiais

- Google Play — Dados do usuário: política de privacidade e exclusão de conta.
- Google Play — Segurança dos dados: categorias e finalidades de dados.
- Google Play — Requisitos de exclusão de contas.

## 11. Conclusão

A parte técnica necessária para privacidade, exclusão de conta, build Android assinado e associação do domínio com o aplicativo está preparada.

O projeto ainda não deve ser tratado como **100% pronto para publicação** até concluir o teste controlado de exclusão e o preenchimento/conferência final do Data Safety no Play Console.