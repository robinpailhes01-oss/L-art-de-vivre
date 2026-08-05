-- Relances automatiques : pg_cron appelle la Edge Function agent-followups
-- toutes les heures. L'auth se fait par le header x-cron-secret, lu depuis
-- le paramètre de base app.cron_secret.
--
-- ⚠️ Étapes manuelles après création du projet Supabase (voir README) :
--   1. Remplacer PROJECT_REF ci-dessous par la référence réelle du projet.
--   2. Exécuter :  alter database postgres set app.cron_secret = '<CRON_SECRET>';

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent : retire l'ancien job si déjà créé.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'agent-followups-hourly') then
    perform cron.unschedule('agent-followups-hourly');
  end if;
end $$;

select cron.schedule(
  'agent-followups-hourly',
  '0 * * * *',
  $cron$
    select net.http_post(
      url := 'https://PROJECT_REF.supabase.co/functions/v1/agent-followups',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', coalesce(current_setting('app.cron_secret', true), '')
      ),
      body := '{}'::jsonb
    );
  $cron$
);

-- Purge quotidienne du buffer de debounce (7 jours de rétention).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'wa-inbox-cleanup-daily') then
    perform cron.unschedule('wa-inbox-cleanup-daily');
  end if;
end $$;

select cron.schedule(
  'wa-inbox-cleanup-daily',
  '15 3 * * *',
  $$ select public.wa_inbox_cleanup(); $$
);
