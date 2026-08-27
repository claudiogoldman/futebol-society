# Auditoria técnica — Futebol Society

## Escopo analisado

**Origem:** código do repositório `claudiogoldman/futebol-society`, branch `main`, commit `794477c1280c08cafd0ff859bd03d26dbfb32742`.

A análise cobre exclusivamente os arquivos versionados no repositório:

- `app/page.js`
- `app/layout.js`
- `lib/supabaseClient.js`
- `next.config.js`
- `package.json`
- `README.md`

A estrutura, políticas RLS, migrations, triggers, RPCs e configuração do projeto Supabase **não estão versionadas neste repositório**. Portanto, qualquer regra dependente desses elementos está classificada como **não identificada na documentação analisada**.

---

## 1. Requisitos documentados no código

### Autenticação

**Origem:** `app/page.js` e `lib/supabaseClient.js`.

- A aplicação depende de uma sessão Supabase.
- Há fluxo de autenticação com Google.
- Usuários autenticados acessam a aplicação principal.

### Jogadores

**Origem:** `app/page.js`.

O código implementa:

- perfil de jogador;
- posições;
- identificação de goleiro;
- idade e peso opcionais;
- telefone opcional;
- chave Pix;
- avatar;
- atributos ATA, DEF, FOR e HAB;
- cálculo de OVR;
- avaliação por estrelas.

### Partidas

**Origem:** `app/page.js`.

O código implementa:

- criação de partida;
- confirmação e cancelamento de presença;
- ordenação das confirmações por `confirmed_at`;
- limite de jogadores;
- lista de espera derivada da ordem das confirmações;
- custo da quadra;
- configuração sobre cobrança do goleiro;
- pagamentos;
- Pix por partida;
- resultado;
- gols;
- assistências;
- avaliações;
- compartilhamento por WhatsApp;
- convite por token.

### Sorteio de times

**Origem:** função `drawTeams` em `app/page.js`.

A implementação atual:

1. separa goleiros e jogadores de linha;
2. ordena goleiros por avaliação;
3. distribui jogadores buscando reduzir a diferença de rating acumulado;
4. utiliza peso e idade apenas como critério secundário;
5. adiciona aleatoriedade à ordenação dos jogadores de linha.

### Ranking

**Origem:** função `computeRanking` em `app/page.js`.

A implementação atual considera:

- jogos;
- vitórias;
- empates;
- derrotas;
- gols;
- assistências;
- média das avaliações;
- MVP;
- Muro;
- frequência;
- pontos.

A pontuação implementada é:

- vitória: 3 pontos;
- empate: 1 ponto;
- derrota: 0 pontos.

A ordenação atual é:

1. pontos;
2. gols;
3. vitórias.

### Grupos

**Origem:** `app/page.js`.

O código implementa grupos com:

- nome;
- proprietário;
- local padrão;
- dia padrão;
- horário padrão;
- limite padrão de jogadores;
- custo padrão;
- membros;
- convite por token.

---

## 2. Decisões de implementação identificadas

Estas decisões são observadas no código. Não há, no repositório analisado, documento externo que demonstre que foram requisitos formais de negócio.

### D01 — Interface concentrada em uma página

**Origem:** estrutura do repositório.

Grande parte da aplicação, incluindo componentes, regras de negócio, acesso ao Supabase e estilos, está concentrada em `app/page.js`.

### D02 — Carregamento consolidado

**Origem:** função `loadAll` em `app/page.js`.

A aplicação consulta diversas tabelas em paralelo e monta no cliente uma representação consolidada das partidas.

### D03 — Controle visual de permissões

**Origem:** `GameDetail` e demais componentes em `app/page.js`.

Diversas ações são ocultadas ou desabilitadas no cliente conforme o usuário atual.

A garantia de autorização no banco **não identificado na documentação analisada**.

---

## 3. Riscos e inconsistências identificados

### R01 — Arquivo monolítico

**Evidência:** `app/page.js` concentra aproximadamente 100 KB de código.

**Impacto:** alto custo de manutenção, maior risco de regressão e dificuldade para testes unitários.

### R02 — Ausência de tratamento consistente de erros do Supabase

**Origem:** operações identificadas em `app/page.js`.

Diversas leituras e gravações são executadas com `await`, seguidas de recarga dos dados, sem tratamento uniforme do objeto `error` retornado pelo Supabase.

**Impacto:** uma falha pode não ser apresentada adequadamente ao usuário.

### R03 — Segurança efetiva depende de RLS não versionado

**Origem:** `app/page.js` utiliza controles visuais para limitar ações, mas o repositório não contém políticas RLS.

**Conclusão:** não é possível validar, a partir da documentação analisada, se um usuário poderia contornar a interface e executar uma alteração diretamente contra o Supabase.

### R04 — Possível inconsistência entre mensagem e comportamento de edição

**Origem:** comentários e interface de `app/page.js`.

Há indicação na interface de que administradores poderiam editar partidas de outros organizadores, enquanto a variável `canManage` é calculada comparando o usuário atual com `game.createdBy`.

**Conclusão:** comportamento definitivo deve ser confirmado no código completo e no requisito funcional antes de alteração.

### R05 — Modelo de dados e infraestrutura ausentes do repositório

Não foram identificados migrations, schemas, políticas RLS, funções SQL ou documentação das RPCs.

**Regra de negócio correspondente:** não identificada na documentação analisada.

---

## 4. Recomendações técnicas

### RT01 — Separar domínio, UI e persistência

Estrutura recomendada:

```text
app/
  page.js
components/
  auth/
  games/
  groups/
  players/
  ranking/
  ui/
lib/
  domain/
  services/
  supabase/
```

**Classificação:** recomendação técnica.

### RT02 — Extrair regras puras para módulos testáveis

Prioridade inicial:

- sorteio de times;
- cálculo de destaques;
- cálculo de ranking;
- cálculo de rateio;
- cálculo de lista de espera;
- geração de Pix.

**Classificação:** recomendação técnica.

### RT03 — Centralizar acesso ao Supabase

Criar serviços específicos para:

- partidas;
- grupos;
- jogadores;
- pagamentos;
- avaliações.

**Classificação:** recomendação técnica.

### RT04 — Padronizar tratamento de erro

Cada operação de leitura e escrita deve ter retorno explícito de sucesso ou erro para a camada de interface.

**Classificação:** recomendação técnica.

### RT05 — Versionar infraestrutura do banco

Adicionar migrations e políticas RLS ao repositório.

Sem isso, a segurança e a integridade das regras de acesso não podem ser auditadas integralmente.

**Classificação:** recomendação técnica.

---

## 5. Ordem recomendada de execução

1. preservar e documentar o comportamento atual;
2. extrair funções puras sem alterar comportamento;
3. adicionar testes para essas funções;
4. centralizar serviços Supabase;
5. separar componentes da página principal;
6. revisar tratamento de erros;
7. versionar schema, migrations e RLS;
8. validar build e fluxos principais.

Nenhuma regra de negócio nova deve ser introduzida durante a refatoração sem origem explícita.
