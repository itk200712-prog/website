-- ============================================================================
-- Scheduled auto-backup setup — මේ file එක Supabase SQL Editor එකේ run කරන්න
-- කලින්: supabase functions deploy scheduled-backup
--        supabase secrets set BACKUP_CRON_SECRET=<රහස් වචනයක්>
-- ⚠ පහත placeholders තුන පුරවන්න: <PROJECT_REF>, <ANON_KEY>, <CRON_SECRET>
-- ============================================================================

-- 1) private backups bucket එක
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

-- 2) අවශ්‍ය extensions (Dashboard → Database → Extensions එකෙනුත් පුළුවන්)
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- 3) සතියකට වරක් — ඉරිදා 20:30 UTC (= සඳුදා පාන්දර 2:00 ශ්‍රී ලංකා වේලාවෙන්)
select cron.unschedule('weekly-site-backup')
where exists (select 1 from cron.job where jobname = 'weekly-site-backup');

select cron.schedule(
  'weekly-site-backup',
  '30 20 * * 0',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/scheduled-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>',
      'apikey', '<ANON_KEY>',
      'x-backup-secret', '<CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- පරීක්ෂාවට: select * from cron.job;
-- අතින් වරක් දුවවන්න: ඉහත net.http_post(...) කොටස් එක එලෙසම run කරන්න.
