# Controle de drift de migrations

As migrations de notificações da waitlist foram aplicadas diretamente no Supabase e espelhadas no repositório com os nomes/versões retornados pelo histórico de migrations da produção.

- `20260910223126_add_waitlist_promotion_notification.sql`
- `20260910223233_fix_waitlist_promotion_notification_confirmation_key.sql`

Os arquivos temporários criados durante a correção incremental devem ser removidos em seguida para evitar que o Supabase CLI tente tratá-los como novas migrations.
