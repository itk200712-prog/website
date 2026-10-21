// ============================================================================
//  POST /api/scheduled-backup — නියමිත දවස්/වෙලාවට auto backup (server only)
//  · Supabase pg_cron එක විනාඩි 15කට වරක් මේ route එක කැඳවයි
//    (x-backup-secret header එක backup_secrets හි backup_cron_secret විය යුතුයි).
//  · දවස/වෙලාව Admin → Backup & Restore settings අනුවයි (ශ්‍රී ලංකා වේලාව).
//  · Backup = MANUAL backup එකට සම්පූර්ණයෙන්ම සමාන FULL ZIP එකමයි
//    (schema.sql + database.sql — logins/passwords + images base64 + tables 28ම
//    + Registers XLSX/CSV + manifest + RECOVERY). එකම generateBackupZip()
//    builder එක service-role client එකකින් දුවන නිසා කිසිවක් අඩු වෙන්නේ නෑ.
//  · ගමනාන්ත: Supabase private 'backups' bucket එක සහ/හෝ MEGA folder එක.
//  · රහස් (cron secret, MEGA email/password, encryption password) backup_secrets
//    එකේ — server එක service-role key එකෙන් විතරක් කියවයි; browser එකට එන්නේ නෑ.
//  · settings වල encrypt on නම් ZIP එක Encryption Password එකෙන් encrypt වෙනවා
//    (manual encrypted backup එක වගේම Admin Import එකෙන් restore කළ හැක).
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { generateBackupZip, type BackupClient } from "@/lib/backup";
import { BACKUP_HISTORY_KEEP, backupHistoryIdsToPrune } from "@/lib/backup-utils";
import {
  autoBackupFileName,
  backupDueDecision,
  lkDateParts,
  parseScheduleSettings,
  SCHEDULE_LAST_SUCCESS_KEY,
  SCHEDULE_SECRET_KEYS,
  SCHEDULE_SETTING_KEYS,
  type BackupScheduleSettings,
} from "@/lib/scheduled-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// FULL ZIP එක හදලා upload කරන්න විනාඩි කිහිපයක් යන්න පුළුවන් — 60s මදි (504 timeout වෙනවා)
export const maxDuration = 300;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const SUPA_BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

function svcHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, ...extra };
}

async function restGet(path: string, key: string): Promise<unknown[] | null> {
  if (!SUPA_BASE || !key) return null;
  try {
    const res = await fetch(`${SUPA_BASE}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

async function loadSchedule(): Promise<BackupScheduleSettings> {
  const keys = Object.values(SCHEDULE_SETTING_KEYS).join(",");
  const rows = (await restGet(
    `system_settings?select=key,value&key=in.(${keys})`,
    SERVICE_KEY || ANON_KEY
  )) as { key: string; value: string }[] | null;
  const map = new Map((rows ?? []).map((r) => [r.key, r.value]));
  return parseScheduleSettings((k) => map.get(k));
}

/** auto backup එක encrypt කරන password key එක — manual backup එකේ එකමයි */
const ENCRYPTION_SECRET_KEY = "backup_encryption_password";

async function loadSecrets(): Promise<{ cronSecret: string; megaEmail: string; megaPassword: string; encryptionPassword: string }> {
  const keys = [...Object.values(SCHEDULE_SECRET_KEYS), ENCRYPTION_SECRET_KEY].join(",");
  const rows = (await restGet(`backup_secrets?select=key,value&key=in.(${keys})`, SERVICE_KEY)) as
    | { key: string; value: string }[]
    | null;
  const map = new Map((rows ?? []).map((r) => [r.key, r.value]));
  return {
    cronSecret: (map.get(SCHEDULE_SECRET_KEYS.cronSecret) ?? "").trim(),
    megaEmail: (map.get(SCHEDULE_SECRET_KEYS.megaEmail) ?? "").trim(),
    megaPassword: map.get(SCHEDULE_SECRET_KEYS.megaPassword) ?? "",
    encryptionPassword: map.get(ENCRYPTION_SECRET_KEY) ?? "",
  };
}

/** අන්තිම සාර්ථක scheduled backup එකේ LK දිනය — history එක prune වුණත් hidden setting එකෙන් මතකයි. */
async function lastScheduledSuccessDate(): Promise<string | null> {
  const [historyRows, settingRows] = await Promise.all([
    restGet(
      "backup_history?select=created_at&action=eq.scheduled&status=in.(success,partial)&order=created_at.desc&limit=1",
      SERVICE_KEY
    ) as Promise<{ created_at: string }[] | null>,
    restGet(
      `system_settings?select=value&key=eq.${SCHEDULE_LAST_SUCCESS_KEY}&limit=1`,
      SERVICE_KEY || ANON_KEY
    ) as Promise<{ value: string }[] | null>,
  ]);

  const stored = settingRows?.[0]?.value?.trim() ?? "";
  const storedDate = /^\d{4}-\d{2}-\d{2}$/.test(stored) ? stored : null;
  const iso = historyRows?.[0]?.created_at;
  const historyDate = iso && !Number.isNaN(new Date(iso).getTime()) ? lkDateParts(new Date(iso)).dateStr : null;
  if (storedDate && historyDate) return storedDate > historyDate ? storedDate : historyDate;
  return storedDate ?? historyDate;
}

async function storeLastScheduledSuccessDate(dateStr: string): Promise<void> {
  try {
    await fetch(`${SUPA_BASE}/rest/v1/system_settings`, {
      method: "POST",
      headers: svcHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({ key: SCHEDULE_LAST_SUCCESS_KEY, value: dateStr }),
      cache: "no-store",
    });
  } catch {
    /* history එක තිබෙන නිසා backup එක නවත්වන්නේ නෑ */
  }
}

// ── FULL backup ZIP — manual Download එක හදන builder එකමයි (service-role) ──
// encryptPassword දීලා ඇත්නම් database.sql එක manual encrypted backup එක වගේම
// AES-GCM වලින් encrypt වෙනවා → Import එකේදී ඒ password එකම දීලා restore කළ හැක.
async function buildFullBackupZip(encryptPassword = ""): Promise<{ zip: Buffer; totalRows: number; tables: number; images: number }> {
  const sb = createClient(SUPA_BASE, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Node runtime එකේ realtime init එකට ws ඕනේ (අපි realtime පාවිච්චි කරන්නේ නෑ)
    realtime: { transport: ws as never },
  });
  let meta = { tableCounts: {} as Record<string, number>, imageCount: 0 };
  const blob = await generateBackupZip(() => {}, {
    client: sb as unknown as BackupClient,
    encryptPassword: encryptPassword || undefined,
    onMeta: (m) => {
      meta = m;
    },
  });
  const zip = Buffer.from(await blob.arrayBuffer());
  const totalRows = Object.values(meta.tableCounts).reduce((a, b) => a + b, 0);
  return { zip, totalRows, tables: Object.keys(meta.tableCounts).length, images: meta.imageCount };
}

// ── Supabase Storage destination ──
async function uploadToSupabase(fileName: string, zip: Buffer, keep: number): Promise<void> {
  const path = `auto/${fileName}`;
  const res = await fetch(`${SUPA_BASE}/storage/v1/object/backups/${path}`, {
    method: "POST",
    headers: svcHeaders({ "Content-Type": "application/zip", "x-upsert": "true" }),
    body: new Uint8Array(zip),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase storage upload failed (${res.status})`);

  // අලුත්ම keep ගාණ තියාගෙන පරණ ඒවා මකයි
  try {
    const listRes = await fetch(`${SUPA_BASE}/storage/v1/object/list/backups`, {
      method: "POST",
      headers: svcHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefix: "auto", limit: 100, sortBy: { column: "name", order: "desc" } }),
      cache: "no-store",
    });
    if (listRes.ok) {
      const files = (await listRes.json()) as { name: string }[];
      const stale = files
        .map((f) => f.name)
        .filter((n) => n.startsWith("mpcs-full-backup-") || n.startsWith("database-"))
        .slice(keep)
        .map((n) => `auto/${n}`);
      if (stale.length) {
        await fetch(`${SUPA_BASE}/storage/v1/object/backups`, {
          method: "DELETE",
          headers: svcHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ prefixes: stale }),
          cache: "no-store",
        });
      }
    }
  } catch {
    /* cleanup අසාර්ථක වුණත් backup එක හරි */
  }
}

// ── MEGA destination ──
type MegaFileLike = {
  name: string | null;
  directory: boolean;
  timestamp?: number;
  children?: MegaFileLike[];
  upload: (opts: { name: string; size: number }, source: Buffer) => { complete: Promise<MegaFileLike> };
  mkdir: (name: string) => Promise<MegaFileLike>;
  delete: (permanent?: boolean) => Promise<void>;
};
type MegaStorageLike = {
  ready: Promise<MegaStorageLike>;
  root: MegaFileLike;
  mkdir: (name: string) => Promise<MegaFileLike>;
  close: () => Promise<void>;
};

async function uploadToMega(
  email: string,
  password: string,
  folderName: string,
  fileName: string,
  zip: Buffer,
  keep: number
): Promise<void> {
  const mega = (await import("megajs")) as unknown as {
    Storage: new (opts: { email: string; password: string; keepalive?: boolean }) => MegaStorageLike;
  };
  const storage = await new mega.Storage({ email, password, keepalive: false }).ready;
  try {
    let folder = (storage.root.children ?? []).find((f) => f.directory && f.name === folderName);
    if (!folder) folder = await storage.mkdir(folderName);
    await folder.upload({ name: fileName, size: zip.length }, zip).complete;

    // අලුත්ම keep ගාණ තියාගෙන පරණ auto-backup මකයි
    const mine = (folder.children ?? [])
      .filter((f) => !f.directory && ((f.name ?? "").startsWith("mpcs-full-backup-") || (f.name ?? "").startsWith("database-")))
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0) || String(b.name).localeCompare(String(a.name)));
    for (const stale of mine.slice(keep)) {
      try {
        await stale.delete(true);
      } catch {
        /* එක file එකක් මකන්න බැරි වුණත් දිගටම යනවා */
      }
    }
  } finally {
    try {
      await storage.close();
    } catch {
      /* ignore */
    }
  }
}

async function pruneBackupHistory(): Promise<void> {
  try {
    const rows = (await restGet(
      "backup_history?select=id,created_at&order=created_at.desc,id.desc&limit=1000",
      SERVICE_KEY
    )) as { id: string; created_at: string }[] | null;
    const staleIds = backupHistoryIdsToPrune(rows ?? [], BACKUP_HISTORY_KEEP);
    if (staleIds.length === 0) return;
    await fetch(`${SUPA_BASE}/rest/v1/backup_history?id=in.(${staleIds.join(",")})`, {
      method: "DELETE",
      headers: svcHeaders({ Prefer: "return=minimal" }),
      cache: "no-store",
    });
  } catch {
    /* cleanup අසාර්ථක වුණත් backup එක හරි */
  }
}

async function recordHistory(input: {
  fileName: string;
  fileSize: number;
  tables: number;
  rows: number;
  status: string;
  detail: string;
  encrypted?: boolean;
}): Promise<void> {
  try {
    const res = await fetch(`${SUPA_BASE}/rest/v1/backup_history`, {
      method: "POST",
      headers: svcHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify({
        action: "scheduled",
        actor_name: "Scheduled Auto-Backup",
        actor_role: "system",
        file_name: input.fileName,
        file_size: input.fileSize,
        encrypted: !!input.encrypted,
        tables_count: input.tables,
        rows_count: input.rows,
        status: input.status,
        detail: input.detail,
      }),
      cache: "no-store",
    });
    if (res.ok) await pruneBackupHistory();
  } catch {
    /* history නැතත් backup එක හරි */
  }
}

/** GET — Admin card එකේ status එකට (රහස් කිසිවක් එවන්නේ නෑ) */
export async function GET() {
  if (!SERVICE_KEY) return json({ ok: true, serverConfigured: false, cronReady: false, megaConfigured: false, encryptionConfigured: false });
  const [settings, secrets] = await Promise.all([loadSchedule(), loadSecrets()]);
  return json({
    ok: true,
    serverConfigured: true,
    cronReady: Boolean(secrets.cronSecret),
    megaConfigured: Boolean(secrets.megaEmail && secrets.megaPassword),
    encryptionConfigured: Boolean(secrets.encryptionPassword),
    enabled: settings.enabled,
  });
}

export async function POST(req: NextRequest) {
  if (!SUPA_BASE || !SERVICE_KEY) return json({ ok: false, reason: "server_not_configured" }, 500);

  const secrets = await loadSecrets();
  const provided = (req.headers.get("x-backup-secret") ?? "").trim();
  if (!secrets.cronSecret || provided !== secrets.cronSecret) {
    return json({ ok: false, reason: "unauthorized" }, 401);
  }

  let force = false;
  try {
    const body = (await req.json()) as { force?: unknown } | null;
    force = body?.force === true;
  } catch {
    /* body නැති cron call එකක් වෙන්න පුළුවන් */
  }

  const settings = await loadSchedule();
  if (!force) {
    const last = await lastScheduledSuccessDate();
    const decision = backupDueDecision(settings, last);
    if (!decision.due) {
      return json({ ok: true, skipped: true, reason: decision.reason, nextDate: decision.nextDate });
    }
  } else if (!settings.toSupabase && !settings.toMega) {
    return json({ ok: false, reason: "no_destination" }, 400);
  }

  const fileName = autoBackupFileName();
  const startedAt = Date.now();
  // 🔒 settings වල encrypt on නම් manual එකේ Encryption Password එකම පාවිච්චි කරයි.
  // password එක save කරලා නැත්නම් backup එක නවත්වන්නේ නැතුව unencrypted යවනවා — history එකේ සටහන් වෙනවා.
  const encPw = settings.encrypt ? secrets.encryptionPassword : "";
  const encrypted = Boolean(encPw);
  const encryptWarning = settings.encrypt && !encPw ? "⚠ Encryption Password එක save කරලා නැති නිසා encrypt නොවී ගියා" : "";
  let built: Awaited<ReturnType<typeof buildFullBackupZip>>;
  try {
    built = await buildFullBackupZip(encPw);
  } catch (e) {
    const detail = `FULL ZIP build failed: ${(e as Error).message}`;
    await recordHistory({ fileName, fileSize: 0, tables: 0, rows: 0, status: "failed", detail, encrypted });
    return json({ ok: false, reason: "build_failed", detail }, 500);
  }

  // ගමනාන්ත දෙකම ඇත්නම් සමගාමීව upload කරයි (වේගය වැඩි වෙන්න)
  const done: string[] = [];
  const failed: string[] = [];
  const uploads: Promise<void>[] = [];
  if (settings.toSupabase) {
    uploads.push(
      uploadToSupabase(fileName, built.zip, settings.keepCount)
        .then(() => void done.push("Supabase"))
        .catch((e: Error) => void failed.push(`Supabase: ${e.message}`))
    );
  }
  if (settings.toMega) {
    if (secrets.megaEmail && secrets.megaPassword) {
      uploads.push(
        uploadToMega(secrets.megaEmail, secrets.megaPassword, settings.megaFolder, fileName, built.zip, settings.keepCount)
          .then(() => void done.push("MEGA"))
          .catch((e: Error) => void failed.push(`MEGA: ${e.message}`))
      );
    } else {
      failed.push("MEGA: email/password save කරලා නෑ");
    }
  }
  await Promise.all(uploads);

  const status = done.length && !failed.length ? "success" : done.length ? "partial" : "failed";
  const detail = [
    force ? "Manual test run" : `Every ${settings.intervalDays} day(s) at ${settings.timeHHMM} (LK)`,
    `FULL ZIP = manual backup (schema + logins + ${built.images} images + registers)`,
    encrypted ? "🔒 Encrypted (Encryption Password)" : "Not encrypted",
    encryptWarning,
    done.length ? `Saved to: ${done.join(" + ")}` : "",
    failed.length ? `Failed: ${failed.join("; ")}` : "",
    `Took ${Math.round((Date.now() - startedAt) / 1000)}s`,
  ]
    .filter(Boolean)
    .join(" · ");

  await recordHistory({
    fileName,
    fileSize: built.zip.length,
    tables: built.tables,
    rows: built.totalRows,
    status,
    detail,
    encrypted,
  });
  if (done.length) await storeLastScheduledSuccessDate(lkDateParts().dateStr);

  if (!done.length) return json({ ok: false, reason: "upload_failed", detail }, 500);
  return json({
    ok: true,
    file: fileName,
    size: built.zip.length,
    rows: built.totalRows,
    tables: built.tables,
    images: built.images,
    seconds: Math.round((Date.now() - startedAt) / 1000),
    encrypted,
    destinations: done,
    warnings: [encryptWarning, ...failed].filter(Boolean),
  });
}
