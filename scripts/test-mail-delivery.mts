import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';

// Isolated service mocks only: no live database writes, external HTTP calls or real mail.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://smtp-test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon';
const { sendViaSmtp, sendMail, cleanupRetiredMailSettings } = await import('../src/lib/mail-server');
const { formatFileSize, sendBackupReport } = await import('../src/lib/backup-report');
const { NextRequest } = await import('next/server');
const { GET, POST } = await import('../src/app/api/mail/settings/route');
const { POST: sendPost } = await import('../src/app/api/mail/send/route');
const originalFetch = globalThis.fetch;
const originalTransport = nodemailer.createTransport;
const db = new Map<string, string>([
  ['silentforms_access_key', 'retired-placeholder'], ['silentforms_recipient:old@example.com', 'retired-placeholder'],
  ['mail_provider', 'retired-provider'], ['backup_cron_secret', 'keep-cron'], ['gemini_api_key', 'keep-ai'],
]);
const smtpTo: string[] = [];
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
    assert.equal(u.pathname, '/rest/v1/backup_secrets');
    if (init?.method === 'DELETE') {
      assert.equal(u.searchParams.get('or'), '(key.like.silentforms*,key.eq.mail_provider)');
      if (cleanupError) return response({ message: 'cleanup unavailable' }, 503);
      for (const key of db.keys()) if (key.startsWith('silentforms') || key === 'mail_provider') db.delete(key);
      return new Response(null, { status: 204 });
    }
    if (init?.method === 'POST') {
      if (dbError) return response({ message: 'Mock schema write error', code: '42703' }, 400);
      const rows = JSON.parse(String(init.body));
      writes.push(rows);
      for (const row of rows) { assert.deepEqual(Object.keys(row).sort(), ['key', 'value']); db.set(row.key, row.value); }
      return new Response(null, { status: 204 });
    }
    const filter = u.searchParams.get('key') ?? '';
    return response(Array.from(db, ([key, value]) => ({ key, value })).filter(row => filter.slice(4, -1).split(',').includes(row.key)));
  }) as typeof fetch;
  const installTransport = () => {
    nodemailer.createTransport = ((options: Record<string, unknown>) => {
      assert.equal(options.requireTLS, !options.secure);
      return { close: () => { closed++; }, sendMail: async ({ to }: { to: string }) => {
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
  assert.deepEqual(Object.keys(JSON.parse(stateText)).sort(), ['configured','fromEmail','fromName','hasPassword','host','ok','port','provider','user'].sort());
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

  const sendResult = await sendPost(request({ to: recipients, subject: 'Test', text: 'Test' }));
  assert.equal(sendResult.status, 200); assert.equal((await sendResult.json()).sent, 7);
  assert.equal((await sendPost(request({ to: recipients, subject: 'Test', text: 'Test' }, false))).status, 401);
  pass('Authenticated send endpoint handles seven recipients; anonymous arbitrary relay denied');

  assert.equal((await POST(request({ port: 587 }))).status, 200); assert.equal(db.get('smtp_secure'), 'false');
  assert.equal((await sendMail({ to: recipients[0], subject: 'Test', text: 'Test' })).ok, 1);
  pass('Port 587 config uses required STARTTLS');

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
  console.log(`\nRESULT: ${passed} behavioral tests passed`);
} finally { globalThis.fetch = originalFetch; nodemailer.createTransport = originalTransport; }
