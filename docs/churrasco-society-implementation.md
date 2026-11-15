# Churrasco Society — implementação

Branch de trabalho: `feat/churrasco-society`

## Escopo aprovado

- Todo evento pertence a um grupo existente.
- A administração ocorre no contexto do grupo.
- Convidados e participantes não têm limite definido.
- A identificação obrigatória do convidado é somente o nome.
- Cadastro público por link e cadastro administrativo.
- Confirmação, cancelamento e reconfirmação por token individual.
- A página pública exibe somente nomes confirmados e totais; nunca exibe pendentes ou cancelados.
- Encerramento manual ou automático no instante de início do evento.
- Após encerramento, a consulta pública permanece disponível e as operações de presença ficam bloqueadas.
- Reabertura permitida após encerramento manual.
- Cancelamento preserva evento, convidados e confirmações.
- Não há controle financeiro.
- O módulo não deve alterar partidas, jogadores, rankings, sorteios, pontos ou penalidades.

## Arquivos adicionados nesta etapa

- `supabase/migrations/20261115003000_create_social_events.sql`: tabelas isoladas, índices, RLS e bloqueio de exclusão do grupo por FK `ON DELETE RESTRICT`.
- `lib/services/social-event-service.js`: fronteira de serviços para administração e fluxos públicos via RPC.

## Segurança planejada

- Tokens públicos e individuais são armazenados como hashes nas tabelas.
- Clientes públicos não recebem acesso direto às tabelas.
- Operações públicas devem ocorrer por RPCs específicas, com validação de token e estado do evento.
- Operações administrativas devem validar `public.is_group_admin(group_id)` no banco.
- Funções privilegiadas futuras devem fixar `search_path`, revogar execução de `PUBLIC` e conceder somente aos papéis necessários.
- Nenhuma regra de autorização depende de metadados editáveis pelo usuário.

## Pendências de implementação

1. Implementar RPCs administrativas e públicas; os nomes chamados pelo service são o contrato pretendido, ainda não existem na migration inicial.
2. Gerar tokens criptograficamente aleatórios no banco, persistindo somente hashes e retornando o token bruto apenas na criação.
3. Implementar fechamento automático com verificação lazy nas operações e agendamento no Supabase. `pg_cron` estava disponível, mas não instalado na auditoria; sua ativação ainda não foi executada.
4. Integrar aba e cartão Churrasco em `GroupTabs` e `GroupDetail`.
5. Criar páginas públicas `/churrasco/[token]` e `/churrasco/confirmar/[token]`.
6. Testes de autorização, enumeração de tokens, estados, fuso horário, idempotência e regressão do futebol.
7. Reconciliar o histórico de migrations (145 entradas no banco versus 64 arquivos versionados na auditoria) antes de aplicar qualquer migration no projeto Supabase.

## Regras temporais

Banco em UTC. A data e hora do evento representam horário local de São Paulo; a comparação deve usar:

`((event_date + event_time) AT TIME ZONE 'America/Sao_Paulo') <= now()`

A rotina agendada não substitui a validação de horário dentro de cada RPC.

## Estado de publicação

Esta branch contém somente preparação versionada. Nenhuma migration foi aplicada ao Supabase, nenhuma alteração foi feita na `main`, e não houve deploy.


## Progresso da implementação (2026-11-15)

### Entregas versionadas na branch
- Aba Churrasco adicionada ao componente de navegação do grupo.
- Cartão administrativo no contexto do grupo para criar, editar, encerrar, reabrir e cancelar eventos.
- Gestão administrativa de convidados, com inclusão, alteração de situação e exclusão enquanto o evento está aberto.
- Página pública `/churrasco/[token]` com cadastro público por nome e listagem somente dos confirmados.
- Página individual `/churrasco/confirmar/[token]` para confirmar, cancelar e reconfirmar.
- RPCs para as operações administrativas e públicas, com tokens aleatórios e hashes SHA-256.
- RPC de listagem do grupo com encerramento automático lazy e retorno sem hashes.
- Migração opcional de agendamento via Supabase Cron, com verificação a cada segundo.
- Escrita direta nas tabelas de eventos/convidados revogada para usuários autenticados; alterações passam pelas RPCs.

### Observações de segurança e operação
- O acesso público usa tokens de 256 bits; o token bruto é exibido uma única vez na criação ou renovação.
- Renovar o link público do evento invalida o link público anterior.
- O link individual do convidado é apresentado após inclusão; os hashes não são retornados na listagem.
- A regra temporal é aplicada nas RPCs no instante da operação. O cron persiste o status em rotina recorrente; não é a única proteção.
- A migração de Cron depende de `pg_cron` disponível/instalável no projeto Supabase.
- Nenhuma migration foi aplicada ao banco de produção.

### Verificação
- Um build de preview da branch concluiu com estado READY no commit `3a77b229a58c70aa570e369c11b159a51aef9164`.
- Um build anterior identificou e permitiu corrigir um literal de quebra de linha inválido em `group-tabs.js` e uma exportação duplicada em `social-event-service.js`.
- As alterações posteriores a esse build ainda aguardam conclusão de novo build.
- Testes automatizados de domínio foram adicionados ao script `npm test`, mas ainda não há execução confirmada nesta etapa.


### Decisões ainda pendentes — não tratar como requisitos aprovados
- **Exclusão do grupo:** a FK inicial está configurada como `ON DELETE RESTRICT` para preservar eventos. Isso é uma proteção conservadora provisória, mas a regra de negócio sobre excluir grupos com eventos vinculados ainda precisa de confirmação antes de aplicar a migration.
- **Nomes duplicados:** a tabela não impõe unicidade por nome; portanto, atualmente aceita nomes iguais. Essa escolha permanece pendente de confirmação.
- **Proteção contra cadastros automatizados:** mecanismo anti-bot/rate limiting ainda não foi escolhido.
- **Auditoria/histórico:** tabela de histórico não foi criada; continua sendo recomendação técnica opcional.
