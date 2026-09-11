# Auditoria funcional — 2026-09-11

## Estado verificado

### Produção
- Projeto Vercel: `futebol-society-app`
- Alias de produção: `https://futebol-society-app.vercel.app/`
- Último deployment verificado: `3af2f9429683117ffd2475ace43c1dfbcf2aa974`
- Estado Vercel: `READY`

### Partidas de produção
Existem atualmente 2 partidas cadastradas:

| Configuração | Titulares/equipe | Reservas/equipe | Capacidade | Resultado |
|---|---:|---:|---:|---|
| Partida 1 | 5 | 1 | 12 | não informado |
| Partida 2 | 6 | 0 | 12 | não informado |

As duas partidas possuem `score_a` e `score_b` nulos. Portanto, ainda não existe uma partida concluída em produção para comprovar o fluxo real de pós-partida.

## Pós-partida

### Implementado
- Registro do placar pelo criador da partida ou administrador do grupo.
- Registro de gols e assistências.
- Avaliação de 1 a 5 estrelas entre participantes.
- Bloqueio de autoavaliação no banco.
- Avaliação somente após partida concluída.
- Cálculo de média das avaliações.
- MVP, artilheiro, passador e muro.
- Ranking com participação, resultados, gols, assistências e destaques.

### Correção recente de segurança
A política de atualização de `games` foi ajustada para permitir que o criador registre o resultado final, mantendo a autoridade dos administradores de grupo. A validação do resultado exige placares não negativos quando informados.

### Correção recente de ranking
Foi identificado que a persistência atual guarda os gols dentro de `result.scorers`, enquanto parte do ranking ainda consultava apenas `game.scorers`. O domínio foi corrigido para utilizar `game.result.scorers` com fallback para o formato legado.

Commit: `21a0aeb2fa4819601677a83de2dc5aad73bd7743`.

## Campo tático

- Time A ocupa a metade superior.
- Time B ocupa a metade inferior por espelhamento.
- Pivô foi afastado da linha central.
- Reservas são exibidos fora do campo.
- Fotos e nickname são utilizados quando disponíveis.
- Balanceamento exibe OVR, idade e peso.
- A separação lógica foi corrigida e publicada em produção.

A validação visual real em 5x5, 6x6 e 7x7 continua pendente.

## Avaliações/RLS
A tabela `ratings` está protegida para:
- usuário autenticado;
- rater participante da partida;
- rated participante da partida;
- rater diferente do rated;
- partida concluída;
- nota entre 1 e 5.

Ainda não há avaliações persistidas em produção, portanto o funcionamento E2E da gravação/atualização permanece pendente de uma partida real concluída.

## Waitlist
Implementados:
- entrada;
- FIFO;
- posição;
- saída;
- promoção automática quando abre vaga.

A notificação `game_waitlist_promoted` possui função/trigger no banco, mas o teste transacional usado para validação foi revertido. Assim, a geração da notificação de promoção ainda não deve ser classificada como comprovada por dado persistido.

## E2E autenticado
O workflow autenticado está operacional, mas a última execução falhou porque o estado de autenticação armazenado em `PLAYWRIGHT_AUTH_STATE_B64` não foi aceito pela produção e a aplicação apresentou a tela de login.

Na mesma execução, os dois smoke tests públicos passaram. Não há evidência de falha funcional decorrente desse resultado.

## Pendências prioritárias
1. Renovar a sessão Playwright autenticada.
2. Executar E2E do fluxo pós-partida em partida real/controlada.
3. Comprovar persistência e atualização de ratings.
4. Comprovar MVP/ranking após ratings e resultado.
5. Comprovar waitlist + notificação em teste controlado sem rollback.
6. Executar matriz visual 5x5, 6x6 e 7x7 com reservas.
7. Revisar filtro `game_id` no realtime de reações do chat no service.
8. Eliminar `setGameMaxPlayers()` como configuração independente.
9. Consolidar helpers duplicados de jogador/posição/OVR.
10. Revisar atribuição duplicada do recebedor PIX.
11. Reconciliar migrations/triggers de notificações entre repositório e produção.

## Regra de classificação
Não marcar como `🟢 comprovado` uma funcionalidade apenas porque existe código para ela. Para classificação definitiva, exigir evidência de execução, persistência ou teste automatizado válido conforme o tipo da funcionalidade.
