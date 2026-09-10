# Fechamento técnico — backlog priorizado

## P0 — funcionalidade / produção
- [x] Pé preferencial alinhado entre UI e banco; salvamento confirmado em produção.
- [x] Promoção da waitlist mantém FIFO e agora gera `game_waitlist_promoted`.
- [ ] QA E2E do fluxo completo de waitlist e notificação.

## P1 — consistência de domínio
- [ ] Isolar `setGameMaxPlayers()` como compatibilidade; impedir que seja tratado como fonte de verdade.
- [ ] Garantir que toda alteração de capacidade derive de `players_per_team + reserves_per_team`.
- [ ] Revisar realtime de reações do chat para não receber eventos de outras partidas.
- [ ] Remover duplicação de helpers de jogador/posição/OVR da página principal.
- [ ] Corrigir atribuição duplicada do recebedor PIX na criação de partida.

## P1 — notificações
- [x] Confirmado/cancelado na partida.
- [x] Entrada em grupo.
- [x] `@mention` com trigger DB.
- [x] Promoção da waitlist.
- [ ] Entrada na waitlist.
- [ ] Alteração de partida/local/horário.
- [ ] Sorteio.
- [ ] Resultado.
- [ ] Avaliação.
- [ ] Pagamento.

## P2 — QA e segurança
- [ ] E2E autenticado com estado válido.
- [ ] RLS/autorização em fluxos críticos.
- [ ] Exclusão de conta em produção.
- [ ] QA de pós-partida/ranking.
