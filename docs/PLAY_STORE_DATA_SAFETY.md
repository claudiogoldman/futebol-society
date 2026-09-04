# Google Play — Data Safety (pré-auditoria técnica)

> **Status:** documento técnico preliminar. Deve ser conferido no formulário vigente do Google Play Console antes do envio/publicação.
>
> **Base:** código e funcionalidades atualmente identificados no repositório `futebol-society`.

## 1. Conta e identificação

O aplicativo permite criação/autenticação de conta e mantém dados de perfil.

**Dados identificados:**
- e-mail;
- identificadores técnicos da conta;
- nome;
- telefone, quando informado;
- idade, quando informada;
- nacionalidade, quando informada.

**Finalidades:** funcionamento da conta, identificação do usuário, organização de grupos e partidas e comunicação relacionada ao serviço.

**Exclusão:** existe fluxo autenticado de exclusão da conta e página pública para solicitação de exclusão.

## 2. Informações esportivas / perfil

**Dados identificados:**
- peso, quando informado;
- pé preferido;
- posições de jogo;
- atributos esportivos;
- presença e participação em partidas;
- times;
- gols e assistências;
- avaliações e ranking.

**Finalidades:** personalização do perfil, organização das partidas, estatísticas e funcionalidades esportivas.

> A classificação exata entre as categorias de dados do Play Console deve ser conferida no formulário vigente, especialmente para peso e demais informações potencialmente relacionadas a saúde/fitness.

## 3. Fotos e imagens

**Dados identificados:**
- foto/avatar de perfil;
- imagens de grupos.

**Finalidade:** identificação visual do usuário e/ou grupo dentro do aplicativo.

## 4. Localização

O código atualmente analisado não identificou uso de `navigator.geolocation` nem rastreamento contínuo da localização do dispositivo.

O aplicativo armazena, quando cadastrados, endereço e coordenadas do **local esportivo da partida/grupo**.

Esses dados representam o local do jogo, não um histórico de localização física contínua do usuário. A classificação no Play Console deve ser confirmada conforme a definição vigente de cada categoria.

## 5. Informações financeiras / Pix

**Dados identificados:**
- situação de pagamento do rateio;
- chave Pix, quando cadastrada pelo responsável;
- nome do recebedor;
- cidade do recebedor.

**Finalidade:** organização e conferência do rateio das partidas.

> A categoria exata de informação financeira deve ser escolhida conforme as opções apresentadas pelo Play Console no momento do preenchimento.

## 6. Atividade no aplicativo

**Dados identificados:**
- participação em grupos e partidas;
- presença/lista de espera;
- escalação/times;
- resultados e estatísticas;
- avaliações;
- ranking.

**Finalidade:** organização e funcionamento das partidas e grupos.

## 7. Compartilhamento / provedores

Os dados são processados pela infraestrutura usada pelo aplicativo, incluindo Supabase para autenticação, banco de dados e armazenamento e Vercel para hospedagem.

O tratamento por provedores de infraestrutura em nome do desenvolvedor deve ser classificado de acordo com a definição vigente de **service provider** do Google Play Data Safety, sem presumir que isso seja compartilhamento para publicidade ou venda de dados.

Dentro do próprio aplicativo, dados necessários à organização podem ser exibidos a integrantes autorizados de grupos e participantes de partidas. Isso deve ser considerado ao responder às perguntas de acesso/compartilhamento do formulário.

## 8. Publicidade e analytics

Na revisão atual do repositório não foram identificados SDKs de publicidade ou analytics como Google Analytics, AdSense ou Firebase Analytics.

Isso deve ser revalidado caso novos SDKs, scripts, serviços de métricas ou componentes de terceiros sejam adicionados futuramente.

## 9. Segurança

Foram identificados:
- autenticação;
- controles de acesso no banco de dados;
- políticas de acesso configuradas no Supabase;
- comunicação HTTPS/TLS;
- fluxo protegido para exclusão da própria conta.

## 10. Exclusão de conta

O aplicativo possui:

- página pública: `/exclusao-conta`;
- fluxo autenticado: `/exclusao-conta/confirmar`;
- confirmação explícita antes da exclusão;
- função de banco `public.delete_my_account()` restrita a usuários autenticados;
- remoção dos dados pessoais associados à conta, preservando referências de grupos/partidas apenas quando necessário para não apagar a atividade de outros usuários.

A URL pública de referência para o Play Console é:

`https://futebol-society-app.vercel.app/exclusao-conta`

## 11. Política de privacidade

URL pública:

`https://futebol-society-app.vercel.app/privacidade`

A política identifica o responsável pelo aplicativo, contato de privacidade, tipos de dados, finalidades, acesso/compartilhamento, segurança, retenção e exclusão.

## 12. Pontos que ainda exigem decisão no Play Console

Antes da publicação, conferir diretamente no formulário vigente:

1. categoria exata para peso/fitness;
2. categoria exata para dados de Pix/pagamento;
3. tratamento da localização do local esportivo cadastrado;
4. quais dados são coletados obrigatoriamente versus opcionalmente;
5. se cada tipo de dado é coletado, compartilhado ou ambos segundo a definição do formulário;
6. criptografia em trânsito;
7. possibilidade de solicitação de exclusão;
8. declaração de que o aplicativo não vende dados;
9. todos os SDKs/serviços de terceiros efetivamente presentes no build enviado.

## 13. Conclusão da pré-auditoria

A infraestrutura necessária para as declarações de privacidade e exclusão de conta já está publicada em produção. O preenchimento do Data Safety deve ser feito somente após conferir as categorias do formulário atual do Play Console e confrontá-las com o build que será enviado.
