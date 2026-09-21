alter table public.groups
  add column if not exists participation_penalty_payment_enabled boolean not null default true,
  add column if not exists participation_penalty_payment_mode text not null default 'caixa',
  add column if not exists participation_penalty_unpaid_games integer not null default 2;

alter table public.groups drop constraint if exists groups_participation_penalty_payment_mode_check;
alter table public.groups add constraint groups_participation_penalty_payment_mode_check check (participation_penalty_payment_mode in ('rateio','caixa'));
alter table public.groups drop constraint if exists groups_participation_penalty_unpaid_games_check;
alter table public.groups add constraint groups_participation_penalty_unpaid_games_check check (participation_penalty_unpaid_games between 0 and 10);

alter table public.game_participation_penalties
  add column if not exists charge_amount numeric(12,2) not null default 0,
  add column if not exists payment_mode text not null default 'caixa',
  add column if not exists paid_at timestamptz,
  add column if not exists included_in_rateio boolean not null default false;

create table if not exists public.group_cash_transactions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  amount numeric(12,2) not null,
  direction text not null default 'credit',
  category text not null default 'penalty',
  description text not null,
  user_id uuid references auth.users(id),
  game_id uuid references public.games(id) on delete set null,
  penalty_id uuid references public.game_participation_penalties(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.group_cash_transactions enable row level security;
revoke all on public.group_cash_transactions from anon;
grant select on public.group_cash_transactions to authenticated;
create index if not exists idx_group_cash_transactions_group_created on public.group_cash_transactions(group_id, created_at desc);
create unique index if not exists uq_group_cash_penalty_credit on public.group_cash_transactions(penalty_id) where penalty_id is not null and direction='credit';

create or replace function public.has_active_game_participation_penalty(p_game_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
select exists (
 select 1 from public.game_participation_penalties p
 join public.games canceled on canceled.id=p.canceled_game_id
 join public.groups cg on cg.id=canceled.group_id
 where p.user_id=p_user_id and p.released_at is null and p.paid_at is null
 and canceled.group_id is not null
 and canceled.group_id=(select g.group_id from public.games g where g.id=p_game_id)
 and p_game_id<>canceled.id
 and cg.participation_penalty_enabled=true
 and cg.participation_penalty_payment_enabled=true
 and cg.participation_penalty_unpaid_games>0
 and public.game_start_at(canceled)<public.game_start_at((select g from public.games g where g.id=p_game_id))
 and (select count(*) from public.games between_games where between_games.group_id=canceled.group_id and public.game_start_at(between_games)>public.game_start_at(canceled) and public.game_start_at(between_games)<public.game_start_at((select g from public.games g where g.id=p_game_id))) < cg.participation_penalty_unpaid_games
);
$function$;

create or replace function public.set_penalty_payment_status(p_penalty_id uuid,p_paid boolean)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_penalty public.game_participation_penalties%rowtype; v_allowed boolean;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into v_penalty from public.game_participation_penalties where id=p_penalty_id for update;
 if not found then raise exception 'PENALTY_NOT_FOUND'; end if;
 v_allowed:=auth.uid()=v_penalty.user_id or public.is_group_admin(v_penalty.group_id) or exists(select 1 from public.groups g where g.id=v_penalty.group_id and g.created_by=auth.uid());
 if not v_allowed then raise exception 'FORBIDDEN_PENALTY_PAYMENT'; end if;
 if p_paid then
   update public.game_participation_penalties set paid_at=coalesce(paid_at,now()),released_at=now(),released_by=auth.uid() where id=p_penalty_id;
   if v_penalty.payment_mode='caixa' then
     insert into public.group_cash_transactions(group_id,amount,direction,category,description,user_id,game_id,penalty_id,created_by)
     values(v_penalty.group_id,v_penalty.charge_amount,'credit','penalty','Pagamento de cancelamento tardio',v_penalty.user_id,v_penalty.canceled_game_id,v_penalty.id,auth.uid())
     on conflict (penalty_id) where penalty_id is not null and direction='credit' do nothing;
   end if;
 else
   update public.game_participation_penalties set paid_at=null,released_at=null,released_by=null where id=p_penalty_id;
   delete from public.group_cash_transactions where penalty_id=p_penalty_id and direction='credit';
 end if;
 return p_paid;
end;
$function$;

revoke execute on function public.set_penalty_payment_status(uuid,boolean) from public,anon;
grant execute on function public.set_penalty_payment_status(uuid,boolean) to authenticated;