# Auditoria — permissões do criador da partida

## Resultado

Foi confirmada uma distinção importante na autorização:

- **Administrador do grupo:** administra o grupo e as partidas sob as permissões administrativas.
- **Criador da partida:** mesmo sendo membro comum do grupo, possui gestão da própria partida enquanto ela estiver aberta.

## Membro comum que criou a própria partida

Na implementação atual, o criador pode gerir a própria partida aberta, incluindo o fluxo de gestão de participantes e local. Isso inclui adicionar jogador cadastrado do grupo, adicionar convidado, remover participante e alterar o local da própria partida, além das demais ações de gestão expostas ao criador.

O criador **não** recebe por isso poderes administrativos sobre o grupo nem sobre partidas criadas por terceiros.

## Fechamento da partida

Após a partida ser considerada concluída, as alterações estruturais ficam restritas ao administrador do grupo conforme as políticas de pós-jogo. O criador mantém apenas as permissões explicitamente previstas para registro/correção do resultado.

## Decisão da auditoria

Esse comportamento foi considerado **adequado ao modelo atual** e não será restringido sem uma decisão de negócio diferente.

Não foi identificada documentação que determine que somente administradores possam criar ou gerir a própria partida.
