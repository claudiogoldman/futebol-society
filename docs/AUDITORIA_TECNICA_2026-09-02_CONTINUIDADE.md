# Continuidade da Auditoria Técnica — 02/09/2026

## Objetivo

Registrar a situação após a continuidade da auditoria funcional, de integridade e segurança do domínio Futebol Society, sem introduzir regras de negócio não definidas.

## Ordem executada

### 1. Grupos × membros / local padrão

**Situação: validado.**

- `is_group_admin(group_id)` considera o criador do grupo como administrador, além dos membros com `role = 'admin'`.
- O modelo de `group_members` mantém o criador como membro e a autorização administrativa é derivada da propriedade do grupo. Isso atende à regra funcional de que o dono é administrador automaticamente sem exigir que a coluna `role` seja `admin`.
- `group_locations` possui RLS de leitura para membros e escrita/exclusão para administradores/dono.
- Existe proteção no banco para manter no máximo um local padrão por grupo por meio do trigger `trg_group_locations_single_default`.
- O trigger limpa o local anteriormente padrão antes de aceitar o novo padrão; foi validada a troca de padrão em transação de teste com rollback.
- Existe também a RPC `set_group_default_location(uuid, uuid)`, com `EXECUTE` restrito a `authenticated`.

**Observação:** a interface atual ainda usa diretamente `UPDATE group_locations.is_default` em vez da RPC. Isso não constitui defeito funcional no estado atual porque o trigger do banco já garante a troca segura do padrão. A RPC permanece disponível como caminho atômico recomendado para evolução futura da interface.

### 2. Partidas × participantes / capacidade

**Situação: validado.**

Verificações atuais no banco:

- confirmados sem perfil: 0;
- jogadores em times sem confirmação: 0;
- pagamentos sem confirmação: 0;
- suplente simultaneamente confirmado na mesma partida: 0;
- duplicidades na lista de suplentes: 0.

O limite de participantes possui proteção no banco, inclusive para concorrência, e a lista de suplentes persistente permanece como fonte de verdade para a espera.

### 3. Organizador

**Situação: validado.**

Na base atual, todas as partidas com organizador possuem o organizador como membro do respectivo grupo. A restrição correspondente também está implementada no banco.

### 4. Convidados

**Situação: validado quanto à integridade atual.**

Não há convidados atualmente na produção. O fluxo atual utiliza perfil temporário e confirmação para convidados não cadastrados; não foram encontrados registros órfãos na base atual.

### 5. Locais + custo

**Situação: validado.**

Os grupos atuais possuem um único local padrão e os locais cadastrados possuem custo. A regra de custo da partida continua independente do custo do local: o custo do local serve como valor sugerido/default, enquanto a partida pode possuir seu próprio custo.

### 6. Ranking

**Situação: comportamento existente, sem alteração.**

A pontuação permanece vitória = 3, empate = 1, derrota = 0. O ranking é calculado sobre partidas concluídas e filtrado por grupo no chamador. Não foi identificada regra adicional que justifique alteração dos critérios de desempate.

### 7. Pagamentos / Pix / goleiro

**Situação: validado.**

A interface calcula o rateio sobre os participantes financeiros ativos. Quando `goalkeeper_pays = false`, jogadores identificados como goleiro são excluídos do rateio e exibidos como isentos.

A partida atual de produção está configurada com custo de R$ 170 e `goalkeeper_pays = false`; há atualmente um participante confirmado que não é goleiro, resultando em rateio de R$ 170,00.

A integridade de pagamentos também está protegida por trigger para exigir confirmação do participante.

### 8. RLS / RPC / segurança

**Situação: validado.**

- RLS permanece habilitado nas tabelas públicas do domínio.
- Grants públicos foram restringidos aos comandos necessários.
- `anon` não possui `EXECUTE` nas RPCs protegidas auditadas.
- `is_group_admin` e demais helpers relevantes usam `SECURITY DEFINER` com `search_path = public`.
- A política de inclusão em `group_members` impede que um usuário se insira como `admin` por conta própria; autoentrada é limitada a `member`, enquanto administradores podem atribuir papéis permitidos.

### 9. Referências legadas / código da interface

**Situação: pendências técnicas identificadas.**

O componente `app/society-page.js` ainda concentra uma quantidade significativa de lógica de acesso a dados. Foram identificados handlers com tratamento de erro incompleto ou ausente, principalmente:

- atualização dos dados Pix da partida;
- atualização da localização da partida;
- sorteio/salvamento de times;
- marcação de pagamentos;
- salvamento de resultado e estatísticas associadas;
- salvamento de avaliações;
- exclusão de partida/grupo;
- atualização de perfil e de administrador global.

Esses pontos devem ser tratados como **hardening técnico**, não como mudança de regra de negócio: toda operação deve verificar o erro retornado pelo Supabase antes de atualizar a interface.

Também permanece a duplicidade histórica entre `migrations/` e `supabase/migrations/`. Não consolidar ou apagar essa estrutura durante a auditoria sem definir formalmente a árvore oficial de novas migrations.

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

### RSVP com status adicional

Não foi identificado requisito aprovado para estados como “Talvez”, “Ausente” ou “Machucado”. Não implementar como regra de presença sem decisão.

### Mensagens/lembretes automáticos

Não foi identificada regra aprovada sobre antecedência, destinatários ou frequência. Não implementar automação sem definição.

## Produção

A produção do projeto permanece em estado `READY` no Vercel e não há erros de runtime agrupados nos últimos 7 dias no projeto.

## Próxima ordem recomendada

1. Hardening dos handlers silenciosos da interface.
2. Classificação/limpeza dos scripts históricos.
3. Revisão da duplicidade das árvores de migrations, sem exclusão até definir a fonte oficial.
4. Testes E2E autenticados dos fluxos críticos.
5. Somente depois, avaliar melhorias funcionais de baixo risco, como remanejamento manual de times.
