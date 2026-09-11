# Inventário funcional — Futebol Society

## Fonte de verdade
- Branch oficial: `main`
- Produção deve acompanhar `main` após cada fechamento validado.
- Branches antigas não devem ser usadas como fonte de código sem auditoria comparativa.

## Legenda
- 🟢 Implementado / integrado e comprovado
- 🟡 Implementado, mas requer QA ponta a ponta ou evidência operacional
- 🟠 Parcial ou dívida técnica
- 🔴 Gap funcional / não comprovado
- ⚫ Histórico / não usar

## 🟢 Núcleo funcional implementado
- Autenticação e sessão
- Grupos, membros, administração e avatar
- Locais de grupo e local padrão
- Defaults de grupo
- Criação e edição de partidas
- Organizador, custo, pagamento do goleiro e PIX
- Formato configurável: jogadores por equipe + reservas por equipe
- Capacidade derivada do formato: `(players_per_team + reserves_per_team) * 2`
- Herança grupo → partida e override da partida
- Participação, confirmação e remoção
- Convites/token e convidados
- Lista de espera FIFO, posição, saída e promoção automática
- Sorteio de equipes
- Balanceamento por atributos/OVR, rating, posição, goleiro e fatores físicos
- Consideração de idade e peso no balanceamento
- Titulares e reservas
- Campo tático espelhado, com fotos/nickname e separação entre as metades
- Perfil: nickname, foto, nacionalidade, posições, pé preferencial e atributos
- Chat por partida, realtime, edição, exclusão, reações e menções
- Pagamentos e rateio
- Gols, assistências e resultado
- Avaliação pós-partida de 1 a 5 estrelas entre participantes
- Destaques pós-partida: MVP, artilheiro, passador e muro
- Ranking com jogos, vitórias, empates, derrotas, gols, assistências, nota, MVPs, muros e presença
- Central de notificações, sino, realtime e leitura
- Política de privacidade e fluxo de exclusão de conta

## 🟢 Segurança/RLS já endurecida
- `ratings`: somente participante autenticado pode avaliar outro participante da partida concluída.
- Autoavaliação bloqueada no banco (`rater_id <> rated_id`).
- Nota limitada a 1–5 por constraint.
- `game_confirmations`, `game_teams`, `games`, `goals` e `ratings` possuem políticas específicas por operação.
- Acesso `anon` às tabelas críticas auditadas não possui grants de escrita.
- Criador da partida pode registrar resultado final; administradores do grupo mantêm a autoridade existente.
- Resultado final exige placar não nulo e não negativo quando gravado pelo criador.

## 🟡 QA / homologação necessária
- Ranking após uma partida real com resultado e avaliações persistidas.
- Destaques pós-partida após dados reais.
- Fluxo completo: resultado → gols/assistências → avaliações → MVP → ranking/destaques.
- Gravação e alteração real de avaliações em produção.
- Exclusão de conta em ambiente de produção.
- Chat ponta a ponta com múltiplos usuários.
- Alteração de capacidade com participantes existentes.
- Promoção real da waitlist em ambiente controlado, incluindo persistência da notificação.
- Testes automatizados de autorização/RLS com usuários autenticados distintos.
- E2E autenticado em produção com estado de autenticação válido.
- E2E da persistência de perfil, incluindo pé preferencial.
- Validação visual do campo tático para 5x5, 6x6 e 7x7 com reservas.

### E2E autenticado — situação atual
- O workflow autenticado está funcional e executa os testes.
- Última execução: 5 testes; 2 smoke tests passaram.
- Os 3 testes autenticados falharam porque o `PLAYWRIGHT_AUTH_STATE_B64` armazenado não foi aceito pela produção e a aplicação retornou à tela de login.
- Isso não constitui evidência de falha funcional da aplicação.
- Próximo passo: renovar o estado de autenticação e repetir a suíte.

## 🟠 Pendências técnicas
1. Geocodificação automática de locais.
2. Realtime de reações do chat ainda deve ser filtrado também no serviço por `game_id`, além da proteção atual no componente.
3. `setGameMaxPlayers()` permanece como compatibilidade; a fonte de verdade deve ser `players_per_team + reserves_per_team`.
4. Há helpers de jogador/posição/OVR duplicados na página principal e no domínio.
5. Há atribuição duplicada do recebedor PIX no fluxo de criação de partida.
6. Histórico de migrations/triggers de notificações em produção precisa permanecer reconciliado com o repositório.
7. Criar testes pgTAP/RLS versionados para os principais recursos, seguindo a matriz de autorização.
8. Limpar branches históricas e PRs obsoletos após fechamento do inventário.

## 🟡 Notificações de negócio — estado auditado
A infraestrutura de notificações existe e há geração DB-side para parte dos eventos.

### Evidência atual
- 🟢 confirmação de jogador: `game_player_confirmed`
- 🟢 cancelamento de presença: `game_player_unconfirmed`
- 🟢 entrada em grupo: `group_member_joined`
- 🟢 `@mention`: trigger/função DB existentes
- 🟡 promoção da waitlist: função/triggers implementados; teste transacional foi executado com rollback, portanto não há evidência de uma notificação persistida em produção

### Ainda sem comprovação E2E
- 🟡 entrada na waitlist
- 🟡 alteração de partida/local/horário
- 🟡 sorteio realizado
- 🟡 resultado publicado
- 🟡 avaliação recebida
- 🟡 pagamento
- 🟡 entrega realtime das notificações no cliente

Não criar novos geradores sem primeiro auditar os triggers/RPCs existentes para evitar duplicidade.

## 🟢 Correções recentes
### Pé preferencial
- Produção corrigida para persistir `direito`, `esquerdo` e `ambidestro`, alinhados à UI.
- Constraint e persistência foram testadas.
- Salvamento em produção foi confirmado pelo usuário.

### Campo tático
- Slots do Time A ficam na metade superior.
- Slots do Time B são espelhados na metade inferior.
- Zona central foi afastada para evitar invasão/sobreposição visual entre equipes.
- Reservas são exibidas fora do campo.
- Último deploy da correção foi publicado em produção com estado `READY`.

### Resultado pós-partida
- Foi identificada e corrigida uma restrição RLS que permitia ao administrador do grupo registrar resultado, mas podia impedir o criador comum da partida de gravar o placar.
- A política agora permite ao criador registrar placar válido e mantém a autoridade do administrador do grupo.
- Migration fonte: `20260910223000_allow_game_creator_to_record_result.sql`.

## Ordem de fechamento
1. Renovar estado de autenticação e executar E2E autenticado completo.
2. Homologar fluxo pós-partida com dados reais/controlados.
3. Executar matriz de segurança/RLS e versionar testes.
4. Fechar notificações ainda não comprovadas.
5. Corrigir dívidas pequenas de capacidade/PIX/chat/helpers.
6. Validar campo tático visualmente em todos os formatos.
7. Limpar branches e encerrar PRs históricos.
8. Emitir versão final do inventário com cada item classificado.
