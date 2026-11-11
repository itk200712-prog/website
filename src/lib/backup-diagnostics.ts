import type { BackupTimerStatus } from "@/lib/backup-timer";
import { SCHEDULE_SETTING_KEYS, SCHEDULE_LAST_SUCCESS_KEY, parseScheduleSettings, backupDueDecision, nextRunLabel } from "@/lib/scheduled-backup";
export const BACKUP_RUNTIME_PREFIX = "backup_runtime:";
const BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const DEPLOYMENT = process.env.VERCEL_GIT_COMMIT_SHA ?? "local";
type Tick = { at: string; updatedAt: string; phase: string; reason?: string; file?: string; emailAccepted?: number; emailPending?: boolean };
export type BackupDiagnostics = { ok: true; checkedAt: string; enabled: boolean; intervalHours: number; encrypted: boolean; nextRun: string;
  lastSuccess: string | null; dueNow: boolean; dueReason: string; cron: Tick | null; cronObservedRecently: boolean;
  scheduledSuccessesInRetainedHistory: number; intervalsMinutes: number[]; recurringRunsObserved: boolean;
  timer?: BackupTimerStatus; pendingReports: number; smtpAcceptedReports: number; inboxDelivery: "unconfirmed";
  recentRuns: { file: string; at: string; status: string; manualTest: boolean; email: string }[]; warnings: string[] };
async function db(path: string, init: RequestInit = {}) {
  if (!BASE || !SERVICE) throw new Error("Backup diagnostics: server_not_configured");
  const res = await fetch(`${BASE}/rest/v1/${path}`, { ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", ...(init.headers as Record<string, string>) }, cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Backup diagnostics database HTTP ${res.status}`);
  return res;
}
/** Observation only: never calls the backup handler or sends a test message. */
export async function recordBackupRuntime(force: boolean, at: string, phase: string, extra: Omit<Partial<Tick>, "at" | "updatedAt" | "phase"> = {}) {
  await db("backup_secrets", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: BACKUP_RUNTIME_PREFIX + (force ? "manual" : "cron"), value: JSON.stringify({ at, updatedAt: new Date().toISOString(), phase, project: BASE, deployment: DEPLOYMENT, ...extra }) }) }).catch(() => undefined);
}
export function summarizeBackupDiagnostics(settingsRows: { key: string; value: string }[], history: Record<string, unknown>[], privateRows: { key: string; value: string }[], now = new Date()): BackupDiagnostics {
  const settings = new Map(settingsRows.map((r) => [r.key, r.value]));
  const schedule = parseScheduleSettings((key) => settings.get(key));
  const lastSuccess = settings.get(SCHEDULE_LAST_SUCCESS_KEY) || null;
  const decision = backupDueDecision(schedule, lastSuccess, now);
  let cron: Tick | null = null, currentEnvironment = false, pendingReports = 0, smtpAcceptedReports = 0;
  for (const row of privateRows) {
    let v: any; try { v = JSON.parse(row.value); } catch { continue; }
    if (row.key === BACKUP_RUNTIME_PREFIX + "cron") { currentEnvironment = v.project === BASE && v.deployment === DEPLOYMENT; cron = { at: String(v.at ?? ""), updatedAt: String(v.updatedAt ?? ""), phase: String(v.phase ?? ""), reason: typeof v.reason === "string" ? v.reason : undefined, file: typeof v.file === "string" ? v.file : undefined, emailAccepted: Number(v.emailAccepted) || 0, emailPending: Boolean(v.emailPending) }; }
    if (row.key.startsWith("backup_report_outbox:")) { if (v.sentAt) smtpAcceptedReports++; else pendingReports++; }
  }
  const age = cron ? now.getTime() - Date.parse(cron.at) : Infinity;
  const cronObservedRecently = currentEnvironment && Number.isFinite(age) && age >= 0 && age <= 20 * 60_000;
  const recentRuns = history.map((r) => ({ file: String(r.file_name ?? ""), at: String(r.created_at ?? ""), status: String(r.status ?? ""), manualTest: String(r.detail ?? "").includes("Manual test run"), email: String(r.detail ?? "").includes("SMTP accepted") ? "smtp_accepted" : String(r.detail ?? "").includes("PENDING") ? "pending" : "unknown" }));
  const successful = recentRuns.filter((r) => !r.manualTest && r.status === "success").map((r) => Date.parse(r.at)).filter(Number.isFinite).sort((a, b) => b - a);
  const intervalsMinutes = successful.slice(0, -1).map((at, i) => Math.round((at - successful[i + 1]) / 60_000));
  const latestObservedAge = successful.length ? now.getTime() - successful[0] : Infinity;
  const recurringRunsObserved = schedule.enabled && latestObservedAge >= 0 && latestObservedAge <= (schedule.intervalHours * 60 + 20) * 60_000 && intervalsMinutes.length >= 1 && intervalsMinutes.every((n) => Math.abs(n - schedule.intervalHours * 60) <= 20);
  const warnings: string[] = [];
  if (!schedule.enabled) warnings.push("Auto-backup disabled");
  if (!cronObservedRecently) warnings.push("No recent authenticated cron heartbeat. A saved secret is not proof that the SQL timer is installed/running; re-run Copy SQL with the SAME secret if needed.");
  if (!lastSuccess) warnings.push("No saved successful backup marker");
  if (lastSuccess && now.getTime() < Date.parse(lastSuccess)) warnings.push("Stored backup timestamp is in the future relative to server time; check clocks");
  if (lastSuccess && now.getTime() - Date.parse(lastSuccess) > (schedule.intervalHours * 60 + 20) * 60_000) warnings.push("Latest successful backup is older than the configured interval plus 20-minute tolerance");
  if (pendingReports) warnings.push(`${pendingReports} backup report(s) awaiting SMTP acceptance`);
  if (!recurringRunsObserved) warnings.push("Retained history does not prove consecutive scheduled intervals. Manual test runs do not prove hourly automation.");
  return { ok: true, checkedAt: now.toISOString(), enabled: schedule.enabled, intervalHours: schedule.intervalHours, encrypted: schedule.encrypt, nextRun: nextRunLabel(schedule, now), lastSuccess, dueNow: decision.due, dueReason: decision.reason, cron, cronObservedRecently, scheduledSuccessesInRetainedHistory: successful.length, intervalsMinutes, recurringRunsObserved, pendingReports, smtpAcceptedReports, inboxDelivery: "unconfirmed", recentRuns, warnings };
}
export async function loadBackupDiagnostics(): Promise<BackupDiagnostics> {
  const [settingsRows, history, privateRows, timer] = await Promise.all([
    db(`system_settings?select=key,value&key=in.(${[...Object.values(SCHEDULE_SETTING_KEYS), SCHEDULE_LAST_SUCCESS_KEY].join(",")})`).then((r) => r.json()),
    db("backup_history?select=file_name,created_at,status,detail&action=eq.scheduled&order=created_at.desc&limit=10").then((r) => r.json()),
    db("backup_secrets?select=key,value&or=(key.like.backup_runtime:*,key.like.backup_report_outbox:*)&limit=1000").then((r) => r.json()),
    db("rpc/mpcs_backup_timer_status", { method: "POST", body: "{}" }).then(r => r.json()).then(v => ({ available: true, installed: v.installed === true,
      job: v.job ? { active: v.job.active === true, schedule: String(v.job.schedule), dynamicSecret: v.job.dynamicSecret === true } : null,
      lastRequest: v.lastRequest ? { requestId: Number(v.lastRequest.requestId), at: String(v.lastRequest.at) } : null,
      lastResponse: v.lastResponse ? { statusCode: Number(v.lastResponse.statusCode) || null, timedOut: v.lastResponse.timedOut === true, transportError: v.lastResponse.transportError === true, at: String(v.lastResponse.at) } : null,
    } as BackupTimerStatus)).catch(() => ({ available: false, installed: false } as BackupTimerStatus)),
  ]);
  const result = summarizeBackupDiagnostics(settingsRows, history, privateRows);
  result.timer = timer;
  if (!timer.available) result.warnings.push("Database timer installer/status RPC unavailable. Run the single Copy SQL installer, then Save / Repair timer.");
  else if (!timer.installed || !timer.job?.active || !timer.job.dynamicSecret) result.warnings.push("Database timer is absent, inactive or outdated. Use Install / Repair database timer.");
  if (timer.lastResponse?.statusCode === 401) result.warnings.push("Timer HTTP 401: cron authentication failed. Repair the timer to read the CURRENT secret on each tick.");
  if (timer.lastResponse?.timedOut || timer.lastResponse?.transportError) result.warnings.push("Database timer HTTP timeout/transport failure. A dispatched request alone does not prove backup completion.");
  if ((timer.lastResponse?.statusCode ?? 0) >= 500) result.warnings.push("Scheduled handler returned a server error. Inspect recent failed backup history; do not report success.");
  return result;
}
