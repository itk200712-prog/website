// ============================================================================
//  📧 AUTO BACKUP REPORT — සාර්ථක / අසාර්ථක වාර්තා email
// ----------------------------------------------------------------------------
//  ඉබේම දුවන හැම auto-backup එකකටම පස්සේ (සාර්ථක වුණත්, fail වුණත්) මේ
//  විස්තර සහිත email එක Admin → Emails → “Auto Backup Reports” ලිපින වලට යයි:
//    · File name      — උදා: mpcs-full-backup-2026-11-07_1600.zip
//    · File type      — ZIP (Full backup: database.sql + schema.sql + site files)
//    · File size      — 1.8 MB (1,884,417 bytes)
//    · Status         — ✅ සාර්ථක (success) / ⚠️ කොටසක් (partial) / ❌ අසාර්ථක (failed)
//    · Time spent     — 2 මිනිත්තු 14 තත්පර (134s)
//    · Date & day     — 2026-11-07 · සෙනසුරාදා (Saturday) · 16:02 (ශ්‍රී ලංකා)
//
//  ⚠ මේ module එක server (API route) එකේත්, client එකේත් දෙකේම වැඩ කරයි —
//    React/"use client" මත රඳා නොපවතී (pure TS + fetch).
// ============================================================================

export type BackupReportStatus = "success" | "partial" | "failed";

export type BackupReportInput = {
  status: BackupReportStatus;
  /** මේ වාර්තාව දුවපු තැන — "auto" (cron) හෝ "manual" */
  source?: "auto" | "manual";
  fileName: string;
  /** ZIP එකේ ඇතුළත — විස්තරාත්මකව */
  fileType?: string;
  /** bytes */
  fileSize: number;
  /** milliseconds */
  durationMs: number;
  /** ගිණුම් වලට ගිය තැන් (Supabase / MEGA …) */
  destinations?: string[];
  /** fail වුණු දේ */
  failures?: string[];
  rows?: number;
  tables?: number;
  images?: number;
  encrypted?: boolean;
  /** email එක යවන මොහොත (default: දැන්) */
  at?: Date;
  /** header එකේ පෙන්වන schedule විස්තරය (උදා: "Every 4h from 00:00 (LK)") */
  schedule?: string;
};

/* ------------------------------------------------------------- helpers --- */
const SI_WEEKDAYS = ["ඉරිදා", "සඳුදා", "අඟහරුවාදා", "බදාදා", "බ්‍රහස්පතින්දා", "සිකුරාදා", "සෙනසුරාදා"];
const EN_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SI_MONTHS = [
  "ජනවාරි", "පෙබරවාරි", "මාර්තු", "අප්‍රේල්", "මැයි", "ජූනි",
  "ජූලි", "අගෝස්තු", "සැප්තැම්බර්", "ඔක්තෝබර්", "නොවැම්බර්", "දෙසැම්බර්",
];

/** 1,884,417 → "1.80 MB (1,884,417 bytes)" */
export function formatFileSize(bytes: number): string {
  const n = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const rounded = i === 0 ? String(Math.round(v)) : v.toFixed(2);
  return `${rounded} ${units[i]} (${n.toLocaleString("en-US")} bytes)`;
}

/** 134000 → "2 මිනිත්තු 14 තත්පර (134s)" */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round((Number.isFinite(ms) ? ms : 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const si = h > 0
    ? `${h} පැය ${mm} මිනිත්තු ${s} තත්පර`
    : m > 0
      ? `${m} මිනිත්තු ${s} තත්පර`
      : `${s} තත්පර`;
  return `${si} (${total}s)`;
}

/** ශ්‍රී ලංකා වේලාවෙන් දිනය / දවස / වේලාව */
export function lkDateParts(d: Date = new Date()): {
  iso: string;
  date: string;
  weekdaySi: string;
  weekdayEn: string;
  time: string;
  label: string;
  dayOfYear: number;
} {
  // LK = UTC+5:30 (offset වෙනස් වෙන්නේ නෑ — DST නෑ)
  const lk = new Date(d.getTime() + (5 * 60 + 30) * 60_000);
  const y = lk.getUTCFullYear();
  const mo = lk.getUTCMonth();
  const day = lk.getUTCDate();
  const hh = String(lk.getUTCHours()).padStart(2, "0");
  const mi = String(lk.getUTCMinutes()).padStart(2, "0");
  const iso = `${y}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const weekdaySi = SI_WEEKDAYS[lk.getUTCDay()];
  const weekdayEn = EN_WEEKDAYS[lk.getUTCDay()];
  const start = Date.UTC(y, 0, 1);
  const dayOfYear = Math.floor((Date.UTC(y, mo, day) - start) / 86_400_000) + 1;
  return {
    iso,
    date: `${y} ${SI_MONTHS[mo]} ${String(day).padStart(2, "0")}`,
    weekdaySi,
    weekdayEn,
    time: `${hh}:${mi}`,
    label: `${iso} · ${weekdaySi} (${weekdayEn}) · ${hh}:${mi} (ශ්‍රී ලංකා)`,
    dayOfYear,
  };
}

const STATUS_META: Record<BackupReportStatus, { emoji: string; si: string; en: string }> = {
  success: { emoji: "✅", si: "සාර්ථක", en: "successful" },
  partial: { emoji: "⚠️", si: "කොටසක් සාර්ථක", en: "partial" },
  failed: { emoji: "❌", si: "අසාර්ථක", en: "failed" },
};

/**
 * යවන email එකේ subject + body එක හදයි.
 * (FormSubmit එකට plain text විදිහට යවයි — Sinhala අකුරු හැම email client එකකම පේනවා.)
 */
export function buildBackupReportEmail(input: BackupReportInput): {
  subject: string;
  body: string;
  fields: Record<string, string>;
} {
  const meta = STATUS_META[input.status] ?? STATUS_META.failed;
  const when = lkDateParts(input.at ?? new Date());
  const fileType = input.fileType || "ZIP — Full backup (database.sql + schema.sql + registers + site files)";
  const title = input.source === "manual" ? "Manual Backup" : "Auto Backup";

  const subject = `${meta.emoji} MPCS ${title} ${meta.si} — ${input.fileName}`;

  const lines = [
    `🤖 Panduwasnuwara MPCS — ${input.source === "manual" ? "Manual" : "Scheduled Auto"}-Backup වාර්තාව`,
    `🤖 ${title} report`,
    "",
    "──────────── විස්තර ────────────",
    `📦 File name   : ${input.fileName}`,
    `🗂 File type   : ${fileType}`,
    `📏 File size   : ${formatFileSize(input.fileSize)}`,
    `📊 Status      : ${meta.emoji} ${meta.si} (${meta.en})`,
    `⏱ Time spent  : ${formatDuration(input.durationMs)}`,
    `📅 Date & day  : ${when.label}`,
    `🗓 දිනය        : ${when.date} — ${when.weekdaySi} (වසරේ ${when.dayOfYear}වන දවස)`,
  ];
  if (input.schedule) lines.push(`🔁 Schedule    : ${input.schedule}`);
  if (typeof input.rows === "number" || typeof input.tables === "number") {
    lines.push(
      `🗃 Contents    : ${input.tables ?? 0} tables · ${(input.rows ?? 0).toLocaleString("en-US")} rows` +
        (typeof input.images === "number" ? ` · ${input.images} images` : "")
    );
  }
  lines.push(`🔒 Encrypted   : ${input.encrypted ? "ඔව් (Encryption Password)" : "නෑ"}`);
  if (input.destinations?.length) lines.push(`💾 Saved to    : ${input.destinations.join(" + ")}`);
  if (input.failures?.length) {
    lines.push("");
    lines.push("──────────── ⚠ අසාර්ථක කොටස් ────────────");
    for (const f of input.failures) lines.push(`• ${f}`);
    lines.push("");
    lines.push("➡️ Admin → Backup & Restore එකෙන් අතින් Download එකක් ගන්න හෝ ලිපින/රහස් පරීක්ෂා කරන්න.");
  }
  if (input.status === "success") {
    lines.push("");
    lines.push("➡️ Backup එක සම්පූර්ණයෙන්ම සාර්ථකයි — කිසිවක් කරන්න ඕන නෑ. 👍");
  }
  lines.push("");
  lines.push("────────────");
  lines.push("Panduwasnuwara New MPCS LTD · Admin → Backup & Restore");
  lines.push("මේ email එක ඉබේම යැවුණේ auto-backup schedule එකෙන්.");

  const body = lines.join("\n");
  // FormSubmit fields (subject line එකද අතින් තබයි)
  const fields: Record<string, string> = {
    _subject: subject,
    _template: "table",
    "Report": title,
    "File name": input.fileName,
    "File type": fileType,
    "File size": formatFileSize(input.fileSize),
    "Status": `${meta.emoji} ${meta.si} / ${meta.en}`,
    "Time spent": formatDuration(input.durationMs),
    "Date": when.iso,
    "Day": `${when.weekdaySi} (${when.weekdayEn})`,
    "Time (LK)": when.time,
    "Tables": String(input.tables ?? ""),
    "Rows": String(input.rows ?? ""),
    "Images": String(input.images ?? ""),
    "Encrypted": input.encrypted ? "yes" : "no",
    "Saved to": (input.destinations ?? []).join(" + "),
    "Failures": (input.failures ?? []).join(" | "),
    "Message": body,
  };
  return { subject, body, fields };
}

/**
 * FormSubmit (AJAX) හරහා ලිපිනයකට email එක යවයි.
 * FormSubmit එක HTTP 200 දුන්නත් confirm නොකළ ලිපිනයකට success:"false" එයි —
 * ඒ නිසා JSON එකේ success එකත් බලයි.
 */
export async function postFormSubmit(to: string, payload: Record<string, unknown>): Promise<boolean> {
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to.trim())) return false;
  // 🔁 FormSubmit එක වහාම fail වුණොත් (522/timeout) තව එක වරක් උත්සාහ කරයි
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to.trim())}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      let sent = res.ok;
      try {
        const j = (await res.json()) as { success?: boolean | string } | null;
        if (j && typeof j.success !== "undefined") sent = res.ok && (j.success === true || j.success === "true");
      } catch {
        /* JSON නෙවෙයි නම් HTTP status එකම ඇති */
      }
      if (sent) return true;
    } catch {
      /* ඊළඟ උත්සාහයට යයි */
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 1200));
  }
  return false;
}

/**

 * හැම ලිපිනයකටම වාර්තාව යවයි — @returns යැවූ ගණන
 * @param sender optional — server එකේදී SMTP දෙන්න (`(to, subject, text) => Promise<number>`).
 *               නොදුන්නොත් කලින් විදිහටම FormSubmit.
 */
export async function sendBackupReport(
  input: BackupReportInput,
  emails: string[],
  sender?: (to: string[], subject: string, text: string) => Promise<number>
): Promise<number> {
  const { fields, subject, body } = buildBackupReportEmail(input);
  const list = Array.from(new Set((emails ?? []).map((e) => e.trim()).filter(Boolean)));
  if (!list.length) return 0;
  if (sender) return await sender(list, subject, body);
  let ok = 0;
  await Promise.all(
    list.map(async (to) => {
      if (await postFormSubmit(to, fields)) ok += 1;
    })
  );
  return ok;
}
