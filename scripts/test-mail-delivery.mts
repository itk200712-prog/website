import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { sendViaSilentForms, sendViaSmtp } from '../src/lib/mail-server';
import { formatFileSize } from '../src/lib/backup-report';

// No real mail, database writes or credentials: exercise provider behaviour in isolation.
const originalFetch = globalThis.fetch;
const originalTransport = nodemailer.createTransport;
const config = { host: 'test.invalid', port: 465, secure: true, user: 'test@example.com', pass: 'dummy', fromName: 'MPCS', fromEmail: 'test@example.com' };
try {
  let submitted: Record<string, string> = {};
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    submitted = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ status: 'success' }), { status: 200 });
  }) as typeof fetch;
  const results = await sendViaSilentForms(['one@example.com', 'two@example.com'], 'Test', 'ZIP size: 36.7 MB', 'dummy_key_1234567890');
  assert.equal(submitted.ccemail, 'one@example.com, two@example.com');
  assert.equal(submitted.sf_extra, '');
  assert.ok(results.every(r => r.ok && r.method === 'silentforms'));
  console.log('PASS SilentForms includes requested CC (only confirmed recipients can receive)');

  nodemailer.createTransport = (() => ({ sendMail: async () => ({ accepted: ['one@example.com'] }) })) as typeof originalTransport;
  assert.equal((await sendViaSmtp(config, 'one@example.com', 'Test', 'Test')).ok, true);
  console.log('PASS SMTP accepted recipient');
  nodemailer.createTransport = (() => ({ sendMail: async () => ({ accepted: [], rejected: ['one@example.com'] }) })) as typeof originalTransport;
  assert.equal((await sendViaSmtp(config, 'one@example.com', 'Test', 'Test')).ok, false);
  console.log('PASS SMTP rejected recipient is not success');
  nodemailer.createTransport = (() => ({ sendMail: async () => { throw new Error('SMTP authentication failed'); } })) as typeof originalTransport;
  const rejected = await sendViaSmtp(config, 'one@example.com', 'Test', 'Test');
  assert.equal(rejected.ok, false);
  assert.match(rejected.error ?? '', /authentication failed/);
  console.log('PASS SMTP authentication failure exposed, no SilentForms fallback in direct test');
  assert.equal(formatFileSize(Buffer.alloc(36_700_000).byteLength), '36.7 MB (36,700,000 bytes)');
  console.log('PASS final binary length formats decimal MB + exact bytes');
} finally {
  globalThis.fetch = originalFetch;
  nodemailer.createTransport = originalTransport;
}
