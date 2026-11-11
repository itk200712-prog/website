-- MPCS backup timer installer / repair (ONE SQL update; run as database owner).
-- No passwords or cron secrets need to be pasted into this SQL.
-- After installing, Save Schedule in Admin installs/repairs the job automatically.
begin;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
insert into storage.buckets (id, name, public) values ('backups','backups',false)
on conflict (id) do nothing;

-- Only an authenticated superadmin or the server service role can repair/read jobs.
create or replace function public.mpcs_backup_timer_authorized()
returns boolean language sql stable security definer set search_path = '' as $auth$
 select coalesce(auth.role() = 'service_role', false) or exists
 (select 1 from public.profiles where id = auth.uid() and role = 'superadmin');
$auth$;
revoke all on function public.mpcs_backup_timer_authorized() from public, anon;
grant execute on function public.mpcs_backup_timer_authorized() to authenticated, service_role;

-- Executed by pg_cron as the installer/owner. Read the CURRENT secret each tick:
-- rotating the private secret no longer breaks the timer's hard-coded header.
create or replace function public.mpcs_backup_timer_dispatch()
returns bigint language plpgsql security definer set search_path = '' as $dispatch$
declare secret text; request_id bigint;
begin
 select btrim(value) into secret from public.backup_secrets where key = 'backup_cron_secret';
 if coalesce(secret, '') = '' then raise exception 'backup_cron_secret missing'; end if;
 select net.http_post(
  url := 'https://website-blond-eta-94.vercel.app/api/scheduled-backup',
  headers := jsonb_build_object('Content-Type','application/json','x-backup-secret',secret),
  body := '{}'::jsonb, timeout_milliseconds := 300000
 ) into request_id;
 insert into public.backup_secrets (key,value) values ('backup_timer:last_request',
  jsonb_build_object('requestId',request_id,'at',clock_timestamp())::text)
 on conflict (key) do update set value = excluded.value;
 return request_id;
end;
$dispatch$;
revoke all on function public.mpcs_backup_timer_dispatch() from public, anon, authenticated, service_role;

create or replace function public.mpcs_backup_timer_status()
returns jsonb language plpgsql security definer set search_path = '' as $status$
declare job jsonb; request_info jsonb; response_info jsonb;
begin
 if not public.mpcs_backup_timer_authorized() then raise exception 'superadmin_required' using errcode = '42501'; end if;
 select jsonb_build_object('active',active,'schedule',schedule,
  'dynamicSecret',command = 'select public.mpcs_backup_timer_dispatch();') into job
 from cron.job where jobname = 'mpcs-auto-backup-check' limit 1;
 select value::jsonb into request_info from public.backup_secrets where key = 'backup_timer:last_request';
 if request_info is not null then
  select jsonb_build_object('statusCode',status_code,'timedOut',timed_out,
   'transportError',error_msg is not null,'at',created) into response_info
  from net._http_response where id = (request_info->>'requestId')::bigint;
 end if;
 return jsonb_build_object('installed', job is not null,'job',job,
  'lastRequest',request_info,'lastResponse',response_info);
end;
$status$;
revoke all on function public.mpcs_backup_timer_status() from public, anon;
grant execute on function public.mpcs_backup_timer_status() to authenticated, service_role;

create or replace function public.mpcs_backup_timer_repair()
returns jsonb language plpgsql security definer set search_path = '' as $repair$
declare j record;
begin
 if not public.mpcs_backup_timer_authorized() then raise exception 'superadmin_required' using errcode = '42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(72018341);
 if not exists (select 1 from public.backup_secrets where key = 'backup_cron_secret' and length(btrim(value)) >= 32)
 then raise exception 'Save a valid Cron secret in Admin first'; end if;
 for j in select jobid from cron.job where jobname in ('weekly-site-backup','mpcs-auto-backup-check')
 loop perform cron.unschedule(j.jobid); end loop;
 perform cron.schedule('mpcs-auto-backup-check','*/15 * * * *','select public.mpcs_backup_timer_dispatch();');
 -- Installing the timer does NOT force a backup. First due time remains the next hour after Save.
 return public.mpcs_backup_timer_status();
end;
$repair$;
revoke all on function public.mpcs_backup_timer_repair() from public, anon;
grant execute on function public.mpcs_backup_timer_repair() to authenticated, service_role;
-- Install/repair automatically only if the secret is already configured.
-- Owner bootstrap temporarily assumes service_role JWT claim; no claims persist outside this transaction.
do $bootstrap$
declare prior_claims text := current_setting('request.jwt.claims',true);
begin
 if exists (select 1 from public.backup_secrets where key = 'backup_cron_secret' and length(btrim(value)) >= 32) then
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  perform public.mpcs_backup_timer_repair();
  perform set_config('request.jwt.claims',coalesce(prior_claims,'{}'),true);
 end if;
end;
$bootstrap$;
commit;
-- Inspect in Admin Live status (no secret or recipient addresses returned).
