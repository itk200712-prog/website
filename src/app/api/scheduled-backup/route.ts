// ============================================================================
//  POST /api/scheduled-backup — නියමිත දවස්/වෙලාවට auto backup (server only)
//  · Supabase pg_cron එක විනාඩි 15කට වරක් මේ route එක කැඳවයි
//    (x-backup-secret header එක backup_secrets හි backup_cron_secret විය යුතුයි).
//  · දවස/වෙලාව Admin → Backup & Restore settings අනුවයි (ශ්‍රී ලංකා වේලාව).
//  · Backup = සියලු data tables වල SQL dump එක (gzip) → තෝරපු තැන්වලට:
//    Supabase private 'backups' bucket එක සහ/හෝ MEGA folder එක.
//  · රහස් (cron secret, MEGA email/password) backup_secrets එකේ — server එක
//    service-role key එකෙන් විතරක් කියවයි; browser එකට කිසිවක් එන්නේ නෑ.
//  ⚠ මෙය data-only backup එකකි (images/logins නෑ) — සම්පූර්ණ backup එකට
//    Admin එකෙන් ගන්න ZIP එකමයි ප්‍රධාන backup එක.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { gzipSync } from "node:zlib";
import { BACKUP_TABLES } from "@/lib/backup";
import {
  autoBackupFileName,
  backupDueDecision,
  lkDateParts,
  parseScheduleSettings,
  SCHEDULE_SECRET_KEYS,
  SCHEDULE_SETTING_KEYS,
  type BackupScheduleSettings,
} from "@/lib/scheduled-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

async function loadSecrets(): Promise<{ cronSecret: string; megaEmail: string; megaPassword: string }> {
  const keys = Object.values(SCHEDULE_SECRET_KEYS).join(",");
  const rows = (await restGet(`backup_secrets?select=key,value&key=in.(${keys})`, SERVICE_KEY)) as
    | { key: string; value: string }[]
    | null;
  const map = new Map((rows ?? []).map((r) => [r.key, r.value]));
  return {
    cronSecret: (map.get(SCHEDULE_SECRET_KEYS.cronSecret) ?? "").trim(),
    megaEmail: (map.get(SCHEDULE_SECRET_KEYS.megaEmail) ?? "").trim(),
    megaPassword: map.get(SCHEDULE_SECRET_KEYS.megaPassword) ?? "",
  };
}

/** අන්තිම සාර්ථක scheduled backup එකේ LK දිනය (backup_history එකෙන්) */
async function lastScheduledSuccessDate(): Promise<string | null> {
  const rows = (await restGet(
    "backup_history?select=created_at&action=eq.scheduled&status=in.(success,partial)&order=created_at.desc&limit=1",
    SERVICE_KEY
  )) as { created_at: string }[] | null;
  const iso = rows?.[0]?.created_at;
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : lkDateParts(d).dateStr;
}

// ── SQL dump ──
function sqlVal(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return `'${s.replace(/'/g, "''")}'`;
}
const col = (c: string) => `"${c.replace(/"/g, '""')}"`;

async function buildSqlDump(): Promise<{ sql: string; totalRows: number; tables: number; warnings: string[] }> {
  const tables = BACKUP_TABLES.filter((t) => t.name !== "site_images_backup");
  const lines: string[] = [
    "-- Panduwasnuwara New MPCS — SCHEDULED AUTO-BACKUP (data only)",
    `-- Generated: ${new Date().toISOString()}`,
    "-- Restore: FINAL SQL (schema) run කරලා මෙම file එක run කරන්න.",
    "-- (Images/logins සහිත සම්පූර්ණ backup එක Admin → Backup & Restore ZIP එකයි.)",
    "",
  ];
  const warnings: string[] = [];
  let totalRows = 0;

  for (const t of tables) {
    lines.push(`-- ${t.name}`);
    let tableRows = 0;
    for (let offset = 0; offset < 2_000_000; offset += 1000) {
      const rows = (await restGet(
        `${t.name}?select=*&order=${encodeURIComponent(t.pk)}.asc&limit=1000&offset=${offset}`,
        SERVICE_KEY
      )) as Record<string, unknown>[] | null;
      if (rows === null) {
        warnings.push(t.name);
        lines.push(`-- ⚠ ${t.name}: fetch failed`);
        break;
      }
      if (rows.length) {
        const cols = Object.keys(rows[0]);
        const sets = cols.filter((c) => c !== t.pk).map((c) => `${col(c)} = EXCLUDED.${col(c)}`).join(", ");
        const values = rows
          .map((r) => `(${cols.map((c) => sqlVal(r[c])).join(", ")})`)
          .join(",\n  ");
        lines.push(
          `INSERT INTO public.${t.name} (${cols.map(col).join(", ")}) VALUES\n  ${values}` +
            (sets ? `\nON CONFLICT (${col(t.pk)}) DO UPDATE SET ${sets};` : `\nON CONFLICT (${col(t.pk)}) DO NOTHING;`)
        );
        tableRows += rows.length;
      }
      if (rows.length < 1000) break;
    }
    totalRows += tableRows;
    lines.push("");
  }

  return { sql: lines.join("\n"), totalRows, tables: tables.length, warnings };
}

// ── Supabase Storage destination ──
async function uploadToSupabase(fileName: string, gz: Buffer, keep: number): Promise<void> {
  const path = `auto/${fileName}`;
  const res = await fetch(`${SUPA_BASE}/storage/v1/object/backups/${path}`, {
    method: "POST",
    headers: svcHeaders({ "Content-Type": "application/gzip", "x-upsert": "true" }),
    body: new Uint8Array(gz),
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
        .filter((n) => n.startsWith("database-") && (n.endsWith(".sql.gz") || n.endsWith(".sql")))
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
  gz: Buffer,
  keep: number
): Promise<void> {
  const mega = (await import("megajs")) as unknown as {
    Storage: new (opts: { email: string; password: string; keepalive?: boolean }) => MegaStorageLike;
  };
  const storage = await new mega.Storage({ email, password, keepalive: false }).ready;
  try {
    let folder = (storage.root.children ?? []).find((f) => f.directory && f.name === folderName);
    if (!folder) folder = await storage.mkdir(folderName);
    await folder.upload({ name: fileName, size: gz.length }, gz).complete;

    // අලුත්ම keep ගාණ තියාගෙන පරණ auto-backup මකයි
    const mine = (folder.children ?? [])
      .filter((f) => !f.directory && (f.name ?? "").startsWith("database-"))
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

async function recordHistory(input: {
  fileName: string;
  fileSize: number;
  tables: number;
  rows: number;
  status: string;
  detail: string;
}): Promise<void> {
  try {
    await fetch(`${SUPA_BASE}/rest/v1/backup_history`, {
      method: "POST",
      headers: svcHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify({
        action: "scheduled",
        actor_name: "Scheduled Auto-Backup",
        actor_role: "system",
        file_name: input.fileName,
        file_size: input.fileSize,
        encrypted: false,
        tables_count: input.tables,
        rows_count: input.rows,
        status: input.status,
        detail: input.detail,
      }),
      cache: "no-store",
    });
  } catch {
    /* history නැතත් backup එක හරි */
  }
}

/** GET — Admin card එකේ status එකට (රහස් කිසිවක් එවන්නේ නෑ) */
export async function GET() {
  if (!SERVICE_KEY) return json({ ok: true, serverConfigured: false, cronReady: false, megaConfigured: false });
  const [settings, secrets] = await Promise.all([loadSchedule(), loadSecrets()]);
  return json({
    ok: true,
    serverConfigured: true,
    cronReady: Boolean(secrets.cronSecret),
    megaConfigured: Boolean(secrets.megaEmail && secrets.megaPassword),
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
  const dump = await buildSqlDump();
  const gz = gzipSync(Buffer.from(dump.sql, "utf8"), { level: 6 });

  const done: string[] = [];
  const failed: string[] = [];
  if (settings.toSupabase) {
    try {
      await uploadToSupabase(fileName, gz, settings.keepCount);
      done.push("Supabase");
    } catch (e) {
      failed.push(`Supabase: ${(e as Error).message}`);
    }
  }
  if (settings.toMega) {
    if (secrets.megaEmail && secrets.megaPassword) {
      try {
        await uploadToMega(secrets.megaEmail, secrets.megaPassword, settings.megaFolder, fileName, gz, settings.keepCount);
        done.push("MEGA");
      } catch (e) {
        failed.push(`MEGA: ${(e as Error).message}`);
      }
    } else {
      failed.push("MEGA: email/password save කරලා නෑ");
    }
  }

  const status = done.length && !failed.length ? "success" : done.length ? "partial" : "failed";
  const detail = [
    force ? "Manual test run" : `Every ${settings.intervalDays} day(s) at ${settings.timeHHMM} (LK)`,
    done.length ? `Saved to: ${done.join(" + ")}` : "",
    failed.length ? `Failed: ${failed.join("; ")}` : "",
    dump.warnings.length ? `Table warnings: ${dump.warnings.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  await recordHistory({
    fileName,
    fileSize: gz.length,
    tables: dump.tables,
    rows: dump.totalRows,
    status,
    detail,
  });

  if (!done.length) return json({ ok: false, reason: "upload_failed", detail }, 500);
  return json({
    ok: true,
    file: fileName,
    size: gz.length,
    rows: dump.totalRows,
    tables: dump.tables,
    destinations: done,
    warnings: failed,
  });
}
