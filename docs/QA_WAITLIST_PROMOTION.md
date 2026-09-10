# QA — promoção da lista de espera

## Teste executado
- Ambiente: Supabase produção
- Cenário: partida com capacidade totalmente ocupada
- Ação: inserir temporariamente um membro válido na waitlist e remover uma confirmação existente
- Resultado: a função `promote_next_game_waitlist()` selecionou o primeiro da fila, criou a confirmação e removeu a entrada da waitlist.
- Resultado adicional esperado: criação de `notifications.type = game_waitlist_promoted` para o usuário promovido.
- Persistência: teste executado dentro de transação e finalizado com `ROLLBACK`; nenhum dado de teste permaneceu.

## Limitação
O teste acima comprova o comportamento do trigger/função no banco, mas não substitui o E2E com dois usuários autenticados e cliente realtime.

## Próximo teste E2E
1. Usuário A ocupa a última vaga.
2. Usuário B entra na waitlist.
3. Usuário A sai.
4. Usuário B é promovido automaticamente.
5. Usuário B recebe `game_waitlist_promoted` no sino.
6. Recarregar a aplicação e confirmar persistência da confirmação e da notificação.
