# Addendum — Auditoria Técnica — 02/09/2026

## Escopo desta etapa

Continuidade da auditoria funcional, de integridade e segurança do domínio de grupos, partidas, participantes, suplentes, rateio, ranking e encerramento de partidas.

## Regras funcionais confirmadas

- O criador/dono do grupo é administrador automaticamente.
- O dono pode definir administradores do grupo.
- Um administrador pode definir outros administradores.
- Participante excedente ao limite de vagas permanece em lista persistente de suplentes.
- O participante deve conseguir identificar que está na lista e sua posição.
- A promoção de suplente é automática, em ordem FIFO, quando uma vaga é liberada.
- Depois de encerrada a partida (placar dos dois times registrado), alterações estruturais devem ficar restritas a administradores, incluindo remoção de participante e novo sorteio.

## Verificações realizadas

- Todos os objetos públicos relevantes estão com RLS habilitado.
- Grants públicos de tabelas foram restringidos aos comandos necessários para `authenticated`.
- Funções `SECURITY DEFINER` relevantes possuem `search_path=public` explícito.
- Não foram identificados grants `EXECUTE` para `anon` nas funções protegidas auditadas.
- Pagamentos sem confirmação correspondente: 0.
- Jogadores em times sem confirmação correspondente: 0.
- Gols sem confirmação correspondente: 0.
- Avaliações com avaliador não confirmado: 0.
- Avaliações com avaliado não confirmado: 0.
- Duplicidades na lista de suplentes: 0.
- A promoção automática da lista de suplentes foi validada em transação de teste e revertida ao final.

## Pontos ainda pendentes no código da interface

### 1. `GameDetail` não reflete integralmente a autorização de administrador de grupo

O componente ainda calcula `canManage` somente pelo criador da partida. O banco já autoriza administradores do grupo. Isso cria divergência entre autorização de backend e visibilidade dos controles na interface.

**Classificação:** defeito de interface/inconsistência de autorização.

### 2. Lista de suplentes antiga ainda aparece como lógica derivada de confirmações excedentes

O componente `GameDetail` ainda possui uma representação derivada de `confirmedPlayers.slice(maxPlayers)`. A fonte de verdade atual é `game_waitlist`. A UI global de status já utiliza a tabela persistente, mas o detalhe da partida ainda precisa ser alinhado.

**Classificação:** defeito de interface/modelagem legada.

### 3. Cadastro de local no detalhe do grupo permanece inline

A tela ainda contém o formulário completo de cadastro de local dentro da seção de locais cadastrados. Isso não está alinhado com a decisão de UX de usar uma ação compacta e modal.

**Classificação:** melhoria de UX pendente.

### 4. `localDraft` no salvamento dos padrões do grupo

Foi identificado uso de `localDraft` no método `save()` de `GroupDetail`, enquanto o estado atual do componente usa `locationDraft`. Isso pode provocar erro em tempo de execução ao salvar os padrões do grupo.

**Classificação:** defeito de execução.

### 5. Redução do limite de vagas

A alteração de `max_players` pode reduzir o limite abaixo da quantidade atual de confirmados. O banco impede novas confirmações acima do limite, mas não existe ainda regra explícita para decidir se os excedentes devem ser movidos automaticamente para a lista de suplentes ou se a redução deve ser bloqueada.

**Classificação:** decisão de negócio necessária; não alterar sem definição explícita.

### 6. Remoção de participante que já está em time

`game_teams` não possui vínculo referencial direto com `game_confirmations`. Portanto, a remoção de uma confirmação não determina automaticamente a remoção do jogador do sorteio/time.

**Classificação:** regra de negócio a confirmar antes de automatizar limpeza histórica.

## Ranking

A função de domínio utiliza a pontuação atual documentada no código: vitória = 3, empate = 1, derrota = 0. O ranking é calculado sobre partidas com resultado e é filtrado por grupo no chamador da interface.

Não foi identificada documentação adicional que estabeleça critérios de desempate além dos atualmente implementados (pontos, gols e vitórias).

**Classificação:** comportamento existente; não alterar sem requisito adicional.

## Migrations

O banco de produção possui histórico versionado das alterações recentes, incluindo endurecimento de RLS, capacidade, lista de suplentes, proteção pós-encerramento e grants. O repositório possui também uma árvore histórica em `supabase/migrations/` e uma árvore recente em `migrations/`.

**Recomendação:** não consolidar ou apagar migrations históricas durante a auditoria sem primeiro estabelecer qual árvore é a fonte oficial de novos deploys.
