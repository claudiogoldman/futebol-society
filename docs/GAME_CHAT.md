# Chat da partida — v1

## Escopo

O primeiro incremento do chat é um espaço de conversa persistente associado à partida.

### Acesso

- Usuário autenticado vinculado à partida pode ler mensagens.
- Usuário autenticado vinculado à partida pode enviar mensagens usando o próprio `user_id`.
- O autor pode editar ou excluir a própria mensagem enquanto mantiver o vínculo com a partida.
- RLS é a autoridade final de autorização.

### Mensagens

- Texto obrigatório.
- Limite de 2.000 caracteres.
- Ordenação cronológica por `created_at`.
- Alterações registram `updated_at`.

### Tempo real

O cliente utiliza Supabase Realtime para INSERT, UPDATE e DELETE.

## Fora do escopo desta versão

- Chat privado por equipe.
- Imagens/GIFs/arquivos.
- Reações.
- Menções.
- Notificações push.
- Moderação administrativa.

Esses itens só devem ser adicionados após validação da experiência do chat geral.
