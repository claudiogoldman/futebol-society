# Auditoria de notificações — Futebol Society

## Fonte de verdade
- Banco de produção: Supabase `xzytxhtzgqelublmqfyw`
- Código: branch `main`

## Geradores encontrados
A auditoria das funções PostgreSQL que referenciam `public.notifications` encontrou quatro geradores:

| Evento | Implementação | Estado |
|---|---|---|
| Confirmação na partida | `private.notify_game_confirmation_change()` | 🟢 |
| Cancelamento de presença | `private.notify_game_confirmation_change()` | 🟢 |
| Entrada no grupo | `private.notify_group_member_joined()` | 🟢 |
| `@mention` no chat | `private.notify_chat_mention()` | 🟢 implementação / 🟡 E2E |
| Promoção da waitlist | `public.promote_next_game_waitlist()` | 🟢 |

## Promoção da waitlist
O fluxo é acionado por `AFTER DELETE` em `game_confirmations`.

A função:
1. bloqueia a partida;
2. verifica capacidade;
3. seleciona o primeiro da fila por `queued_at, id`;
4. cria a confirmação;
5. cria `game_waitlist_promoted` para o usuário promovido;
6. remove a entrada da fila.

Foi executado um teste transacional controlado com partida cheia e usuário válido do grupo. A promoção ocorreu e a entrada da waitlist foi removida; o teste foi revertido com `ROLLBACK`, sem alterar dados reais.

## Eventos sem gerador DB-side encontrado
Não foram encontrados geradores PostgreSQL para:
- entrada na waitlist;
- alteração de partida/local/horário;
- sorteio realizado;
- resultado publicado;
- avaliação recebida;
- pagamento.

Esses eventos permanecem como 🟡/🔴 conforme o fluxo de produto, até validação E2E e definição de quais realmente exigem notificação.

## Observação importante
A infraestrutura de leitura/realtime das notificações já existe no frontend. A auditoria deve evitar criar novos geradores que dupliquem os triggers existentes.
