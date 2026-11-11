import { BACKUP_TIMER_SQL } from "@/lib/backup-timer-sql.generated";
// ============================================================================
//  Scheduled Auto-Backup — settings + due ගණනය (pure helpers)
// ----------------------------------------------------------------------------
//  🕛 නව ක්‍රමය: **දවසට පැය කීයකට වරක්ද** කියන එක විතරයි තෝරන්නේ.
//     පටන් ගැන්ම Save කළ වේලාවෙන් පසු ඊළඟ පැයේ මුල (LK).
//
//     උදා: පැය 4කට වරක්  →  00:00 · 04:00 · 08:00 · 12:00 · 16:00 · 20:00
//          පැය 6කට වරක්  →  00:00 · 06:00 · 12:00 · 18:00
//          පැය 12කට වරක් →  00:00 · 12:00
//          පැය 24කට වරක් →  00:00 (දවසකට එකයි)
//          පැය 1කට වරක්  →  පැයක් පාසා (00:00, 01:00, 02:00 …)
//
//  · Settings Save කරපු වේලාවෙන් පසු ඊළඟ LK පැයේ මුල baseline වේ.
//    Database timer එක Save/Repair මගින් install/repair කරයි (එක්වරක් SQL installer අවශ්‍යයි).
//  · Supabase pg_cron එක විනාඩි 15කට වරක් site එකේ /api/scheduled-backup
//    route එක කැඳවනවා. ඒ route එකෙන් "දැන් යා යුතු slot එක පහු වෙලාද?"
//    කියා මේ helpers වලින් තීරණය කරනවා (missed run එකක් තිබ්බත්
//    ඊළඟ check එකේදීම එක වරක් catch-up වෙනවා).
//  · Settings: system_settings (public) · රහස්: backup_secrets (superadmin-only)
// ============================================================================

export type BackupScheduleSettings = {
  enabled: boolean;
  /** **දවසට පැය කීයකට වරක්ද** (1–24) — හැමදාම රෑ 12:00 ට පටන් ගනී */
  intervalHours: number;
  /** settings save කරපු දිනය (LK, yyyy-mm-dd) — එදා රෑ 12:00 baseline එක */
  anchorDate: string;
  /** settings save කරපු **නියම වේලාව** (ISO) — මේකට පස්සේ එන පළවෙනි slot එකෙන් පටන් ගනී */
  savedAt: string;
  toSupabase: boolean;
  toMega: boolean;
  /** තබා ගන්නා අලුත්ම auto-backup ගාණ (2–350 · ඊට වඩා පරණ ඒවා මැකේ) */
  keepCount: number;
  megaFolder: string;
  /** true නම් auto backup එකත් backup_encryption_password එකෙන් encrypt වෙනවා */
  encrypt: boolean;
};

export const SCHEDULE_SETTING_KEYS = {
  enabled: "backup_schedule_enabled",
  /** 🕛 අලුත් key — දවසට පැය කීයකට වරක්ද */
  intervalHours: "backup_schedule_interval_hours",
  anchor: "backup_schedule_anchor",
  savedAt: "backup_schedule_saved_at",
  toSupabase: "backup_schedule_to_supabase",
  toMega: "backup_schedule_to_mega",
  keep: "backup_schedule_keep",
  megaFolder: "backup_schedule_mega_folder",
  encrypt: "backup_schedule_encrypt",
} as const;

/** පරණ (දවස් ගාණ) settings — migrate එකට විතරයි කියවන්නේ, තීරණයට පාවිච්චි නොකරයි */
export const LEGACY_SCHEDULE_KEYS = {
  intervalDays: "backup_schedule_interval_days",
  time: "backup_schedule_time",
} as const;

/** History එක prune වුණත් "අන්තිමට කවදා ගියාද" මතක තබන hidden setting එක (ISO වේලාව) */
export const SCHEDULE_LAST_SUCCESS_KEY = "backup_schedule_last_success_date";

/** තබා ගන්න පුළුවන් උපරිම auto-backup copies ගාණ */
export const MAX_KEEP_COPIES = 350;
export const MIN_KEEP_COPIES = 2;

/** තෝරන්න පුළුවන් පැය ගාණ — 24න් බෙදෙන ඒවා (හැමදාම එකම වෙලාවට slot වැටේ) */
export const SCHEDULE_HOUR_OPTIONS = [1, 2, 3, 4, 6, 8, 12, 24] as const;

export const SCHEDULE_SECRET_KEYS = {
  megaEmail: "mega_email",
  megaPassword: "mega_password",
  cronSecret: "backup_cron_secret",
} as const;

export const DEFAULT_SCHEDULE: BackupScheduleSettings = {
  enabled: false,
  intervalHours: 24,
  anchorDate: "",
  savedAt: "",
  toSupabase: true,
  toMega: false,
  keepCount: 8,
  megaFolder: "MPCS Backups",
  encrypt: true,
};

function onOff(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

/**
 * පැය ගාණ 1–24 අතරට ගේනවා. 24න් බෙදෙන්නේ නැති එකක් (උදා: 5) දුන්නොත්
 * ළඟම තියෙන valid එකට වට කරනවා (5 → 4) — එතකොට හැමදාම රෑ 12ට slot එක වැටේ.
 */
export function normalizeScheduleHours(value: unknown): number {
  const n = parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(n)) return DEFAULT_SCHEDULE.intervalHours;
  const clamped = Math.min(24, Math.max(1, n));
  if (24 % clamped === 0) return clamped;
  let best = DEFAULT_SCHEDULE.intervalHours;
  let bestDiff = Infinity;
  for (const opt of SCHEDULE_HOUR_OPTIONS) {
    const diff = Math.abs(opt - clamped);
    if (diff < bestDiff) {
      best = opt;
      bestDiff = diff;
    }
  }
  return best;
}

/** දවසට පැය කීයකට වරක්ද → ඒ දවසේ slot වේලාවන් (උදා: 4 → ["00:00","04:00",…,"20:00"]) */
export function scheduleTimesOfDay(intervalHours: number): string[] {
  const h = normalizeScheduleHours(intervalHours);
  const out: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += h * 60) {
    out.push(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
  }
  return out;
}

export function parseScheduleSettings(get: (key: string) => string | undefined): BackupScheduleSettings {
  // පරණ "දවස්" setting එකක් විතරක් තිබ්බොත් (අලුත් key එක නෑ) → එයාට සමාන පැය ගාණකට migrate
  const rawHours = get(SCHEDULE_SETTING_KEYS.intervalHours);
  let hours = normalizeScheduleHours(rawHours);
  if (rawHours == null || rawHours === "") {
    const legacyDays = parseInt(get(LEGACY_SCHEDULE_KEYS.intervalDays) ?? "", 10);
    hours = Number.isFinite(legacyDays) ? Math.min(24, Math.max(1, legacyDays * 24)) : DEFAULT_SCHEDULE.intervalHours;
  }
  const keep = parseInt(get(SCHEDULE_SETTING_KEYS.keep) ?? "", 10);
  return {
    enabled: onOff(get(SCHEDULE_SETTING_KEYS.enabled), false),
    intervalHours: hours,
    anchorDate: (get(SCHEDULE_SETTING_KEYS.anchor) ?? "").trim(),
    savedAt: (get(SCHEDULE_SETTING_KEYS.savedAt) ?? "").trim(),
    toSupabase: onOff(get(SCHEDULE_SETTING_KEYS.toSupabase), true),
    toMega: onOff(get(SCHEDULE_SETTING_KEYS.toMega), false),
    keepCount: Number.isFinite(keep)
      ? Math.min(MAX_KEEP_COPIES, Math.max(MIN_KEEP_COPIES, keep))
      : DEFAULT_SCHEDULE.keepCount,
    megaFolder: (get(SCHEDULE_SETTING_KEYS.megaFolder) ?? "").trim() || DEFAULT_SCHEDULE.megaFolder,
    encrypt: onOff(get(SCHEDULE_SETTING_KEYS.encrypt), true),
  };
}

/** settings object එක system_settings rows බවට (Admin save එකට) */
export function scheduleSettingsRows(s: BackupScheduleSettings): { key: string; value: string }[] {
  return [
    { key: SCHEDULE_SETTING_KEYS.enabled, value: s.enabled ? "1" : "0" },
    { key: SCHEDULE_SETTING_KEYS.intervalHours, value: String(normalizeScheduleHours(s.intervalHours)) },
    { key: SCHEDULE_SETTING_KEYS.anchor, value: s.anchorDate },
    { key: SCHEDULE_SETTING_KEYS.savedAt, value: s.savedAt },
    { key: SCHEDULE_SETTING_KEYS.toSupabase, value: s.toSupabase ? "1" : "0" },
    { key: SCHEDULE_SETTING_KEYS.toMega, value: s.toMega ? "1" : "0" },
    { key: SCHEDULE_SETTING_KEYS.keep, value: String(s.keepCount) },
    { key: SCHEDULE_SETTING_KEYS.megaFolder, value: s.megaFolder },
    { key: SCHEDULE_SETTING_KEYS.encrypt, value: s.encrypt ? "1" : "0" },
  ];
}

// ── ශ්‍රී ලංකා (UTC+5:30) දිනය/වේලාව ──
const LK_OFFSET_MIN = 330;
const HOUR_MS = 3_600_000;

export function lkDateParts(now: Date = new Date()): { dateStr: string; minutes: number } {
  const lk = new Date(now.getTime() + LK_OFFSET_MIN * 60_000);
  const y = lk.getUTCFullYear();
  const m = String(lk.getUTCMonth() + 1).padStart(2, "0");
  const d = String(lk.getUTCDate()).padStart(2, "0");
  return { dateStr: `${y}-${m}-${d}`, minutes: lk.getUTCHours() * 60 + lk.getUTCMinutes() };
}

/** LK දිනයක **රෑ 12:00** (UTC ms) — baseline එක */
export function lkMidnightMs(dateStr: string): number | null {
  const t = Date.parse(`${dateStr}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  return t - LK_OFFSET_MIN * 60_000; // LK 00:00 = UTC 18:30 (පෙර දවස)
}

/** LK වේලාවෙන් "yyyy-mm-dd HH:MM" (Admin එකේ පෙන්වීමට) */
export function formatLk(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  const lk = new Date(ms + LK_OFFSET_MIN * 60_000);
  const y = lk.getUTCFullYear();
  const m = String(lk.getUTCMonth() + 1).padStart(2, "0");
  const d = String(lk.getUTCDate()).padStart(2, "0");
  const hh = String(lk.getUTCHours()).padStart(2, "0");
  const mm = String(lk.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

export type ScheduleSlot = {
  /** මීට කලින් වැටුණු slot (දැන් යා යුතු slot එක) */
  lastSlotMs: number | null;
  /** ඊළඟට යා යුතු slot */
  nextSlotMs: number | null;
  /** baseline: first LK hour after Save */
  anchorMs: number | null;
  /** settings save කරපු වේලාව — මේකට කලින් slots යන්නේ නෑ */
  cutoffMs: number;
};

/**
 * 🕐 LK වේලාවෙන් **ඊළඟ පැයේ මුල** (HH:00:00) — හරියටම පැය මායිමේ නම් ඊට පැයක් පස්සේ.
 *
 * මේකයි auto-backup එකේ “anchor” එක: settings Save කරපු වේලාවෙන් ඊළඟ පැයේ මුල.
 * උදා: රාත්‍රී 21:10ට Save → 22:00:00 (LK). ඊට පස්සේ හැම `intervalHours` පාසාම.
 *
 * (කලින් anchor එක හැමදාම **රෑ 12:00** වුණා — ඒ නිසා රෑ 10ට save කළත් backup එක
 *  පහුවදා රෑ 12ට තමයි දුවන්නේ; ඒකයි “වැරදි වේලාවක පටන් ගත්තා” කියලා පෙනුණේ.)
 */
function nextLkHourStartMs(ms: number): number {
  const lk = ms + LK_OFFSET_MIN * 60_000;
  const nextHour = Math.floor(lk / HOUR_MS) * HOUR_MS + HOUR_MS;
  return nextHour - LK_OFFSET_MIN * 60_000;
}

/**
 * 🕐 Save කරපු වේලාවේ ඉඳන් ඊළඟ පැයේ මුල පටන්, `intervalHours` පාසා වැටෙන slots.
 * · lastSlotMs = දැන් වේලාවට පෙර වැටුණු ළඟම slot (ඒක තාම කරලා නැත්නම් backup එක අදාළයි)
 * · nextSlotMs = ඊළඟට යා යුතු slot
 *
 * ⚠ Anchor එක දැන් **save-time** (ඊළඟ පැය) — රෑ 12 නොවේ. `savedAt` නැති පරණ
 *   settings වලට දැන් වේලාවම ගනී (එතකොට පරණ slot එකක් ඉබේම දිව යන්නේ නෑ).
 */
export function scheduleSlots(s: BackupScheduleSettings, now: Date = new Date()): ScheduleSlot {
  const step = normalizeScheduleHours(s.intervalHours) * HOUR_MS;
  const nowMs = now.getTime();
  const savedMs = s.savedAt ? Date.parse(s.savedAt) : NaN;
  const validSaved = Number.isFinite(savedMs) && savedMs > 0;
  const cutoffMs = validSaved ? savedMs : nowMs;
  const anchorMs = nextLkHourStartMs(cutoffMs); // ⏰ ඊළඟ පැයේ මුල
  const firstMs = anchorMs;

  if (nowMs < firstMs) {
    return { lastSlotMs: null, nextSlotMs: firstMs, anchorMs, cutoffMs };
  }
  const steps = Math.floor((nowMs - firstMs) / step);
  const lastSlotMs = firstMs + steps * step;
  return { lastSlotMs, nextSlotMs: lastSlotMs + step, anchorMs, cutoffMs };
}

export type ScheduleDecision = {
  due: boolean;
  reason: string;
  /** යා යුතු slot එකේ වේලාව (ISO) */
  slotAt: string | null;
  /** ඊළඟ slot එක (ISO) — Admin එකේ පෙන්වීමට */
  nextAt: string | null;
};

/**
 * දැන් backup එකක් ගත යුතුද?
 * lastSuccessAt = අන්තිම සාර්ථක scheduled backup එකේ **ISO වේලාව** (null = කවදාවත් නෑ).
 */
export function backupDueDecision(
  s: BackupScheduleSettings,
  lastSuccessAt: string | null,
  now: Date = new Date()
): ScheduleDecision {
  const { lastSlotMs, nextSlotMs } = scheduleSlots(s, now);
  const slotAt = lastSlotMs != null ? new Date(lastSlotMs).toISOString() : null;
  const nextAt = nextSlotMs != null ? new Date(nextSlotMs).toISOString() : null;

  if (!s.enabled) return { due: false, reason: "disabled", slotAt, nextAt };
  if (!s.toSupabase && !s.toMega) return { due: false, reason: "no_destination", slotAt, nextAt };
  if (lastSlotMs == null) return { due: false, reason: "not_started", slotAt, nextAt };

  const lastMs = lastSuccessAt ? Date.parse(lastSuccessAt) : NaN;
  if (Number.isFinite(lastMs) && lastMs >= lastSlotMs) {
    return { due: false, reason: "already_done", slotAt, nextAt };
  }
  return { due: true, reason: "due", slotAt, nextAt };
}

/** ඊළඟ auto-backup වේලාව — LK වේලාවෙන් "yyyy-mm-dd HH:MM" (Admin එකේ පෙන්වීමට) */
export function nextRunLabel(s: BackupScheduleSettings, now: Date = new Date()): string {
  const { lastSlotMs, nextSlotMs } = scheduleSlots(s, now);
  if (lastSlotMs == null) return nextSlotMs != null ? formatLk(nextSlotMs) : "—";
  return formatLk(nextSlotMs ?? lastSlotMs);
}

/** 🕐 ඉදිරියේ යන වේලාවන් (LK "HH:MM") — Admin card එකේ පෙන්වීමට */
export function upcomingRunTimes(s: BackupScheduleSettings, now: Date = new Date(), count = 6): string[] {
  const { nextSlotMs } = scheduleSlots(s, now);
  if (nextSlotMs == null) return [];
  const step = normalizeScheduleHours(s.intervalHours) * HOUR_MS;
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = new Date(nextSlotMs + i * step);
    const lk = new Date(t.getTime() + LK_OFFSET_MIN * 60_000);
    out.push(`${String(lk.getUTCHours()).padStart(2, "0")}:${String(lk.getUTCMinutes()).padStart(2, "0")}`);
  }
  return out;
}

/**
 * Auto backup file එකේ නම — `mpcs-full-backup-2026-11-07_0400.zip`
 *
 * ⚠ දවසට කිහිප වරක් (පැය කීයකට වරක්) යන නිසා **වේලාවත්** නමට එකතු වේ.
 *   නැත්නම් එකම දවසේ backups එකිනෙක **overwrite** වෙලා (එකම නම නිසා)
 *   copies 350ක් තියාගන්න බැරි වෙනවා. (අන්තර්ගතය තාම manual ZIP එකමයි.)
 */
export function autoBackupFileName(now: Date = new Date()): string {
  const { dateStr } = lkDateParts(now);
  const lk = new Date(now.getTime() + LK_OFFSET_MIN * 60_000);
  const hh = String(lk.getUTCHours()).padStart(2, "0");
  const mm = String(lk.getUTCMinutes()).padStart(2, "0");
  return `mpcs-full-backup-${dateStr}_${hh}${mm}.zip`;
}

/** Secret-free single installer; the database reads the CURRENT private secret on each tick. */
export function buildCronSql(_siteUrl: string, _cronSecret: string): string {
  return BACKUP_TIMER_SQL;
}
