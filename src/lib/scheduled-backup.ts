// ============================================================================
//  Scheduled Auto-Backup — settings + due ගණනය (pure helpers)
//  Admin → Backup & Restore එකෙන් දවස් ගාණ (උදා: 3, 7) සහ වෙලාව (උදා: 09:00)
//  තෝරා save කළ විට, Supabase pg_cron එක විනාඩි 15කට වරක් site එකේ
//  /api/scheduled-backup route එක කැඳවයි. මේ helpers වලින් තමයි "අද ඒ
//  වෙලාවට backup එකක් ගත යුතුද" කියා තීරණය වන්නේ (ශ්‍රී ලංකා වේලාවෙන්).
//  Settings: system_settings (public) · රහස්: backup_secrets (superadmin-only)
// ============================================================================

export type BackupScheduleSettings = {
  enabled: boolean;
  /** දවස් කීයකට වරක්ද (1–30) */
  intervalDays: number;
  /** ශ්‍රී ලංකා වේලාවෙන් "HH:MM" (24h) */
  timeHHMM: string;
  /** settings save කරපු දිනය (LK, yyyy-mm-dd) — පළමු backup එක මෙයින් දවස් interval එකකට පසු */
  anchorDate: string;
  toSupabase: boolean;
  toMega: boolean;
  /** තබා ගන්නා අලුත්ම auto-backup ගාණ (ඊට වඩා පරණ ඒවා මැකේ) */
  keepCount: number;
  megaFolder: string;
};

export const SCHEDULE_SETTING_KEYS = {
  enabled: "backup_schedule_enabled",
  intervalDays: "backup_schedule_interval_days",
  time: "backup_schedule_time",
  anchor: "backup_schedule_anchor",
  toSupabase: "backup_schedule_to_supabase",
  toMega: "backup_schedule_to_mega",
  keep: "backup_schedule_keep",
  megaFolder: "backup_schedule_mega_folder",
} as const;

export const SCHEDULE_SECRET_KEYS = {
  megaEmail: "mega_email",
  megaPassword: "mega_password",
  cronSecret: "backup_cron_secret",
} as const;

export const DEFAULT_SCHEDULE: BackupScheduleSettings = {
  enabled: false,
  intervalDays: 3,
  timeHHMM: "09:00",
  anchorDate: "",
  toSupabase: true,
  toMega: false,
  keepCount: 8,
  megaFolder: "MPCS Backups",
};

function onOff(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function normalizeScheduleTime(value: unknown): string {
  const m = String(value ?? "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return DEFAULT_SCHEDULE.timeHHMM;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10) || 0));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10) || 0));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function parseScheduleSettings(get: (key: string) => string | undefined): BackupScheduleSettings {
  const interval = parseInt(get(SCHEDULE_SETTING_KEYS.intervalDays) ?? "", 10);
  const keep = parseInt(get(SCHEDULE_SETTING_KEYS.keep) ?? "", 10);
  return {
    enabled: onOff(get(SCHEDULE_SETTING_KEYS.enabled), false),
    intervalDays: Number.isFinite(interval) ? Math.min(30, Math.max(1, interval)) : DEFAULT_SCHEDULE.intervalDays,
    timeHHMM: normalizeScheduleTime(get(SCHEDULE_SETTING_KEYS.time)),
    anchorDate: (get(SCHEDULE_SETTING_KEYS.anchor) ?? "").trim(),
    toSupabase: onOff(get(SCHEDULE_SETTING_KEYS.toSupabase), true),
    toMega: onOff(get(SCHEDULE_SETTING_KEYS.toMega), false),
    keepCount: Number.isFinite(keep) ? Math.min(30, Math.max(2, keep)) : DEFAULT_SCHEDULE.keepCount,
    megaFolder: (get(SCHEDULE_SETTING_KEYS.megaFolder) ?? "").trim() || DEFAULT_SCHEDULE.megaFolder,
  };
}

/** settings object එක system_settings rows බවට (Admin save එකට) */
export function scheduleSettingsRows(s: BackupScheduleSettings): { key: string; value: string }[] {
  return [
    { key: SCHEDULE_SETTING_KEYS.enabled, value: s.enabled ? "1" : "0" },
    { key: SCHEDULE_SETTING_KEYS.intervalDays, value: String(s.intervalDays) },
    { key: SCHEDULE_SETTING_KEYS.time, value: normalizeScheduleTime(s.timeHHMM) },
    { key: SCHEDULE_SETTING_KEYS.anchor, value: s.anchorDate },
    { key: SCHEDULE_SETTING_KEYS.toSupabase, value: s.toSupabase ? "1" : "0" },
    { key: SCHEDULE_SETTING_KEYS.toMega, value: s.toMega ? "1" : "0" },
    { key: SCHEDULE_SETTING_KEYS.keep, value: String(s.keepCount) },
    { key: SCHEDULE_SETTING_KEYS.megaFolder, value: s.megaFolder },
  ];
}

// ── ශ්‍රී ලංකා (UTC+5:30) දිනය/වේලාව ──
const LK_OFFSET_MIN = 330;

export function lkDateParts(now: Date = new Date()): { dateStr: string; minutes: number } {
  const lk = new Date(now.getTime() + LK_OFFSET_MIN * 60_000);
  const y = lk.getUTCFullYear();
  const m = String(lk.getUTCMonth() + 1).padStart(2, "0");
  const d = String(lk.getUTCDate()).padStart(2, "0");
  return { dateStr: `${y}-${m}-${d}`, minutes: lk.getUTCHours() * 60 + lk.getUTCMinutes() };
}

function daysBetween(fromDateStr: string, toDateStr: string): number {
  const a = Date.parse(`${fromDateStr}T00:00:00Z`);
  const b = Date.parse(`${toDateStr}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  return Math.round((b - a) / 86_400_000);
}

function addDays(dateStr: string, days: number): string {
  const t = Date.parse(`${dateStr}T00:00:00Z`);
  if (!Number.isFinite(t)) return dateStr;
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = normalizeScheduleTime(hhmm).split(":").map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}

/**
 * අද (LK) backup දිනයක්ද? නීතිය: anchor දිනයෙන් දවස් interval එකේ
 * ගුණාකාරයක් ගෙවී ඇති දවස් (පළමු එක anchor + interval දිනයේ).
 */
export function isScheduleDay(s: BackupScheduleSettings, dateStr: string): boolean {
  if (!s.anchorDate) return false;
  const diff = daysBetween(s.anchorDate, dateStr);
  return Number.isFinite(diff) && diff > 0 && diff % s.intervalDays === 0;
}

/** ඊළඟ backup දිනය (Admin එකේ පෙන්වීමට) — අද due නම් අදම */
export function nextScheduleDate(s: BackupScheduleSettings, now: Date = new Date()): string {
  const { dateStr } = lkDateParts(now);
  if (!s.anchorDate) return addDays(dateStr, s.intervalDays);
  let cursor = dateStr;
  for (let i = 0; i <= s.intervalDays + 1; i++) {
    if (isScheduleDay(s, cursor)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

export type ScheduleDecision = { due: boolean; reason: string; todayStr: string; nextDate: string };

/**
 * දැන් backup එකක් ගත යුතුද?
 * lastSuccessDateStr = අන්තිමට සාර්ථක වූ scheduled backup එකේ LK දිනය (backup_history).
 */
export function backupDueDecision(
  s: BackupScheduleSettings,
  lastSuccessDateStr: string | null,
  now: Date = new Date()
): ScheduleDecision {
  const { dateStr: todayStr, minutes } = lkDateParts(now);
  const nextDate = nextScheduleDate(s, now);
  if (!s.enabled) return { due: false, reason: "disabled", todayStr, nextDate };
  if (!s.toSupabase && !s.toMega) return { due: false, reason: "no_destination", todayStr, nextDate };
  if (!isScheduleDay(s, todayStr)) return { due: false, reason: "not_schedule_day", todayStr, nextDate };
  if (lastSuccessDateStr && lastSuccessDateStr >= todayStr) {
    return { due: false, reason: "already_done_today", todayStr, nextDate };
  }
  if (minutes < timeToMinutes(s.timeHHMM)) return { due: false, reason: "before_time", todayStr, nextDate };
  return { due: true, reason: "due", todayStr, nextDate };
}

/** manual download එකේ නමමයි — `mpcs-full-backup-2026-10-19.zip` (එකම FULL ZIP එක) */
export function autoBackupFileName(now: Date = new Date()): string {
  return `mpcs-full-backup-${lkDateParts(now).dateStr}.zip`;
}

/** pg_cron එකට දාන SQL එක — Admin card එකේ copy කරගන්න පෙන්වනවා */
export function buildCronSql(siteUrl: string, cronSecret: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return [
    "-- MPCS Auto-Backup timer — විනාඩි 15කට වරක් site එක check කරයි.",
    "-- (ඇත්ත දවස/වෙලාව Admin → Backup & Restore එකෙන් තෝරනවා; මෙය එක වරක් run කළාම ඇති.)",
    "insert into storage.buckets (id, name, public)",
    "values ('backups', 'backups', false)",
    "on conflict (id) do nothing;",
    "",
    "create extension if not exists pg_net with schema extensions;",
    "create extension if not exists pg_cron;",
    "",
    "select cron.unschedule('weekly-site-backup')",
    "where exists (select 1 from cron.job where jobname = 'weekly-site-backup');",
    "select cron.unschedule('mpcs-auto-backup-check')",
    "where exists (select 1 from cron.job where jobname = 'mpcs-auto-backup-check');",
    "",
    "select cron.schedule(",
    "  'mpcs-auto-backup-check',",
    "  '*/15 * * * *',",
    "  $$",
    "  select net.http_post(",
    `    url     := '${base}/api/scheduled-backup',`,
    "    headers := jsonb_build_object(",
    "      'Content-Type', 'application/json',",
    `      'x-backup-secret', '${cronSecret}'`,
    "    ),",
    "    body    := '{}'::jsonb",
    "  );",
    "  $$",
    ");",
    "",
    "-- තහවුරු කරන්න: select jobname, schedule, active from cron.job;",
  ].join("\n");
}
