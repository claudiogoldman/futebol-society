# Inventário de branches — Futebol Society

Atualizado em 2026-09-10.

## Fonte de verdade

- `main` — OFICIAL. É a única branch de referência para novas correções, funcionalidades, QA e deploy.

## Branches históricas / não usar diretamente

As branches antigas relacionadas a chat, tactical pitch, game location, UI finalization, hydration e group-admin representam linhas de desenvolvimento anteriores e estão divergentes de `main`. Não devem ser usadas como base de novas implementações.

## Regra de recuperação

Código de branch antiga só deve ser reaproveitado após comparação explícita com `main` e confirmação de que a funcionalidade não foi incorporada ou substituída.

## Pull requests históricos

- PR #17: não mergear. É uma linha antiga e divergente da arquitetura atual.
- PRs de chat já encerrados/mesclados: não reabrir para recuperar implementação.

## Política operacional

1. Criar novas branches sempre a partir de `main`.
2. Não sincronizar branches antigas para trazê-las de volta ao fluxo.
3. Antes de qualquer merge, validar CI e diff contra `main`.
4. Após produção, remover branches temporárias quando não houver uso residual.
