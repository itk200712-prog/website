// Durable, private backup-report outbox. Uses the existing backup_secrets table.
import { buildBackupReportEmail, type BackupReportInput } from "@/lib/backup-report";
import { routeEmailsServer } from "@/lib/mail-routes-server";
import { sendMail } from "@/lib/mail-server";

const BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
export const BACKUP_MAIL_PREFIX = "backup_report_outbox:";
const LEASE_MS = 5 * 60_000;
type Entry = {
  lease: number; // Must remain the first JSON property for the atomic claim filter.
  report: Omit<BackupReportInput, "at"> & { at: string };
  recipients: string[]; accepted: string[]; attempts: number;
  lastError: string; sentAt: string; historyDetail: string;
};
export type BackupMailOutcome = { sent: number; pending: boolean; error: string; busy?: boolean };
function headers(extra: Record<string, string> = {}) {
  return { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", ...extra };
}
function addressList(values: string[]) {
  return Array.from(new Set(values.map(v => v.trim().toLowerCase()).filter(v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v))));
}
async function request(path: string, init: RequestInit = {}) {
  if (!BASE || !SERVICE) throw new Error("Backup email queue: server_not_configured");
  const res = await fetch(`${BASE}/rest/v1/${path}`, { ...init, headers: headers(init.headers as Record<string, string>), cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Backup email queue database HTTP ${res.status}`);
  return res;
}
async function persist(key: string, data: Entry) {
  await request(`backup_secrets?${new URLSearchParams({ key: `eq.${key}` })}`, {
    method: "PATCH", body: JSON.stringify({ value: JSON.stringify(data) }),
  });
}
export function backupMailHistoryLabel(result: BackupMailOutcome): string {
  return result.pending
    ? `Email report: PENDING SMTP retry; accepted ${result.sent}; ${result.error || "Waiting for SMTP"}`
    : `Email report: SMTP accepted (${result.sent}); inbox delivery unconfirmed`;
}
async function updateHistory(entry: Entry, result: BackupMailOutcome) {
  await request(`backup_history?${new URLSearchParams({ action: "eq.scheduled", file_name: `eq.${entry.report.fileName}` })}`, {
    method: "PATCH", body: JSON.stringify({ detail: `${entry.historyDetail} · ${backupMailHistoryLabel(result)}` }),
  }).catch(() => undefined);
}

/** Must be persisted BEFORE sending. Re-enqueue of one run never overwrites acknowledgements. */
export async function enqueueBackupReport(report: BackupReportInput, emails: string[], historyDetail: string): Promise<string> {
  const key = BACKUP_MAIL_PREFIX + report.fileName;
  const entry: Entry = { lease: 0, report: { ...report, at: (report.at ?? new Date()).toISOString() },
    recipients: addressList(emails), accepted: [], attempts: 0, lastError: "", sentAt: "", historyDetail };
  await request("backup_secrets", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ key, value: JSON.stringify(entry) }) });
  return key;
}

/** Called in the completion request immediately, and on EVERY authenticated cron tick, even skipped slots. */
export async function flushBackupReportQueue(options: { key?: string; limit?: number } = {}): Promise<BackupMailOutcome> {
  const query = new URLSearchParams({ select: "key,value", key: options.key ? `eq.${options.key}` : `like.${BACKUP_MAIL_PREFIX}*`, limit: "1000", order: "key.asc" });
  const rows = await (await request(`backup_secrets?${query}`)).json() as { key: string; value: string }[];
  let sent = 0, pending = false, error = "", processed = 0;
  for (const row of rows) {
    let entry: Entry;
    try { entry = JSON.parse(row.value) as Entry; } catch { continue; }
    if (!entry.report?.fileName || !Array.isArray(entry.recipients) || !Array.isArray(entry.accepted)) continue;
    if (entry.sentAt) {
      // A seven-day sent tombstone makes repeated enqueue of the same run idempotent.
      if (Date.parse(entry.sentAt) < Date.now() - 7 * 86_400_000) {
        await request(`backup_secrets?${new URLSearchParams({ key: `eq.${row.key}` })}`, { method: "DELETE" }).catch(() => undefined);
      }
      if (options.key) sent += entry.accepted.length;
      continue;
    }
    if (processed >= (options.limit ?? 2)) { pending = true; continue; }
    if (entry.lease > Date.now()) { pending = true; continue; }
    const previousLease = Number(entry.lease) || 0;
    entry.lease = Date.now() + LEASE_MS;
    // Atomic compare-and-set on a short numeric JSON prefix, not a large body in the URL.
    const claimQuery = new URLSearchParams({ key: `eq.${row.key}`, value: `like.{"lease":${previousLease},*` });
    const claim = await (await request(`backup_secrets?${claimQuery}`, { method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ value: JSON.stringify(entry) }) })).json() as unknown[];
    if (!claim.length) { pending = true; continue; }
    processed++;
    try {
      if (!entry.recipients.length) entry.recipients = addressList(await routeEmailsServer("backup"));
      const remaining = entry.recipients.filter(email => !entry.accepted.includes(email));
      if (!entry.recipients.length) throw new Error("Admin → Emails → Auto Backup Reports එකේ ලිපිනයක් දාලා Save කරන්න");
      if (remaining.length) {
        const { subject, body } = buildBackupReportEmail({ ...entry.report, at: new Date(entry.report.at) });
        const mail = await sendMail({ to: remaining, subject, text: body, messageIdSeed: `backup:${entry.report.fileName}` });
        entry.attempts++;
        entry.accepted = addressList([...entry.accepted, ...mail.results.filter(r => r.ok).map(r => r.to)]);
        entry.lastError = mail.failed.map(r => `${r.to}: ${r.error}`).join("; ").slice(0, 1200);
      }
      entry.sentAt = entry.recipients.every(email => entry.accepted.includes(email)) ? new Date().toISOString() : "";
    } catch (failure) {
      entry.lastError = (failure as Error).message.slice(0, 1200);
    }
    entry.lease = 0;
    // Acknowledgements are durable before history/cleanup. No backup rebuild on retry.
    await persist(row.key, entry);
    const outcome = { sent: entry.accepted.length, pending: !entry.sentAt, error: entry.lastError };
    await updateHistory(entry, outcome);
    sent += outcome.sent; pending ||= outcome.pending;
    if (outcome.error) error = outcome.error;
  }
  return { sent, pending, error };
}
