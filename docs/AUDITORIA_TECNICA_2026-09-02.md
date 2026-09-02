# Auditoria técnica — atualização 2026-09-02

## Escopo

Revisão do branch `main`, banco Supabase de produção e deploy Vercel do projeto Futebol Society.

## Regras confirmadas

### Grupos e administração

- O proprietário/criador do grupo é administrador automaticamente.
- Administradores podem promover/remover outros administradores.
- Membro comum não pode se auto-promover.

### Suplentes / lista de espera

Regra definida pelo produto:

- Quando a partida atingir `max_players`, novos participantes entram em uma lista de suplentes persistente.
- A fila é FIFO, pela ordem de entrada.
- O próprio participante deve conseguir saber que está na lista e sua posição.
- Quando uma vaga for liberada antes do encerramento da partida, o primeiro suplente é promovido automaticamente para `game_confirmations`.
- A promoção não ocorre depois que a partida estiver encerrada.

A camada de banco implementa a fila em `game_waitlist`, o ingresso automático no `join_game_by_token()` e a promoção pelo trigger `trg_promote_next_game_waitlist`.

## Integridade de participantes

Resultado da verificação em produção:

- pagamentos sem confirmação: 0
- jogadores em times sem confirmação: 0
- partidas acima da capacidade: 0
- partidas agrupadas com organizador fora do grupo: 0
- grupos com mais de um local padrão: 0
- avaliações envolvendo não participantes: 0
- duplicidades na lista de espera: 0

## Capacidade da partida

A capacidade é protegida em múltiplas camadas:

1. `join_game_by_token()` verifica a capacidade e, se lotada, registra o participante na fila;
2. `add_game_guest()` verifica a capacidade;
3. trigger `trg_enforce_game_confirmation_capacity` protege inserções em `game_confirmations` e utiliza lock da partida;
4. a promoção da fila também respeita a capacidade e ocorre antes do encerramento.

## Partida encerrada

Foi definida e implementada a regra de que, após o encerramento da partida, somente administrador do grupo/proprietário pode alterar dados estruturais da partida.

No modelo atual, uma partida é considerada encerrada quando `score_a` e `score_b` estão ambos preenchidos. O criador/organizador ainda pode registrar o resultado final; depois disso, alterações estruturais ficam restritas a administrador.

A restrição abrange, entre outros:

- dados da partida;
- remoção/inclusão de participantes;
- times e novo sorteio;
- convidados;
- gols/estatísticas estruturais;
- registros financeiros da partida.

As avaliações (`ratings`) continuam sendo uma ação pós-partida dos próprios participantes e não foram bloqueadas por essa regra.

## Participante financeiro

Existe trigger que garante que um usuário que receba um registro em `payments` também seja confirmado na partida. A inserção de confirmação fica sujeita à mesma proteção de capacidade.

## Avaliações

A política de inserção/alteração de `ratings` exige que tanto avaliador quanto avaliado sejam participantes confirmados da mesma partida.

## RPCs e SECURITY DEFINER

As funções `SECURITY DEFINER` verificadas usam `search_path` explícito para `public`. Funções exclusivas de trigger não ficam expostas para execução normal por usuários autenticados.

## Legado removido

`app/consolidated-manager.js` foi removido da aplicação porque duplicava as funções de convidados e locais, usava `accepted_at` legado e mantinha comportamento diferente do fluxo principal.

## Pendências técnicas identificadas

1. `app/page.js` continua monolítico e concentra UI, domínio e persistência.
2. A interface ainda precisa exibir claramente o estado `suplente` e a posição do usuário na fila no fluxo da partida.
3. O cadastro de local dentro de `GroupDetail` ainda é inline; a evolução para modal/popup continua recomendada.
4. Há um campo legado `game_guests.accepted_at` sem uso no fluxo principal.
5. Existem duas árvores históricas de migrations no repositório (`migrations/` e `supabase/migrations/`); a consolidação deve ser tratada separadamente para não alterar o histórico aplicado em produção.
6. O controle visual de permissões de partidas deve continuar sendo alinhado com as permissões RLS de grupo.

## Classificação

- Integridade e segurança: **implementado e verificado**.
- Lista de espera persistente/FIFO/promoção automática: **regra definida e camada de banco implementada**.
- Exibição visual do estado de suplente: **pendência de UI**.
- Modal de locais: **recomendação de UX**.
- Consolidação das migrations: **pendência técnica de arquitetura**.
