# Auditoria técnica — atualização 2026-09-02

## Escopo

Revisão do branch `main`, banco Supabase de produção e deploy Vercel do projeto Futebol Society.

## Regras confirmadas

### Grupos e administração

- O proprietário/criador do grupo é administrador automaticamente.
- Administradores podem promover/remover outros administradores.
- Membro comum não pode se auto-promover.

Essas regras são refletidas na função `is_group_admin()` e nas políticas de `group_members`.

## Integridade de participantes

Foram verificadas as relações entre confirmações, times, pagamentos e partidas.

Resultado da verificação em produção:

- pagamentos sem confirmação: 0
- jogadores em times sem confirmação: 0
- partidas acima da capacidade: 0
- partidas agrupadas com organizador fora do grupo: 0
- grupos com mais de um local padrão: 0
- avaliações envolvendo não participantes: 0

## Capacidade da partida

A capacidade passou a ser protegida em três níveis:

1. `join_game_by_token()` verifica a capacidade;
2. `add_game_guest()` verifica a capacidade;
3. trigger `trg_enforce_game_confirmation_capacity` protege qualquer inserção direta em `game_confirmations` e utiliza lock da partida.

Isso evita que a regra dependa apenas da interface.

## Participante financeiro

Existe trigger que garante que um usuário que receba um registro em `payments` também seja confirmado na partida. A inserção de confirmação fica sujeita à mesma proteção de capacidade.

## Avaliações

A política de inserção/alteração de `ratings` exige que tanto avaliador quanto avaliado sejam participantes confirmados da mesma partida.

## RPCs e SECURITY DEFINER

- `add_game_guest()` permanece disponível apenas para `authenticated`, pois é uma RPC de aplicação.
- A execução pública/anônima dessa RPC foi revogada.
- Funções exclusivamente de trigger tiveram o `EXECUTE` removido de `authenticated`.
- Funções auxiliares de RLS e RPCs de convite continuam expostas somente conforme sua finalidade.

## Lista de espera / suplentes

O código de interface possui uma lista de espera derivada de confirmações acima de `max_players`. Porém, a camada de banco agora impede confirmações acima da capacidade.

Portanto, **não existe atualmente uma lista de espera persistente nem regra de promoção automática de suplente**.

Quando alguém cancela uma confirmação, a vaga fica livre. Um novo participante pode ocupar a vaga, mas não há mecanismo persistente que escolha automaticamente o próximo suplente.

A definição de uma fila real de suplentes e de sua regra de promoção é uma decisão de negócio ainda não identificada na documentação analisada.

## Legado removido

`app/consolidated-manager.js` foi removido da aplicação porque duplicava as funções de convidados e locais, usava `accepted_at` legado e mantinha comportamento diferente do fluxo principal.

O fluxo principal permanece em `app/page.js`.

## Pendências técnicas identificadas

1. `app/page.js` continua monolítico e concentra UI, domínio e persistência.
2. O cadastro de local dentro de `GroupDetail` ainda é inline; a evolução para modal/popup continua recomendada.
3. Há um campo legado `game_guests.accepted_at` sem uso no fluxo principal.
4. Existem duas árvores históricas de migrations no repositório (`migrations/` e `supabase/migrations/`); a consolidação deve ser tratada separadamente para não alterar o histórico aplicado em produção.
5. O texto/controle visual de permissões de partidas deve continuar sendo alinhado com as permissões RLS de grupo.

## Classificação

- Integridade e segurança acima: **implementado e verificado**.
- Lista de espera persistente/suplentes: **regra de negócio pendente**.
- Modal de locais: **recomendação de UX**.
- Consolidação das migrations: **pendência técnica de arquitetura**.
