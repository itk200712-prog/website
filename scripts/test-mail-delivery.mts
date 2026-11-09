import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';

// Isolated service mocks only: no live database writes, external HTTP calls or real mail.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://smtp-test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon';
const { sendViaSmtp, sendMail, cleanupRetiredMailSettings } = await import('../src/lib/mail-server');
const { MAIL_SLOTS, smtpConfigurationIssue } = await import('../src/lib/mail-config');
const { routeEmailsServer } = await import('../src/lib/mail-routes-server');
const { formatFileSize, sendBackupReport } = await import('../src/lib/backup-report');
const { NextRequest } = await import('next/server');
const { GET, POST } = await import('../src/app/api/mail/settings/route');
const { enqueueBackupReport, flushBackupReportQueue, BACKUP_MAIL_PREFIX } = await import('../src/lib/backup-mail-queue');
const { POST: scheduledPost } = await import('../src/app/api/scheduled-backup/route');
const { POST: sendPost } = await import('../src/app/api/mail/send/route');
const originalFetch = globalThis.fetch;
const originalTransport = nodemailer.createTransport;
const db = new Map<string, string>([
  ['silentforms_access_key', 'retired-placeholder'], ['silentforms_recipient:old@example.com', 'retired-placeholder'],
  ['mail_provider', 'retired-provider'], ['backup_cron_secret', 'keep-cron'], ['gemini_api_key', 'keep-ai'],
]);
const smtpTo: string[] = [];
const mailPayloads: { to: string; from: string; cc?: string; bcc?: string }[] = [];
const settings = new Map<string, string>();
const historyPatches: Record<string, unknown>[] = [];
const smtpErrors = new Set<string>();
const writes: Record<string, string>[][] = [];
let role = 'admin', closed = 0, calls = 0, maxConcurrent = 0, concurrent = 0;
let dbError = false, cleanupError = false;
let passed = 0;
const recipients = Array.from({ length: 7 }, (_, i) => `recipient${i + 1}@example.com`);
const pass = (name: string) => { passed++; console.log(`PASS ${name}`); };
const config = { host: 'smtp.gmail.com', port: 465, secure: true, user: 'sender@example.com', pass: 'dummy-password', fromName: 'MPCS', fromEmail: 'sender@example.com' };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
function request(body?: unknown, authorized = true) {
  return new NextRequest('https://smtp-test.invalid/api/mail/settings', {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(authorized ? { Authorization: 'Bearer test-session' } : {}), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
try {
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const u = new URL(String(url));
    assert.equal(u.hostname, 'smtp-test.invalid', 'No secondary/external HTTP mail service is permitted');
    if (u.pathname === '/auth/v1/user') return response({ id: '12345678-1234-1234-1234-123456789abc' });
    if (u.pathname === '/rest/v1/profiles') return response([{ role }]);
    if (u.pathname === '/rest/v1/backup_history') {
      if (init?.method === 'PATCH') historyPatches.push(JSON.parse(String(init.body)));
      return response([]);
    }
    if (u.pathname === '/rest/v1/system_settings') {
      const filter = u.searchParams.get('key') ?? '';
      if (init?.method === 'POST') {
        const payload = JSON.parse(String(init.body));
        for (const row of Array.isArray(payload) ? payload : [payload]) settings.set(row.key, row.value);
        return new Response(null, { status: 204 });
      }
      if (init?.method === 'PATCH') { settings.set(filter.slice(3), JSON.parse(String(init.body)).value); return new Response(null, { status: 204 }); }
      return response(Array.from(settings, ([key, value]) => ({ key, value })).filter(row => filter.startsWith('eq.') ? row.key === filter.slice(3) : filter.slice(4, -1).split(',').includes(row.key)));
    }
    assert.equal(u.pathname, '/rest/v1/backup_secrets');
    if (init?.method === 'DELETE') {
      if (u.searchParams.has('or')) {
        assert.equal(u.searchParams.get('or'), '(key.like.silentforms*,key.eq.mail_provider)');
        if (cleanupError) return response({ message: 'cleanup unavailable' }, 503);
        for (const key of db.keys()) if (key.startsWith('silentforms') || key === 'mail_provider') db.delete(key);
      } else { db.delete((u.searchParams.get('key') ?? '').slice(3)); }
      return new Response(null, { status: 204 });
    }
    if (init?.method === 'POST') {
      if (dbError) return response({ message: 'Mock schema write error', code: '42703' }, 400);
      const parsed = JSON.parse(String(init.body));
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      writes.push(rows);
      for (const row of rows) {
        assert.deepEqual(Object.keys(row).sort(), ['key', 'value']);
        const ignoreDuplicate = String((init.headers as Record<string, string>)?.Prefer).includes('ignore-duplicates');
        if (!ignoreDuplicate || !db.has(row.key)) db.set(row.key, row.value);
      }
      return new Response(null, { status: 204 });
    }
    if (init?.method === 'PATCH') {
      const key = (u.searchParams.get('key') ?? '').slice(3);
      const prefix = u.searchParams.get('value');
      if (!db.has(key) || (prefix && !db.get(key)!.startsWith(prefix.slice(5, -1)))) return response([]);
      db.set(key, JSON.parse(String(init.body)).value);
      return String((init.headers as Record<string, string>)?.Prefer).includes('representation') ? response([{ key, value: db.get(key) }]) : new Response(null, { status: 204 });
    }
    const filter = u.searchParams.get('key') ?? '';
    return response(Array.from(db, ([key, value]) => ({ key, value })).filter(row => filter.startsWith('like.') ? row.key.startsWith(filter.slice(5, -1)) : filter.startsWith('eq.') ? row.key === filter.slice(3) : filter.slice(4, -1).split(',').includes(row.key)));
  }) as typeof fetch;
  const installTransport = () => {
    nodemailer.createTransport = ((options: Record<string, unknown>) => {
      assert.equal(options.requireTLS, !options.secure);
      return { close: () => { closed++; }, sendMail: async (payload: { to: string; from: string; cc?: string; bcc?: string }) => {
        const { to } = payload; mailPayloads.push(payload);
        calls++; concurrent++; maxConcurrent = Math.max(maxConcurrent, concurrent);
        await Promise.resolve();
        concurrent--; smtpTo.push(to);
        if (smtpErrors.has(to)) throw new Error('SMTP authentication / recipient failure');
        return { accepted: [to] };
      } };
    }) as typeof originalTransport;
  };
  installTransport();

  assert.equal((await GET(request(undefined, false))).status, 403);
  assert.equal((await POST(request({ host: 'smtp.gmail.com' }, false))).status, 403);
  assert.equal(writes.length, 0);
  role = 'member'; assert.equal((await GET(request())).status, 403);
  assert.equal((await POST(request({ host: 'smtp.gmail.com' }))).status, 403);
  role = 'admin'; pass('Unauthenticated and non-admin settings access denied');

  const missing = await sendMail({ to: recipients, subject: 'Test', text: 'Test' });
  assert.equal(missing.ok, 0); assert.equal(missing.failed.length, 7);
  assert.equal(missing.method, 'none'); assert.equal(calls, 0);
  pass('No SMTP configuration → explicit failure for every recipient, no fallback');

  for (const payload of [{ provider: 'smtp' }, { recipientEmail: recipients[0], recipientAccessKey: 'obsolete' }, { accessKey: 'obsolete' }, {}, null, []]) {
    assert.equal((await POST(request(payload))).status, 400);
  }
  assert.equal(writes.length, 0); pass('Retired provider/key payloads and empty settings rejected');

  for (const payload of [{ port: 0 }, { port: 65536 }, { port: 1.5 }, { host: 'https://smtp.gmail.com' }, { fromEmail: 'invalid' }, { pass: {} }, { secure: 'yes' }]) {
    assert.equal((await POST(request(payload))).status, 400);
  }
  pass('Invalid SMTP fields rejected before DB writes');

  const saved = await POST(request({ ...config, pass: 'abcd efgh ijkl mnop' }));
  assert.equal(saved.status, 200); const savedBody = await saved.json();
  assert.equal(savedBody.provider, 'smtp'); assert.equal(savedBody.configured, true);
  assert.equal(db.get('smtp_pass'), 'abcdefghijklmnop'); assert.equal(db.get('smtp_secure'), 'true');
  assert.ok(!db.has('mail_provider')); assert.ok(!db.has('silentforms_access_key')); assert.ok(!db.has('silentforms_recipient:old@example.com'));
  assert.equal(db.get('backup_cron_secret'), 'keep-cron'); assert.equal(db.get('gemini_api_key'), 'keep-ai');
  pass('SMTP save uses key/value schema, normalizes Gmail App Password and removes only retired mail secrets');

  assert.equal((await POST(request({ pass: '', fromName: 'New name' }))).status, 200);
  assert.equal(db.get('smtp_pass'), 'abcdefghijklmnop');
  assert.equal((await POST(request({ host: 'smtp.gmail.com', pass: '    ' }))).status, 200);
  assert.equal(db.get('smtp_pass'), 'abcdefghijklmnop');
  pass('Blank or all-space Gmail password preserves the saved password');

  const state = await GET(request()); assert.equal(state.status, 200);
  const stateText = await state.text();
  assert.ok(!stateText.includes('abcdefghijklmnop')); assert.ok(!stateText.includes('keep-cron'));
  assert.equal(JSON.parse(stateText).hasPassword, true);
  assert.deepEqual(Object.keys(JSON.parse(stateText)).sort(), ['configured','configurationIssue','fromEmail','fromName','hasPassword','host','ok','port','provider','user'].sort());
  pass('Settings GET returns SMTP metadata only, never password or retired provider state');

  smtpTo.length = 0;
  const all = await sendMail({ to: [...recipients, ' RECIPIENT1@EXAMPLE.COM ', 'invalid'], subject: 'Test', text: 'Test' });
  assert.equal(all.ok, 7); assert.equal(all.failed.length, 0); assert.equal(all.method, 'smtp');
  assert.equal(all.results.length, 7); assert.equal(smtpTo.length, 7); assert.ok(maxConcurrent <= 3);
  assert.equal(closed, calls); pass('Seven recipients use one SMTP sender, normalize/dedupe, bound connections and close transports');

  smtpErrors.add(recipients[1]); smtpTo.length = 0;
  const partial = await sendMail({ to: recipients, subject: 'Test', text: 'Test' });
  assert.equal(partial.ok, 6); assert.equal(partial.failed.length, 1); assert.equal(partial.failed[0].to, recipients[1]);
  assert.equal(smtpTo.length, 7); assert.equal(closed, calls);
  pass('One rejected recipient does not drop others or trigger alternate-provider calls');

  const testFailed = await POST(request({ testTo: recipients[1] }));
  assert.equal(testFailed.status, 502); const failedBody = await testFailed.json(); assert.equal(failedBody.method, 'smtp');
  assert.match(failedBody.failed[0].error, /SMTP authentication/);
  smtpErrors.clear(); pass('SMTP Test returns actual failure, never false fallback success');

  const testSuccess = await POST(request({ testTo: recipients[0] }));
  assert.equal(testSuccess.status, 200); assert.equal((await testSuccess.json()).delivery, 'unconfirmed');
  assert.equal((await POST(request({ testTo: 'invalid' }))).status, 400);
  pass('SMTP Test validates recipient and never claims confirmed inbox delivery');

  assert.equal(MAIL_SLOTS, 10);
  for (const route of ['inquiry', 'backup']) for (let i = 0; i < MAIL_SLOTS; i++) settings.set(`mail_route_${route}_${i + 1}`, recipients[i] ?? '');
  assert.deepEqual(await routeEmailsServer('backup'), recipients);
  assert.deepEqual(await routeEmailsServer('inquiry'), recipients);
  pass('Shared ten-slot resolver includes recipient 7 for public routes and scheduled backup reports');
  smtpTo.length = 0; mailPayloads.length = 0;
  const publicSeven = await sendPost(request({ route: 'inquiry', to: ['attacker@example.com'], subject: 'Public inquiry', text: 'Test' }, false));
  assert.equal(publicSeven.status, 200); assert.equal((await publicSeven.json()).sent, 7);
  assert.deepEqual([...smtpTo].sort(), [...recipients].sort());
  assert.equal(mailPayloads.length, 7);
  for (const payload of mailPayloads) { assert.equal(typeof payload.to, 'string'); assert.ok(!payload.to.includes(',')); assert.equal(payload.cc, undefined); assert.equal(payload.bcc, undefined); assert.ok(payload.from.includes('sender@example.com')); }
  pass('Public form sends seven private, separate messages from saved routes; ignores injected recipient');

  const sendResult = await sendPost(request({ to: recipients, subject: 'Test', text: 'Test' }));
  assert.equal(sendResult.status, 200); assert.equal((await sendResult.json()).sent, 7);
  assert.equal((await sendPost(request({ to: recipients, subject: 'Test', text: 'Test' }, false))).status, 401);
  pass('Authenticated send endpoint handles seven recipients; anonymous arbitrary relay denied');

  assert.equal((await POST(request({ port: 587 }))).status, 200); assert.equal(db.get('smtp_secure'), 'false');
  assert.equal((await sendMail({ to: recipients[0], subject: 'Test', text: 'Test' })).ok, 1);
  pass('Port 587 config uses required STARTTLS');

  const validUser = db.get('smtp_user')!;
  const validHost = db.get('smtp_host')!;
  const callsBeforeMismatch = calls;
  db.set('smtp_user', 'itk200712@mail.com');
  const mismatchGet = await GET(request());
  assert.match((await mismatchGet.json()).configurationIssue, /provider mismatch/);
  const mismatchTest = await POST(request({ testTo: recipients[0] }));
  assert.equal(mismatchTest.status, 502);
  assert.match((await mismatchTest.json()).failed[0].error, /@mail.com/);
  assert.equal(calls, callsBeforeMismatch);
  db.set('smtp_user', validUser);
  const mismatchSave = await POST(request({ user: 'itk200712@mail.com', host: 'smtp.gmail.com', pass: 'new-password' }));
  assert.equal(mismatchSave.status, 400); assert.equal(db.get('smtp_user'), validUser);
  pass('Existing and newly submitted mail.com/Gmail mismatches are caught before network authentication');
  assert.equal(smtpConfigurationIssue({ host: 'smtp.gmail.com', user: 'person@workspace-company.example' }), null);
  assert.equal(smtpConfigurationIssue({ host: 'smtp.mail.com', user: 'person@mail.com' }), null);
  assert.match(smtpConfigurationIssue({ host: 'smtp.mail.com', user: 'person@gmail.com' }) ?? '', /mismatch/);
  pass('Valid Mail.com and custom Workspace configurations allowed; reverse Gmail mismatch blocked');

  const changedWithoutPass = await POST(request({ host: 'smtp.mail.com', user: 'person@mail.com' }));
  assert.equal(changedWithoutPass.status, 400); assert.equal(db.get('smtp_host'), validHost);
  assert.equal(db.get('smtp_user'), validUser);
  pass('Sender/host changes cannot silently reuse another account password');

  nodemailer.createTransport = (() => ({ close() {}, sendMail: async () => { throw Object.assign(new Error('Invalid login: 535-5.7.8 BadCredentials'), { code: 'EAUTH', responseCode: 535 }); } })) as typeof originalTransport;
  const auth535 = await POST(request({ testTo: recipients[0] }));
  assert.equal(auth535.status, 502);
  const auth535Error = (await auth535.json()).failed[0].error;
  assert.match(auth535Error, /535/); assert.match(auth535Error, /App Password/); assert.match(auth535Error, /2-Step/);
  assert.ok(!auth535Error.includes(db.get('smtp_pass')!));
  installTransport();
  pass('Realistic Gmail 535/EAUTH error gives actionable credential steps, not a false fix or secret leak');

  dbError = true;
  const writeFailure = await POST(request({ fromName: 'Will fail' }));
  assert.equal(writeFailure.status, 500); assert.match((await writeFailure.json()).reason, /Mock schema write error/);
  dbError = false; pass('Real database save failure reason is surfaced');

  cleanupError = true;
  const cleanupWarning = await POST(request({ fromName: 'Saved despite cleanup warning' }));
  assert.equal(cleanupWarning.status, 200); assert.ok((await cleanupWarning.json()).warning);
  assert.equal(await cleanupRetiredMailSettings(), false);
  cleanupError = false; pass('Cleanup failure warns without losing successful SMTP save');

  nodemailer.createTransport = (() => ({ close() {}, sendMail: async () => ({ accepted: [] }) })) as typeof originalTransport;
  assert.equal((await sendViaSmtp(config, recipients[0], 'Test', 'Test')).ok, false);
  pass('Empty SMTP accepted list is a failure');
  nodemailer.createTransport = (() => ({ close() {}, sendMail: async () => { throw new Error(`Auth failed ${config.pass}`); } })) as typeof originalTransport;
  const redacted = await sendViaSmtp(config, recipients[0], 'Test', 'Test'); assert.equal(redacted.ok, false);
  assert.ok(!redacted.error?.includes(config.pass)); pass('SMTP errors redact credentials');
  installTransport();

  assert.equal(formatFileSize(36_700_000), '36.7 MB (36,700,000 bytes)');
  let reportText = '';
  const reports = await sendBackupReport({ status: 'success', fileName: 'actual.zip', fileSize: 36_700_000, durationMs: 1000 }, recipients,
    async (to, subject, text) => { reportText = text; return (await sendMail({ to, subject, text })).ok; });
  assert.equal(reports, 7); assert.match(reportText, /36\.7 MB \(36,700,000 bytes\)/);
  pass('Backup reports use SMTP for all recipients and preserve actual compressed ZIP size');
  const report = { status: 'success' as const, source: 'auto' as const, fileName: 'hourly-success.zip', fileSize: 36_700_000, durationMs: 1234, destinations: ['Supabase'] };
  settings.set('mail_route_backup_1', recipients[0]);
  for (let i = 2; i <= MAIL_SLOTS; i++) settings.set(`mail_route_backup_${i}`, '');
  smtpTo.length = 0; mailPayloads.length = 0;
  const queued = await enqueueBackupReport(report, await routeEmailsServer('backup'), 'Backup successful');
  assert.ok(db.has(queued)); assert.ok(queued.startsWith(BACKUP_MAIL_PREFIX)); assert.equal(smtpTo.length, 0);
  const immediate = await flushBackupReportQueue({ key: queued });
  assert.equal(immediate.pending, false); assert.equal(immediate.sent, 1);
  assert.deepEqual(smtpTo, [recipients[0]]);
  assert.ok(historyPatches.some(p => String(p.detail).includes('SMTP accepted')));
  const messageId = (mailPayloads[0] as { messageId?: string }).messageId;
  assert.match(messageId ?? '', /^<mpcs-/);
  pass('Successful ZIP completion queues privately and sends immediate report to ONLY the configured backup inbox');

  await enqueueBackupReport(report, recipients, 'Duplicate enqueue must not change the delivered run');
  await flushBackupReportQueue({ key: queued });
  assert.equal(smtpTo.length, 1);
  pass('Same successful run is not emailed again after acknowledgement/re-enqueue');

  const retryReport = { ...report, fileName: 'transient-retry.zip' };
  smtpErrors.add(recipients[0]); mailPayloads.length = 0;
  const retryKey = await enqueueBackupReport(retryReport, recipients.slice(0, 2), 'Backup successful despite SMTP failure');
  smtpTo.length = 0;
  const firstTry = await flushBackupReportQueue({ key: retryKey });
  assert.equal(firstTry.pending, true); assert.equal(firstTry.sent, 1);
  assert.match(JSON.parse(db.get(retryKey)!).lastError, /SMTP authentication/);
  const firstMessageId = (mailPayloads.find(p => p.to === recipients[0]) as { messageId?: string }).messageId;
  smtpErrors.clear(); smtpTo.length = 0; mailPayloads.length = 0;
  const secondTry = await flushBackupReportQueue({ key: retryKey });
  assert.equal(secondTry.pending, false); assert.equal(secondTry.sent, 2);
  assert.deepEqual(smtpTo, [recipients[0]]);
  pass('Durable retry survives SMTP failure and retries ONLY the still-unaccepted recipient');
  assert.equal((mailPayloads[0] as { messageId?: string }).messageId, firstMessageId);
  pass('Report retries retain a stable per-recipient Message-ID');

  const simultaneousKey = await enqueueBackupReport({ ...report, fileName: 'overlap.zip' }, [recipients[0]], 'Backup done');
  smtpTo.length = 0;
  await Promise.all([flushBackupReportQueue({ key: simultaneousKey }), flushBackupReportQueue({ key: simultaneousKey })]);
  assert.equal(smtpTo.length, 1);
  pass('Atomic queue lease prevents overlapping cron workers sending the same acknowledged report');

  settings.set('mail_route_backup_1', ''); settings.set('contact_email_1', 'unrelated-contact@example.com');
  assert.deepEqual(await routeEmailsServer('backup'), []);
  const noRecipientKey = await enqueueBackupReport({ ...report, fileName: 'waiting-for-recipient.zip' }, [], 'Backup done');
  smtpTo.length = 0;
  const waiting = await flushBackupReportQueue({ key: noRecipientKey });
  assert.equal(waiting.pending, true); assert.match(waiting.error, /Auto Backup Reports/); assert.equal(smtpTo.length, 0);
  settings.set('mail_route_backup_1', recipients[0]);
  assert.equal((await flushBackupReportQueue({ key: noRecipientKey })).pending, false);
  assert.deepEqual(smtpTo, [recipients[0]]);
  pass('Missing backup recipient remains pending, never falls back to Contact; saving recipient allows retry');

  const skippedKey = await enqueueBackupReport({ ...report, fileName: 'retry-on-skipped-slot.zip' }, [recipients[0]], 'Backup done');
  settings.set('backup_schedule_enabled', '0');
  settings.set('backup_schedule_running_at', '0');
  smtpTo.length = 0;
  const deniedTick = await scheduledPost(new NextRequest('https://smtp-test.invalid/api/scheduled-backup', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-backup-secret': 'wrong-secret' }, body: '{}',
  }));
  assert.equal(deniedTick.status, 401); assert.equal(smtpTo.length, 0); assert.equal(JSON.parse(db.get(skippedKey)!).sentAt, '');
  pass('Unauthenticated cron request cannot drain or expose private report queue');
  const skippedTick = await scheduledPost(new NextRequest('https://smtp-test.invalid/api/scheduled-backup', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-backup-secret': 'keep-cron' }, body: '{}',
  }));
  assert.equal(skippedTick.status, 200); assert.equal((await skippedTick.json()).skipped, true);
  assert.deepEqual(smtpTo, [recipients[0]]); assert.ok(JSON.parse(db.get(skippedKey)!).sentAt);
  assert.equal(settings.get('backup_schedule_running_at'), '0');
  pass('Actual authenticated cron handler retries pending email even on skipped/disabled backup slots and clears run lock');

  const expiredKey = await enqueueBackupReport({ ...report, fileName: 'recover-after-interruption.zip' }, [recipients[0]], 'Backup done');
  const expired = JSON.parse(db.get(expiredKey)!); expired.lease = Date.now() - 1; db.set(expiredKey, JSON.stringify(expired));
  smtpTo.length = 0;
  assert.equal((await flushBackupReportQueue({ key: expiredKey })).pending, false); assert.equal(smtpTo.length, 1);
  pass('Expired worker lease recovers after interruption without rebuilding the ZIP');

  console.log(`\nRESULT: ${passed} behavioral tests passed`);
} finally { globalThis.fetch = originalFetch; nodemailer.createTransport = originalTransport; }
