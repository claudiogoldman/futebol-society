-- Optional scheduler dependency: pg_cron must be available in the Supabase project.
-- Every RPC also performs lazy closure checks, so access is blocked at the exact
-- event start even if this persistence job runs between minute boundaries.

create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'social-events-auto-close';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
  perform cron.schedule(
    'social-events-auto-close',
    '* * * * *',
    $job$
      update public.social_events
         set status = 'CLOSED',
             closure_type = 'AUTOMATIC',
             closed_at = coalesce(closed_at, now()),
             closed_by = null,
             updated_at = now()
       where status = 'OPEN'
         and ((event_date + event_time) at time zone 'America/Sao_Paulo') <= now();
    $job$
  );
end;
$$;
