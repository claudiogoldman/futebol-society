# Churrasco Society — decisões funcionais consolidadas

Atualizado em 15/11/2026. Esta especificação registra as decisões autorizadas pelo responsável do produto nesta conversa.

## Decisões aprovadas

| Tema | Decisão |
|---|---|
| Reabertura após encerramento manual | Permitida, desde que o evento ainda não tenha iniciado. |
| Reabertura após encerramento automático | Não permitida. |
| Reabertura após cancelamento | Não permitida. |
| Nomes duplicados | Permitidos; cada convidado permanece identificado por seu próprio registro e token. |
| Nome do convidado | Obrigatório, após trim, entre 1 e 100 caracteres. |
| Proteção contra automação | Implementar rate limiting para inclusão pública de convidados. Não exigir CAPTCHA inicialmente; reavaliar se houver abuso. |
| Expiração de links | Sem expiração temporal automática. O link deixa de permitir operações quando o evento fecha/cancela ou quando o administrador renova o link público. |
| Auditoria | Registrar inclusão, alteração e exclusão de eventos/convidados, incluindo estado anterior e posterior e ator quando autenticado. Não armazenar hashes de tokens no log. |
| Exclusão do grupo | Bloqueada enquanto existirem eventos vinculados. A FK `ON DELETE RESTRICT` já implementa a proteção no banco. |
| Horário de início | Obrigatório e usado como instante de encerramento automático. |

## Estados e operações

- `OPEN`: inclusão e operações de presença permitidas enquanto o horário de início não tiver chegado.
- `CLOSED`: consulta pública disponível; alterações e confirmações bloqueadas.
- `CANCELLED`: consulta pública informa cancelamento; registros preservados; alterações bloqueadas.
- Encerramento manual pode ser reaberto somente antes do início.
- Encerramento automático e cancelamento são finais.

## Alterações técnicas versionadas nesta revisão

Migration adicionada à branch `feat/churrasco-society`:

- `20261115190000_social_event_guest_limits_and_audit.sql`
- Adiciona limite de 100 caracteres para nomes de convidados.
- Cria trilha de auditoria para eventos e convidados.
- Remove hashes de tokens dos snapshots de auditoria.
- A tabela de auditoria não concede leitura direta a `anon` ou `authenticated`.

## Pendências de implementação

1. Rate limiting: decisão aprovada, mas requer implementação e validação do mecanismo de identificação da origem das requisições. Não considerar concluído até validar que o IP é obtido de cabeçalho confiável do gateway e que a contagem persiste mesmo quando a solicitação é bloqueada.
2. Interface: adicionar validação visual de 100 caracteres nos campos de nome, além da validação obrigatória no banco.
3. Auditoria: validar a migration em PostgreSQL isolado e confirmar os registros gerados em operações administrativas e públicas.
4. Homologação autenticada: ainda não executada.

## Ambiente e publicação

- As dez migrations originais do Churrasco, incluindo `social_event_close_commit`, constam no histórico do Supabase de produção.
- A migration `20261115190000_social_event_guest_limits_and_audit.sql` está apenas versionada na branch; não foi aplicada ao banco.
- O build Vercel do commit `5c17a350b6341ff529df71d167e08d829132ddae` está `READY`.
- A URL de preview respondeu HTTP 200 quando consultada por sessão autenticada da Vercel. O workflow GitHub Actions sem autenticação recebeu a página de proteção da Vercel e falhou ao validar o título da aplicação; isso é bloqueio de acesso ao preview, não evidência de falha do app.
- Não houve merge na `main` nem promoção para produção.
