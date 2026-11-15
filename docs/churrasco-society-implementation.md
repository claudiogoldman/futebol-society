# Churrasco Society — implementação

Branch de trabalho: `feat/churrasco-society`

## 1. Escopo e decisões aprovadas

- Todo evento pertence a um grupo existente.
- A administração ocorre no contexto do grupo.
- Convidados e participantes não têm limite definido.
- A identificação obrigatória do convidado é somente o nome.
- O cadastro pode ser feito publicamente pelo link ou administrativamente.
- A confirmação, o cancelamento e a reconfirmação são feitos por token individual.
- A página pública exibe somente nomes confirmados e o total de confirmados; não exibe pendentes ou cancelados.
- O evento encerra automaticamente no instante de início (data/hora local de São Paulo) ou pode ser encerrado manualmente.
- Após encerramento, a consulta pública permanece disponível, mas operações de presença ficam bloqueadas.
- A reabertura é permitida somente para evento encerrado manualmente e ainda não iniciado.
- O cancelamento preserva evento, convidados e confirmações.
- Não há controle financeiro.
- O módulo não deve alterar partidas, jogadores, rankings, sorteios, pontos ou penalidades.

## 2. Estados implementados

### Evento
- `OPEN`: cadastro de convidados e operações de presença permitidos, respeitadas as validações de horário.
- `CLOSED`: consulta pública disponível; operações de presença bloqueadas.
- `CANCELLED`: página pública informa o cancelamento; registros preservados e operações bloqueadas.

Encerramento manual e automático resultam em `CLOSED`. Reabertura permitida: `CLOSED` com `closure_type = 'MANUAL'` para `OPEN`, desde que o início ainda não tenha ocorrido.

### Convidado
- `PENDING`
- `CONFIRMED`
- `CANCELLED`

A reconfirmação atualiza o mesmo registro. A implementação não impõe unicidade por nome; nomes iguais são aceitos enquanto não houver decisão de negócio diferente.

## 3. Estrutura de dados

### `public.social_events`
Contém vínculo obrigatório ao grupo, autor, nome, descrição, data/hora, local, hash do token público, estado, tipo e dados de encerramento/cancelamento e timestamps.

A FK de `group_id` usa `ON DELETE RESTRICT`. Esta é uma proteção técnica provisória, não uma decisão de negócio aprovada. A política para exclusão de grupos com eventos vinculados continua pendente.

### `public.social_event_guests`
Contém vínculo ao evento, nome, estado, hash do token individual e timestamps. Não há unicidade por nome.

Tokens brutos não são persistidos. Os hashes são armazenados em colunas inacessíveis diretamente aos papéis `anon` e `authenticated`.

## 4. Funcionalidades entregues na branch

- Aba Churrasco no contexto do grupo.
- Criação e edição administrativa de eventos.
- Encerramento, reabertura manual permitida e cancelamento.
- Geração e renovação do link público; renovar invalida o link anterior.
- Inclusão, edição de nome/situação e exclusão administrativa de convidados enquanto o evento está aberto.
- Geração de link individual de confirmação para convidados incluídos administrativamente.
- Cadastro público de convidado pelo link do evento, com emissão de link individual.
- Página pública `/churrasco/[token]`.
- Página individual `/churrasco/confirmar/[token]` para confirmar, cancelar e reconfirmar.
- Consulta pública mantida para eventos encerrados ou cancelados; somente confirmados e totais são exibidos.
- Verificações de estado e horário também nas RPCs, sem depender exclusivamente do agendamento.

## 5. Segurança e acesso

- RLS habilitada nas duas tabelas.
- A migration final revoga o acesso direto às tabelas para `anon` e `authenticated`; o acesso funcional ocorre por RPCs.
- RPCs privilegiadas usam `SECURITY DEFINER`, `search_path` fixo e grants explícitos.
- RPCs administrativas verificam `public.is_group_admin(group_id)`.
- RPCs públicas exigem token com 64 caracteres hexadecimais e comparam seu SHA-256 ao hash persistido.
- Tokens são gerados com 32 bytes aleatórios (256 bits).
- Listagens administrativas e públicas retornam campos explícitos e não retornam hashes.
- O link público pode ser renovado por administrador; o token anterior deixa de localizar o evento.

## 6. Regra temporal e encerramento automático

O banco armazena timestamps em UTC. Data e hora do evento representam horário local de São Paulo. A comparação utilizada nas RPCs e no agendamento é:

```sql
((event_date + event_time) AT TIME ZONE 'America/Sao_Paulo') <= clock_timestamp()
```

Há duas camadas:
1. Verificação lazy nas operações e listagens relevantes, para impedir operações após o horário de início.
2. Job do Supabase Cron para persistir o estado `CLOSED` automaticamente.

A migration do Cron instala `pg_cron` e agenda execução a cada segundo. A sintaxe de intervalo em segundos exige `pg_cron` 1.5 ou superior; confirmar a versão efetivamente disponível no ambiente-alvo antes da aplicação. Se a versão for inferior, a migration não deve ser aplicada sem adequar o agendamento.

## 7. Migrations versionadas

1. `20261115003000_create_social_events.sql`
2. `20261115014500_social_event_rpcs.sql`
3. `20261115021000_social_event_public_link.sql`
4. `20261115024500_social_event_member_access.sql`
5. `20261115030000_social_event_auto_close_cron.sql`
6. `20261115033000_social_event_list_and_public_grants.sql`
7. `20261115034500_social_event_restrict_direct_writes.sql`
8. `20261115040000_social_event_hide_token_hashes.sql`

As migrations estão versionadas na branch e ainda não foram aplicadas ao banco de produção.

## 8. Verificações já realizadas

- Build de preview da aplicação concluído com estado `READY` no commit `120c095b92a2aeb59e753d2a526a412d04e55236`.
- Depois desse build, as alterações registradas foram em migrations SQL e documentação, sem alteração posterior nos arquivos JavaScript/JSX.
- Testes isolados `tests/social-event.test.mjs` e `tests/invite-token.test.mjs` passaram em Node.js 22.16.0.
- `tests/game-domain.test.mjs` e o comando completo `npm test` ainda não foram executados.
- A revisão SQL feita até aqui é estática. As migrations ainda precisam ser aplicadas e testadas em ambiente isolado, nunca diretamente em produção sem autorização.

## 9. Pendências e riscos não aprovados como regra de negócio

### Decisões de negócio pendentes
- **Exclusão de grupo:** definir o comportamento quando há eventos vinculados. A FK `ON DELETE RESTRICT` é provisória.
- **Nomes duplicados:** a implementação aceita nomes iguais; a regra de negócio não foi definida.
- **Proteção anti-bot/rate limiting:** mecanismo não definido.
- **Auditoria/histórico:** tabela de histórico não foi criada; permanece recomendação opcional.
- **Reabertura após encerramento automático:** não aprovada; a implementação não permite.

### Revisão técnica pendente
A leitura estática das RPCs identificou que algumas operações públicas de inclusão/alteração de presença consultam o evento e depois fazem a escrita em instruções separadas, sem bloquear a linha do evento durante toda a transação. Uma operação concorrente de cancelamento ou encerramento pode, em condições de corrida, disputar com a inclusão/alteração. Antes de aplicar migrations, revisar e endurecer a serialização dessas transições com bloqueio transacional da linha do evento e testes concorrentes.

Também deve ser revisada a migração histórica do projeto: a auditoria anterior encontrou diferença entre o número de migrations registradas no banco e os arquivos versionados. Não aplicar esta sequência sem reconciliação do histórico no ambiente de teste.

## 10. Estado de publicação

- Branch de implementação: `feat/churrasco-society`.
- A branch `main` permanece preservada no commit original informado na auditoria.
- Nenhuma migration foi aplicada ao Supabase de produção.
- Nenhum merge para `main` foi realizado.
- Nenhum deploy de produção foi promovido.
- Previews automáticos da Vercel não comprovam funcionamento integrado ao banco enquanto as migrations não forem aplicadas em ambiente de teste.
