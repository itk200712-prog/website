import assert from 'node:assert/strict';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://diagnostics.invalid';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-service-not-a-real-key';
const { summarizeBackupDiagnostics, recordBackupRuntime } = await import('../src/lib/backup-diagnostics');
const { backupDueDecision, parseScheduleSettings } = await import('../src/lib/scheduled-backup');
const { buildBackupReportEmail } = await import('../src/lib/backup-report');
const { GET } = await import('../src/app/api/backup/diagnostics/route');
const { NextRequest } = await import('next/server');
let passed = 0;
const pass = (name: string) => { passed++; console.log('PASS ' + name); };
const now = new Date('2026-10-18T16:15:00Z');
const settings = [
  { key: 'backup_schedule_enabled', value: '1' }, { key: 'backup_schedule_interval_hours', value: '1' },
  { key: 'backup_schedule_saved_at', value: '2026-10-18T08:40:00Z' }, { key: 'backup_schedule_encrypt', value: '1' },
  { key: 'backup_schedule_to_mega', value: '1' }, { key: 'backup_schedule_last_success_date', value: '2026-10-18T16:01:00Z' },
];
const history = [
  { file_name: 'manual.zip', created_at: '2026-10-18T16:12:00Z', status: 'success', detail: 'Manual test run · Email report: SMTP accepted (1)' },
  { file_name: 'hour-2.zip', created_at: '2026-10-18T16:01:00Z', status: 'success', detail: 'Every 1h · Email report: SMTP accepted (1)' },
  { file_name: 'hour-1.zip', created_at: '2026-10-18T15:01:00Z', status: 'success', detail: 'Every 1h · Email report: PENDING SMTP' },
];
const rows = [
  { key: 'backup_runtime:cron', value: JSON.stringify({ project: 'https://diagnostics.invalid', deployment: 'local', at: '2026-10-18T16:14:00Z', phase: 'skipped', updatedAt: '2026-10-18T16:14:01Z' }) },
  { key: 'backup_report_outbox:a', value: JSON.stringify({ sentAt: '2026-10-18T16:01:03Z', accepted: ['private-address@example.com'], report: { secret: 'must-not-leak' } }) },
  { key: 'backup_report_outbox:b', value: JSON.stringify({ sentAt: '', recipients: ['private-address@example.com'], lastError: 'some SMTP error must-not-leak' }) },
];
const summary = summarizeBackupDiagnostics(settings, history, rows, now);
assert(summary.cronObservedRecently); assert(summary.recurringRunsObserved); assert.equal(summary.scheduledSuccessesInRetainedHistory, 2); assert.deepEqual(summary.intervalsMinutes, [60]);
pass('Observed cron heartbeat and consecutive one-hour automatic backups are independently confirmed');
assert.equal(summary.pendingReports, 1); assert.equal(summary.smtpAcceptedReports, 1); assert.equal(summary.inboxDelivery, 'unconfirmed');
assert(!JSON.stringify(summary).includes('private-address')); assert(!JSON.stringify(summary).includes('must-not-leak'));
pass('SMTP accepted/pending are separate from inbox receipt; recipient/secret payloads do not leak');
assert.equal(summarizeBackupDiagnostics(settings, history.slice(0, 1), rows, now).recurringRunsObserved, false);
pass('A manual real-backup test does not prove hourly automation');
assert.equal(summarizeBackupDiagnostics(settings, history, rows.filter((r) => !r.key.includes('runtime')), now).cronObservedRecently, false);
pass('Configured interval/secret or successful history does not falsely prove an active timer');
const otherProject = rows.map((r) => r.key === 'backup_runtime:cron' ? { ...r, value: JSON.stringify({ ...JSON.parse(r.value), project: 'https://another-project.invalid' }) } : r);
assert.equal(summarizeBackupDiagnostics(settings, history, otherProject, now).cronObservedRecently, false);
pass('Heartbeat metadata imported from another project cannot masquerade as a running timer here');
const stale = [{ key: 'backup_runtime:cron', value: JSON.stringify({ at: '2026-10-17T10:00:00Z', phase: 'building' }) }];
assert.equal(summarizeBackupDiagnostics(settings, history, stale, now).cronObservedRecently, false);
pass('Stale cron observations are not treated as live scheduler health');
assert.equal(summarizeBackupDiagnostics(settings, history, rows, new Date('2026-10-20T16:15:00Z')).recurringRunsObserved, false);
pass('Old regular history cannot falsely prove that backups are still running hourly now');
const future = settings.map((r) => r.key === 'backup_schedule_last_success_date' ? { ...r, value: '2026-10-20T00:00:00Z' } : r);
assert(summarizeBackupDiagnostics(future, history, rows, now).warnings.some((w) => w.includes('future')));
pass('Clock/timestamp mismatch is explicit instead of inventing a recent successful run');
const schedule = parseScheduleSettings((key) => new Map(settings.map((r) => [r.key, r.value])).get(key));
let last: string | null = null;
for (let hour = 0; hour < 48; hour++) {
  const at = new Date(Date.parse('2026-10-18T09:31:00Z') + hour * 3600_000);
  const due = backupDueDecision(schedule, last, at); assert(due.due, `hour ${hour}`);
  last = at.toISOString(); assert.equal(backupDueDecision(schedule, last, at).due, false);
}
pass('48 consecutive hourly slot calculations run once per slot without save-time/midnight regressions (simulation only)');
const report = buildBackupReportEmail({ status: 'success', source: 'auto', fileName: 'fixture.zip', fileSize: 36_700_000, durationMs: 1500, encrypted: true, mediaCoverage: { files: 76, board: 5, bot: 1, templates: 70, missing: 0 } });
assert(report.body.includes('Board 5')); assert(report.body.includes('bot 1')); assert(report.body.includes('Templates 70')); assert(report.body.includes('Missing 0')); assert(report.body.includes('encrypted database.sql'));
pass('Actual backup confirmation template includes Board/bot/templates coverage and explains encrypted image location');

const originalFetch = globalThis.fetch;
let role = 'member', failHistory = false;
const writes: { key: string; value: string }[] = [];
let getReads = 0;
try {
  globalThis.fetch = (async (input: any, init?: RequestInit) => {
    const url = new URL(String(input)); assert.equal(url.hostname, 'diagnostics.invalid');
    if (init?.method === 'POST') { assert.equal(url.pathname, '/rest/v1/backup_secrets'); writes.push(JSON.parse(String(init.body))); return new Response(null, { status: 204 }); }
    getReads++;
    if (url.pathname === '/auth/v1/user') return Response.json({ id: '12345678-1234-1234-1234-123456789abc' });
    if (url.pathname === '/rest/v1/profiles') return Response.json([{ role }]);
    if (url.pathname === '/rest/v1/system_settings') return Response.json(settings);
    if (url.pathname === '/rest/v1/backup_history') return failHistory ? new Response('unavailable', { status: 503 }) : Response.json(history);
    if (url.pathname === '/rest/v1/backup_secrets') return Response.json(rows);
    throw new Error('Unexpected diagnostics request');
  }) as typeof fetch;
  const req = (authorized = false) => new NextRequest('https://app.invalid/api/backup/diagnostics', { headers: authorized ? { Authorization: 'Bearer fixture-session' } : {} });
  assert.equal((await GET(req())).status, 401); assert.equal(getReads, 0);
  assert.equal((await GET(req(true))).status, 403);
  role = 'admin'; assert.equal((await GET(req(true))).status, 403);
  pass('Diagnostics endpoint rejects unauthenticated users, members and ordinary admins');
  role = 'superadmin';
  const good = await GET(req(true)); assert.equal(good.status, 200);
  const text = await good.text(); assert(!text.includes('fixture-service')); assert(!text.includes('must-not-leak')); assert(!text.includes('private-address'));
  assert.equal(writes.length, 0);
  pass('Superadmin live diagnostics is read-only and never triggers a backup, sends SMTP, or exposes stored secrets');
  failHistory = true; assert.equal((await GET(req(true))).status, 503); failHistory = false;
  pass('Unavailable private history is an explicit diagnostics failure, not a false healthy/empty result');
  await recordBackupRuntime(false, now.toISOString(), 'received'); await recordBackupRuntime(true, now.toISOString(), 'saved', { emailAccepted: 1, emailPending: false });
  assert.equal(writes[0].key, 'backup_runtime:cron'); assert.equal(writes[1].key, 'backup_runtime:manual');
  pass('Manual tests cannot overwrite or impersonate the observed automatic cron heartbeat');
} finally { globalThis.fetch = originalFetch; }
console.log(`\n${passed} backup diagnostics tests passed (mocked/simulated; no live cron or SMTP).`);
