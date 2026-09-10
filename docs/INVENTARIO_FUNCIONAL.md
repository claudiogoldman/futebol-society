# Inventário funcional — Futebol Society

## Fonte de verdade
- Branch oficial: `main`
- Commit de referência do inventário: `5487ed9b3b1a8c0e943321bb4bcaa0ad50636bcb`
- Branches antigas não devem ser usadas como fonte de código sem auditoria comparativa.

## Legenda
- 🟢 Implementado / integrado
- 🟡 Implementado, mas requer QA ponta a ponta
- 🟠 Parcial ou dívida técnica
- 🔴 Gap funcional / não comprovado
- ⚫ Histórico / não usar

## 🟢 Núcleo implementado
- Autenticação e sessão
- Grupos, membros, administração e avatar
- Locais de grupo e local padrão
- Defaults de grupo
- Criação e edição de partidas
- Organizador, custo, pagamento do goleiro e PIX
- Formato configurável: jogadores por equipe + reservas por equipe
- Capacidade derivada do formato
- Herança grupo → partida e override da partida
- Participação, confirmação e remoção
- Convites/token e convidados
- Lista de espera FIFO, posição, saída e promoção automática
- Sorteio de equipes
- Balanceamento por atributos/rating, físico, posições e goleiros
- Titulares e reservas
- Campo tático espelhado com fotos/nickname
- Perfil: nickname, foto, nacionalidade, posições, pé e atributos
- Chat por partida, realtime, edição, exclusão, reações e menções
- Pagamentos e rateio
- Gols, assistências e resultado
- Avaliações e ranking (fluxos ainda precisam de QA integrado)
- Central de notificações, sino, realtime e leitura
- Política de privacidade e fluxo de exclusão de conta

## 🟡 QA necessário
- Ranking e atualização de rating
- Destaques pós-partida
- Fluxo completo de pós-partida
- Exclusão de conta em ambiente de produção
- Chat ponta a ponta com múltiplos usuários
- Alteração de capacidade com participantes existentes
- Promoção real da waitlist
- Testes de autorização/RLS
- E2E autenticado com estado de autenticação válido

## 🟠 Pendências técnicas
1. Geocodificação automática de locais.
2. Realtime de reações do chat deve ser revisado para isolamento completo por partida.
3. `setGameMaxPlayers()` deve deixar de ser uma configuração independente; a fonte de verdade é `players_per_team + reserves_per_team`.
4. Há helpers de jogador/posição/OVR duplicados na página principal e no domínio.
5. Há atribuição duplicada do recebedor PIX no fluxo de criação de partida.

## 🔴 Gap principal
### Geração de notificações de negócio
A infraestrutura de notificações existe, mas não foi comprovada a geração dos registros a partir dos eventos de negócio.

Eventos a fechar:
- entrada na partida
- entrada na waitlist
- promoção da waitlist
- alteração de partida/local/horário
- sorteio realizado
- resultado publicado
- avaliação recebida
- pagamento
- `@mention`

Antes de implementar geradores, auditar migrations/RPCs/triggers do Supabase para evitar duplicidade.

## Branches
`main` é a fonte de verdade. Branches históricas de chat, tactical pitch, location, hydration, UI finalization e group-admin não devem ser reincorporadas sem auditoria.

## Ordem de fechamento
1. Auditar geração de notificações no banco.
2. Corrigir dívidas pequenas de capacidade/PIX/chat/helpers.
3. Executar QA E2E completo.
4. Executar testes de segurança/RLS.
5. Validar produção.
6. Limpar branches e encerrar PRs históricos.
