-- ============================================================================
-- Scheduled auto-backup timer — මේ file එක Supabase SQL Editor එකේ run කරන්න
-- විනාඩි 15කට වරක් site එකේ /api/scheduled-backup එක check කරයි.
-- ඇත්ත දවස (දවස් 3න්/7න්…) සහ වෙලාව තෝරන්නේ Admin → Backup & Restore එකෙන්.
-- ⚠ <CRON_SECRET> වෙනුවට Admin → Backup & Restore → Scheduled card එකේ
--    ඇති Cron secret එක දාන්න. (Admin එකේ "Copy SQL" එකෙන් ලෑස්ති එකම ගන්නත් පුළුවන්.)
-- ============================================================================

-- 1) private backups bucket එක (Supabase destination එකට)
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

-- 2) අවශ්‍ය extensions (Dashboard → Database → Extensions එකෙනුත් පුළුවන්)
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- 3) පරණ weekly job එක (තියේ නම්) සහ මේ job එක පිරිසිදු කර නැවත දායි
select cron.unschedule('weekly-site-backup')
where exists (select 1 from cron.job where jobname = 'weekly-site-backup');
select cron.unschedule('mpcs-auto-backup-check')
where exists (select 1 from cron.job where jobname = 'mpcs-auto-backup-check');

select cron.schedule(
  'mpcs-auto-backup-check',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://website-blond-eta-94.vercel.app/api/scheduled-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-backup-secret', '<CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- පරීක්ෂාවට: select jobname, schedule, active from cron.job;
