import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';

// Mock service configuration BEFORE imports: no live DB, real recipients, or external mail.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mail-test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon';
const { sendViaSilentForms, sendViaSmtp, sendMail, loadRecipientKeys, saveRecipientKey, recipientKeyMetadata, RECIPIENT_KEY_PREFIX } = await import('../src/lib/mail-server');
const { formatFileSize, sendBackupReport } = await import('../src/lib/backup-report');
const { NextRequest } = await import('next/server');
const { GET, POST } = await import('../src/app/api/mail/settings/route');
const originalFetch = globalThis.fetch;
const originalTransport = nodemailer.createTransport;
const db = new Map<string, string>([['silentforms_access_key', 'global_key_NEVER_USE_1234'], ['mail_provider', 'silentforms']]);
const posts: Record<string, string>[] = [];
const writes: Record<string, string>[][] = [];
const smtpTo: string[] = [];
const sfErrors = new Map<string, number>();
const smtpErrors = new Set<string>();
let role = 'admin';
let keyReads = 0;
let passed = 0;
const pass = (name: string) => { passed++; console.log(`PASS ${name}`); };
const keyFor = (n: number) => `recipient_${n}_secret_1234567890`;
const config = { host: 'test.invalid', port: 465, secure: true, user: 'test@example.com', pass: 'dummy', fromName: 'MPCS', fromEmail: 'test@example.com' };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
function request(body?: unknown, authorized = true) {
  return new NextRequest('https://mail-test.invalid/api/mail/settings', {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(authorized ? { Authorization: 'Bearer test-session' } : {}), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
try {
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const u = new URL(String(url));
    if (u.hostname === 'silentforms.com') {
      const payload = JSON.parse(String(init?.body));
      posts.push(payload);
      const status = sfErrors.get(payload.accessKey);
      return status ? response({ status: 'error', message: `Mock provider ${status}` }, status) : response({ status: 'success' });
    }
    assert.equal(u.hostname, 'mail-test.invalid');
    if (u.pathname === '/auth/v1/user') return response({ id: '12345678-1234-1234-1234-123456789abc' });
    if (u.pathname === '/rest/v1/profiles') return response([{ role }]);
    assert.equal(u.pathname, '/rest/v1/backup_secrets');
    if (init?.method === 'POST') {
      const rows = JSON.parse(String(init.body));
      writes.push(rows);
      for (const row of rows) { assert.deepEqual(Object.keys(row).sort(), ['key', 'value']); db.set(row.key, row.value); }
      return new Response(null, { status: 204 });
    }
    keyReads++;
    const filter = u.searchParams.get('key') ?? '';
    return response(Array.from(db, ([key, value]) => ({ key, value })).filter(row => filter.startsWith('like.')
      ? row.key.startsWith(RECIPIENT_KEY_PREFIX)
      : filter.slice(4, -1).split(',').includes(row.key)));
  }) as typeof fetch;
  nodemailer.createTransport = (() => ({ sendMail: async ({ to }: { to: string }) => {
    smtpTo.push(to);
    if (smtpErrors.has(to)) throw new Error('SMTP authentication / recipient failure');
    return { accepted: [to] };
  } })) as typeof originalTransport;

  const before = keyReads;
  assert.equal((await GET(request(undefined, false))).status, 403);
  assert.equal((await POST(request({ recipientEmail: 'one@example.com', recipientAccessKey: keyFor(1) }, false))).status, 403);
  assert.equal(keyReads, before);
  assert.equal(writes.length, 0);
  pass('Unauthenticated secret reads/writes denied before DB access');
  role = 'member';
  assert.equal((await GET(request())).status, 403);
  assert.equal((await POST(request({ recipientEmail: 'one@example.com', recipientAccessKey: keyFor(1) }))).status, 403);
  role = 'admin';
  pass('Non-admin secret access denied');

  assert.equal(await saveRecipientKey(' ONE@Example.COM ', keyFor(1)), null);
  assert.equal(db.get(RECIPIENT_KEY_PREFIX + 'one@example.com'), keyFor(1));
  assert.equal((await loadRecipientKeys()).get('one@example.com'), keyFor(1));
  pass('Normalized email mapping persists and reloads');
  for (let n = 2; n <= 7; n++) assert.equal(await saveRecipientKey(`person${n}@example.com`, keyFor(n)), null);
  assert.equal((await loadRecipientKeys()).size, 7);
  pass('Seven independent recipient mappings save without overwriting each other');

  assert.equal(await saveRecipientKey('bad-email', keyFor(1)), 'invalid_recipient_email');
  assert.equal(await saveRecipientKey('one@example.com', 'bad'), 'invalid_access_key');
  assert.equal((await POST(request({ recipientEmail: 'one@example.com', recipientAccessKey: {} }))).status, 400);
  assert.equal(db.get(RECIPIENT_KEY_PREFIX + 'one@example.com'), keyFor(1));
  pass('Invalid email/key/payload cannot overwrite saved mapping');

  const metadata = await recipientKeyMetadata();
  assert.equal(metadata['one@example.com'].configured, true);
  assert.ok(!JSON.stringify(metadata).includes(keyFor(1)));
  const getResult = await GET(request());
  const publicBody = await getResult.text();
  assert.equal(getResult.status, 200);
  for (let n = 1; n <= 7; n++) assert.ok(!publicBody.includes(keyFor(n)));
  assert.ok(!publicBody.includes(db.get('silentforms_access_key')!));
  pass('Admin GET returns masked previews only, never stored full keys');

  const recipients = ['one@example.com', ...Array.from({ length: 6 }, (_, i) => `person${i + 2}@example.com`)];
  posts.length = 0;
  const seven = await sendViaSilentForms([...recipients, ' ONE@EXAMPLE.COM '], 'Test', 'ZIP size: 36.7 MB');
  assert.equal(seven.length, 7);
  assert.equal(posts.length, 7);
  for (let i = 0; i < recipients.length; i++) {
    const post = posts.find(p => p['To (configured)'] === recipients[i]);
    assert.equal(post?.accessKey, keyFor(i + 1));
    assert.equal(post?.sf_extra, '');
    assert.equal(post?.ccemail, undefined);
  }
  assert.ok(seven.every(r => r.ok));
  pass('Seven emails → seven matching keys; no shared CC, no duplicate normalized recipient');

  posts.length = 0;
  const missing = await sendViaSilentForms(['missing@example.com'], 'Test', 'Test');
  assert.equal(missing[0].ok, false);
  assert.equal(posts.length, 0);
  pass('Missing mapping never uses unrelated global/default key');

  sfErrors.set(keyFor(2), 403);
  const partial = await sendViaSilentForms([recipients[0], recipients[1]], 'Test', 'Test');
  assert.equal(partial.find(r => r.to === recipients[0])?.ok, true);
  assert.equal(partial.find(r => r.to === recipients[1])?.ok, false);
  pass('Bad key affects its own address only');
  for (const [key, value] of Object.entries({ smtp_host: 'smtp.test.invalid', smtp_port: '465', smtp_user: 'test@example.com', smtp_pass: 'dummy' })) db.set(key, value);
  posts.length = 0; smtpTo.length = 0;
  const mixed = await sendMail({ to: [recipients[0], recipients[1], 'missing@example.com'], subject: 'Test', text: 'Test' });
  assert.equal(mixed.ok, 3);
  assert.equal(mixed.failed.length, 0);
  assert.equal(mixed.method, 'mixed');
  assert.deepEqual(smtpTo.sort(), [recipients[1], 'missing@example.com'].sort());
  assert.equal(mixed.results.length, 3);
  pass('Partial SF success retries ONLY failed/missing addresses via SMTP');

  db.set('mail_provider', 'smtp');
  sfErrors.clear(); smtpErrors.add(recipients[1]); posts.length = 0; smtpTo.length = 0;
  const reverse = await sendMail({ to: recipients.slice(0, 2), subject: 'Test', text: 'Test' });
  assert.equal(reverse.ok, 2);
  assert.equal(reverse.method, 'mixed');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].accessKey, keyFor(2));
  pass('SMTP-primary partial failure retries ONLY failed address with its own SF key');
  db.set('mail_provider', 'silentforms'); smtpErrors.clear();

  sfErrors.set(keyFor(2), 429); posts.length = 0;
  await sendViaSilentForms(recipients.slice(0, 2), 'Test', 'Test');
  posts.length = 0;
  const cooldown = await sendViaSilentForms(recipients.slice(0, 2), 'Test', 'Test');
  assert.equal(cooldown[0].ok, true);
  assert.equal(cooldown[1].ok, false);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].accessKey, keyFor(1));
  sfErrors.clear(); await saveRecipientKey(recipients[1], keyFor(2));
  pass('Rate-limit cooldown isolated per key and reset on explicit re-save');

  posts.length = 0; smtpTo.length = 0;
  const isolated = await POST(request({ testTo: recipients[1], testProvider: 'silentforms' }));
  assert.equal(isolated.status, 200);
  assert.equal(posts[0].accessKey, keyFor(2));
  assert.equal(smtpTo.length, 0);
  assert.equal((await isolated.json()).delivery, 'unconfirmed');
  pass('Per-row test uses that saved key without SMTP fallback; delivery is unconfirmed');

  posts.length = 0; smtpErrors.add(recipients[1]);
  const smtpTest = await POST(request({ testTo: recipients[1], testProvider: 'smtp' }));
  assert.equal(smtpTest.status, 502);
  assert.equal(posts.length, 0);
  smtpErrors.clear();
  pass('SMTP test errors never hidden by SF fallback');

  const removal = await POST(request({ recipientEmail: 'ONE@example.com', recipientAccessKey: '' }));
  assert.equal(removal.status, 200);
  assert.equal((await loadRecipientKeys()).has('one@example.com'), false);
  assert.equal((await loadRecipientKeys()).size, 6);
  assert.equal(db.get(RECIPIENT_KEY_PREFIX + recipients[1]), keyFor(2));
  assert.equal((await sendViaSilentForms(['one@example.com'], 'Test', 'Test'))[0].ok, false);
  pass('Explicit key removal affects only that normalized address and cannot revive global fallback');

  nodemailer.createTransport = (() => ({ sendMail: async () => ({ accepted: [] }) })) as typeof originalTransport;
  assert.equal((await sendViaSmtp(config, 'one@example.com', 'Test', 'Test')).ok, false);
  pass('SMTP empty accepted list is failure');

  assert.equal(formatFileSize(Buffer.alloc(36_700_000).byteLength), '36.7 MB (36,700,000 bytes)');
  let reportText = '';
  const count = await sendBackupReport({ status: 'success', fileName: 'real.zip', fileSize: 36_700_000, durationMs: 1000 }, recipients, async (to, _subject, text) => {
    assert.equal(to.length, 7); reportText = text; return to.length;
  });
  assert.equal(count, 7); assert.match(reportText, /36\.7 MB \(36,700,000 bytes\)/);
  pass('Backup report uses server sender for all recipients and actual ZIP byte count');
  console.log(`\nRESULT: ${passed} behavioral tests passed`);
} finally {
  globalThis.fetch = originalFetch;
  nodemailer.createTransport = originalTransport;
}
