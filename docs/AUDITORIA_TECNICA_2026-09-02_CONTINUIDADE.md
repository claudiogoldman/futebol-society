# Continuidade da Auditoria Técnica — 02/09/2026

## Objetivo

Registrar a situação após a continuidade da auditoria funcional, de integridade e segurança do domínio Futebol Society, sem introduzir regras de negócio não definidas.

## Auditoria específica — usuário não administrador

### Capacidades permitidas identificadas

Com base nas políticas RLS atuais e no código da interface, um membro comum pode:

- visualizar os dados dos grupos dos quais participa;
- visualizar partidas às quais tem acesso;
- confirmar ou cancelar a própria presença em partida aberta;
- entrar/sair da lista de espera conforme o fluxo da partida;
- marcar o próprio pagamento;
- registrar/alterar os próprios gols e assistências enquanto a partida não estiver concluída;
- avaliar participantes confirmados da própria partida;
- editar os próprios dados de perfil permitidos pela interface;
- sair voluntariamente de um grupo;
- criar um novo grupo; nesse caso, passa a ser o proprietário e administrador derivado do grupo;
- criar uma partida. Quando a partida pertence a um grupo, a política permite a criação pelo membro do grupo; o criador torna-se o responsável pela partida para fins das políticas de gestão.

### Capacidades bloqueadas para membro comum

Um membro que não seja administrador do grupo não pode, pelas políticas RLS atuais:

- alterar os padrões do grupo;
- adicionar, editar, excluir ou definir local padrão do grupo;
- alterar/remover o papel de outro membro;
- remover outro membro do grupo;
- alterar dados administrativos da partida (local, custo, goleiro paga, organizador, PIX);
- adicionar convidado não cadastrado;
- alterar ou excluir participante de outra pessoa;
- sortear, remanejar, inserir, alterar ou excluir times;
- registrar/corrigir o resultado da partida;
- alterar estatísticas de outro participante;
- alterar ou excluir registros administrativos de pagamentos;
- excluir partida concluída.

### Ponto de atenção — criação de partida por membro

A política `games_insert_auth` permite que qualquer membro autenticado do grupo crie uma partida vinculada ao grupo, desde que `created_by = auth.uid()` e o usuário seja membro do grupo. Isso não foi classificado como defeito porque **não foi identificada na documentação uma regra que restrinja a criação de partidas exclusivamente a administradores**.

A interface também oferece o fluxo de criação de partida fora da área administrativa. Portanto, não alterar sem decisão de negócio.

### Ponto de atenção — pagamentos

O membro pode marcar o próprio pagamento. Isso é coerente com a interface atual, que permite ao próprio jogador registrar sua situação, e não concede ao membro comum poderes de conferência sobre outros jogadores. O banco mantém a exigência de confirmação do participante.

### Correção aplicada nesta etapa — estatísticas

Foi identificada uma diferença entre a intenção da interface e a proteção de banco: a política anterior de `goals` aceitava `is_game_member`, permitindo que um membro do grupo registrasse estatísticas próprias mesmo sem confirmação naquela partida.

Foi criada/aplicada a migration `harden_goal_participant_scope`, restringindo a escrita própria de gols/assistências a participante confirmado e mantendo a gestão administrativa para proprietário/admin. Não houve alteração da regra funcional da interface; trata-se de hardening de integridade.

## Ordem executada

### 1. Grupos × membros / local padrão

**Situação: validado.**

- `is_group_admin(group_id)` considera o criador do grupo como administrador, além dos membros com `role = 'admin'`.
- O modelo de `group_members` mantém o criador como membro e a autorização administrativa é derivada da propriedade do grupo. Isso atende à regra funcional de que o dono é administrador automaticamente sem exigir que a coluna `role` seja `admin`.
- `group_locations` possui RLS de leitura para membros e escrita/exclusão para administradores/dono.
- Existe proteção no banco para manter no máximo um local padrão por grupo por meio do trigger `trg_group_locations_single_default`.
- Existe também a RPC `set_group_default_location(uuid, uuid)`, com `EXECUTE` restrito a `authenticated`.

### 2. Partidas × participantes / capacidade

**Situação: validado.**

Verificações atuais no banco:

- jogadores em times sem confirmação: 0;
- pagamentos sem confirmação: 0;
- duplicidades na lista de suplentes: 0.

O limite de participantes possui proteção no banco, inclusive para concorrência, e a lista de suplentes persistente permanece como fonte de verdade para a espera.

### 3. Organizador

**Situação: validado.**

Na base atual, as partidas com organizador respeitam a associação ao grupo.

### 4. Convidados

**Situação: validado quanto à integridade atual.**

Não há convidados atualmente na produção. O fluxo atual utiliza perfil temporário e confirmação para convidados não cadastrados; não foram encontrados registros órfãos na base atual.

### 5. Locais + custo

**Situação: validado.**

Os locais cadastrados são vinculados ao grupo. O custo do local serve como valor sugerido/default, enquanto a partida pode possuir seu próprio custo.

### 6. Ranking

**Situação: comportamento existente, sem alteração.**

A pontuação permanece vitória = 3, empate = 1, derrota = 0. O ranking é calculado sobre partidas concluídas e filtrado por grupo no chamador.

### 7. Pagamentos / Pix / goleiro

**Situação: validado.**

A interface calcula o rateio sobre os participantes financeiros ativos. Quando `goalkeeper_pays = false`, jogadores identificados como goleiro são excluídos do rateio e exibidos como isentos.

A integridade de pagamentos está protegida por trigger para exigir confirmação do participante.

### 8. RLS / RPC / segurança

**Situação: validado com hardening contínuo.**

- RLS permanece habilitado nas tabelas públicas do domínio.
- Grants públicos foram restringidos aos comandos necessários.
- `anon` não possui `EXECUTE` nas RPCs protegidas auditadas.
- `is_group_admin` e demais helpers relevantes usam `SECURITY DEFINER` com `search_path = public`.
- A inclusão em `group_members` impede autoelevação para `admin`.
- `game_teams` exige confirmação do jogador para escrita direta.
- `goals` exige confirmação para escrita própria.

### 9. Referências legadas / código da interface

**Situação: pendências técnicas identificadas.**

O componente `app/society-page.js` ainda concentra quantidade significativa de lógica de acesso a dados. Permanecem como alvo de hardening os handlers que devem sempre validar o retorno do Supabase antes de atualizar a interface.

Também permanece a duplicidade histórica entre `migrations/` e `supabase/migrations/`. Não consolidar ou apagar essa estrutura sem definir formalmente a árvore oficial de novas migrations.

### 10. Scripts/migrations auxiliares

O repositório contém diversos scripts históricos usados em correções/refatorações. Eles não devem ser executados novamente automaticamente durante a auditoria. A próxima etapa deve classificar cada script como:

1. necessário em produção;
2. ferramenta de desenvolvimento reutilizável;
3. histórico já aplicado;
4. órfão/removível.

## Pendências que exigem decisão de negócio

### Redução de `max_players`

Não existe regra definida para o caso em que o administrador reduz o limite abaixo da quantidade de confirmados. Não alterar automaticamente para suplentes sem decisão explícita.

### Remoção de participante que já está em time

Não existe regra definida determinando se a remoção da confirmação deve também remover o jogador de `game_teams`. Não automatizar sem decisão explícita.

### Criação de partida por membro comum

A política atual permite. **Não foi identificada na documentação uma regra que diga que somente administradores podem criar partidas.** Manter até decisão explícita.

### RSVP com status adicional

Não foi identificado requisito aprovado para estados como “Talvez”, “Ausente” ou “Machucado”.

### Mensagens/lembretes automáticos

Não foi identificada regra aprovada sobre antecedência, destinatários ou frequência.

## Produção e testes

O último ciclo de Production Smoke Tests e Authenticated Production E2E disponível no GitHub terminou com `success` no commit `cfe4d10b736d7970d39ab7955a748a14ae469e2e`.

A produção permanece acessível em HTTP 200. As tentativas posteriores de build pela integração Vercel encontraram limite de build (`build-rate-limit`), portanto não devem ser tratadas como deploy bem-sucedido.

## Próxima ordem

1. Hardening dos handlers silenciosos da interface.
2. Classificação/limpeza dos scripts históricos.
3. Revisão da duplicidade das árvores de migrations, sem exclusão até definir a fonte oficial.
4. Ampliar E2E para validar explicitamente permissões de membro comum.
5. Reavaliar o ponto de negócio sobre criação de partidas por membro.
6. Somente depois, novas melhorias funcionais de baixo risco.
