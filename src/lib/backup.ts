// ============================================================================
// Backup & Restore engine — full-site SQL dump / restore (superadmin only UI)
// Dump  = DDL + LOGIN accounts (auth.users+passwords) + INSERTs (all tables, all rows)
//         + site-images base64 (site_images_backup) · ZIP එකට schema.sql එකත් ඇතුළත්
// Restore = wipe + re-insert + storage re-upload + URL rewrite (project මාරු වුණත්)
// ============================================================================

import { authedClient } from "@/lib/supabase/client";
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_HISTORY_KEEP,
  backupHistoryIdsToPrune,
  buildManifest,
  buildRecoveryChecklist,
  dedupeTableRows,
  encryptBackupText,
  sha256Hex,
  type ParsedInsert,
} from "@/lib/backup-utils";

import { orderBackupRows } from "@/lib/backup-row-order";
import { SCHEMA_BACKUP_TABLES, SCHEMA_SELF_REFERENCES } from "@/lib/backup-catalog.generated";
import { MEDIA_INDEX_PATH, safeMediaPath, scanMediaReferences, mediaArchivePath, rewriteMediaValue, listStoragePaths, type MediaRef } from "@/lib/backup-media";

export { parseBackupSql } from "@/lib/backup-utils";
export type { ParsedInsert };

export type BackupTable = { name: string; pk: string };

/**
 * Backup හදන client එක — browser එකේදී authedClient (superadmin session),
 * server එකේදී (scheduled auto-backup) service-role client එකක් inject කරයි.
 * දෙකම එකම builder එක පාවිච්චි කරන නිසා auto backup එක manual එකට සමානමයි.
 */
export type BackupClient = Awaited<ReturnType<typeof authedClient>>;

// Build-time canonical catalog includes future tables and FK-safe ordering.
export const BACKUP_TABLES: BackupTable[] = SCHEMA_BACKUP_TABLES.map((table) => ({ ...table }));

function decodeDisplayPw(enc: string): string {
  try {
    return decodeURIComponent(escape(atob(enc)));
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------- SQL esc --- */
function sqlVal(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return `'${s.replace(/'/g, "''")}'`;
}

function colName(c: string) {
  return `"${c.replace(/"/g, '""')}"`;
}

/* ------------------------------------------------- OpenAPI -> DDL map ---- */
type ColType = { name: string; type: string; pk: boolean };
const TYPE_MAP: Record<string, string> = {
  integer: "bigint", int: "bigint", int4: "integer", int8: "bigint",
  number: "numeric", numeric: "numeric", real: "real", double: "double precision",
  boolean: "boolean", bool: "boolean",
  "timestamp with time zone": "timestamptz", timestamptz: "timestamptz",
  timestamp: "timestamp", date: "date",
  uuid: "uuid", json: "jsonb", jsonb: "jsonb", ARRAY: "text[]",
};

async function fetchSchemaCols(tables: BackupTable[]): Promise<Record<string, ColType[]>> {
  const out: Record<string, ColType[]> = {};
  try {
    const res = await fetch(`${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}/rest/v1/`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", Accept: "application/openapi+json" },
    });
    const spec = await res.json();
    const defs = spec?.definitions ?? spec?.components?.schemas ?? {};
    for (const t of tables) {
      const d = defs[t.name];
      if (!d?.properties) continue;
      out[t.name] = Object.entries(d.properties as Record<string, { type?: string; format?: string }>).map(
        ([name, p]) => ({
          name,
          type: TYPE_MAP[p.format ?? ""] ?? (p.type === "array" ? "text[]" : TYPE_MAP[p.type ?? ""] ?? "text"),
          pk: name === t.pk,
        })
      );
    }
  } catch { /* fallback below */ }
  return out;
}

// anon role ට access නැති tables OpenAPI spec එකේ පේන්නේ නෑ → හරි DDL එක මෙතන
const DDL_OVERRIDE: Record<string, string> = {
  chat_sessions: `create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  session_key text unique not null,
  visitor_name text default '',
  visitor_phone text default '',
  status text not null default 'open',
  agent_id uuid,
  agent_name text default '',
  last_message text default '',
  last_at timestamptz default now(),
  unread_admin int not null default 0,
  unread_visitor int not null default 0,
  visitor_typing_at timestamptz,
  agent_typing_at timestamptz,
  page text default '',
  created_at timestamptz default now()
);`,
  chat_messages: `create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_key text not null,
  sender text not null default 'visitor',
  sender_name text default '',
  body text not null default '',
  seen boolean not null default false,
  created_at timestamptz default now()
);`,
  live_chat_events: `create table if not exists public.live_chat_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null default 'open',
  query text default '',
  matched int default 0,
  session_id text default '',
  created_at timestamptz default now()
);`,
  backup_history: `create table if not exists public.backup_history (
  id uuid primary key default gen_random_uuid(),
  action text not null default 'download',
  actor_id uuid,
  actor_name text default '',
  actor_email text default '',
  actor_role text default '',
  file_name text default '',
  file_size bigint,
  encrypted boolean not null default false,
  tables_count int,
  rows_count bigint,
  status text not null default 'success',
  detail text default '',
  created_at timestamptz default now()
);`,
  notify_emails: `create table if not exists public.notify_emails (
  id uuid primary key default gen_random_uuid(),
  label text not null default '',
  email text not null,
  active boolean not null default true,
  verification text not null default 'pending',
  verified_at timestamptz,
  created_at timestamptz default now()
);`,
};

function ddlFor(t: BackupTable, cols: ColType[]): string {
  if (!cols.length)
    return `create table if not exists public.${t.name} (${colName(t.pk)} text primary key, data jsonb default '{}'::jsonb);`;
  const parts = cols.map((c) => {
    let d = `${colName(c.name)} ${c.type}`;
    if (c.pk) d += t.pk === "id" ? " primary key default gen_random_uuid()" : " primary key";
    return d;
  });
  return `create table if not exists public.${t.name} (\n  ${parts.join(",\n  ")}\n);`;
}

/* --------------------------------------------------------- image scan ---- */
/** Public/signed/authenticated URLs, relative storage URLs and nested/stringified JSON. */
export function scanImagePathsInRows(tables: { name: string; rows: Record<string, unknown>[] }[]): string[] {
  return [...new Set(scanMediaReferences(tables).filter((r) => r.bucket === "site-images").map((r) => r.key!))];
}

async function listAllStorageFiles(client?: BackupClient): Promise<string[]> {
  const sb = client ?? await authedClient();
  return listStoragePaths(async (prefix, offset) => {
    const { data, error } = await sb.storage.from("site-images").list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`Storage listing failed (${prefix || "/"}): ${error.message}`);
    if (!data) throw new Error("Storage listing returned no result");
    return data;
  });
}

export type BackupMediaReader = (url: string) => Promise<{ b64: string; type: string }>;
async function readExternalBackupMedia(url: string, reader?: BackupMediaReader, assetBaseUrl?: string, cronSecret?: string): Promise<{ b64: string; type: string }> {
  if (reader) return reader(url);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cronSecret) headers["x-backup-secret"] = cronSecret;
  else {
    const sb = await authedClient();
    const { data } = await sb.auth.getSession();
    if (!data.session?.access_token) throw new Error("Backup media requires a superadmin session");
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  let bytes: Uint8Array | undefined;
  let offset = 0, expectedHash = "", type = "";
  do {
    const res = await fetch(`${resolveAssetBaseUrl(assetBaseUrl)}/api/backup/media`, { method: "POST", headers, body: JSON.stringify({ url, offset }), cache: "no-store" });
    const part = await res.json() as { error?: string; b64: string; total: number; type: string; sha256: string };
    if (!res.ok || part.error) throw new Error(part.error || `Media proxy HTTP ${res.status}`);
    if (!Number.isSafeInteger(part.total) || part.total < 0 || part.total > 32 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(part.sha256)) throw new Error("Invalid media proxy response");
    if (!bytes) { bytes = new Uint8Array(part.total); expectedHash = part.sha256; type = part.type; }
    if (part.sha256 !== expectedHash || part.total !== bytes.length) throw new Error("Remote media changed during backup; retry");
    const chunk = b64ToBytes(part.b64);
    if ((!chunk.length && part.total !== 0) || offset + chunk.length > bytes.length) throw new Error("Invalid media chunk");
    bytes.set(chunk, offset);
    offset += chunk.length;
  } while (offset < bytes.length);
  if (await sha256Hex(bytes) !== expectedHash) throw new Error("Remote media integrity check failed");
  return { b64: bytesToB64(bytes), type };
}

function bytesToB64(buf: Uint8Array): string {
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < buf.length; i += CH) bin += String.fromCharCode(...buf.subarray(i, i + CH));
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

async function fetchBase64(url: string): Promise<{ b64: string; type: string }> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Public asset download failed: HTTP ${res.status} (${new URL(url).pathname})`);
  const type = res.headers.get("content-type") || "application/octet-stream";
  if (type.includes("text/html") && !/\.html?(?:[?#]|$)/i.test(url)) throw new Error(`Public asset returned HTML instead of a file: ${new URL(url).pathname}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { b64: bytesToB64(bytes), type };
}

/* ------------------------------------------- SITE PUBLIC ASSETS (v3) --- */
/**
 * Repo එකේ `public/` folder එකේ තියෙන files (අලුත් uploaded icons ඇතුළුව).
 * මේවා Supabase storage එකේ නැති නිසා පරණ backup වලට ඇතුළත් වුණේ නෑ —
 * Format v3 එකේදී මේවා live site එකෙන්ම fetch කරලා:
 *   1) database.sql එකේ site_images_backup rows විදිහට (`site-public/…` path එකෙන්)
 *   2) ZIP එකේ `site-assets/public/…` files විදිහට
 * දෙවිදිහටම යනවා. Import එකේදී storage එකේ `site-public/` යටතේ restore
 * වෙන නිසා ඊළඟ backups වලටත් මේවා අහුවෙනවා.
 * ⚠ public/ එකට අලුත් file එකක් දැම්මොත් මේ list එකටත් දාන්න.
 */
// 🖼 `public/` එකේ හැම file එකක්ම (auto-generated manifest) — ඉදිරි updates වලට
//    අලුතෙන් දාන icon/image/font එකක් backup ZIP එකට අපේම එකතු වේ.
import { PUBLIC_ASSET_FILES } from "@/lib/public-assets.generated";
import { isSiteSourceEntry, siteAssetArchivePath } from "@/lib/backup-utils";

export { isSiteSourceEntry, siteAssetArchivePath };

export const PUBLIC_ASSET_PATHS: string[] = [...PUBLIC_ASSET_FILES];

export interface SiteAssetFile {
  /** public/ එක ඇතුළේ path එක (උදා: icons/phone-call.png) */
  path: string;
  /** storage + site_images_backup එකේ archive path එක (site-public/…) */
  archivePath: string;
  b64: string;
  type: string;
}

/** Public assets fetch කරන්න site එකේ base URL එක හොයා ගනී */
function resolveAssetBaseUrl(explicit?: string): string {
  const clean = (u: string) => u.replace(/\/$/, "");
  if (explicit) return clean(explicit);
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  const pub = process.env.NEXT_PUBLIC_SITE_URL;
  if (pub) return clean(pub.startsWith("http") ? pub : `https://${pub}`);
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (prod) return clean(prod.startsWith("http") ? prod : `https://${prod}`);
  return "https://website-blond-eta-94.vercel.app";
}

/** `public/` files ටික live site එකෙන් fetch කර base64 විදිහට ගනී (6 ගණනේ parallel) */
export async function fetchPublicAssets(assetBaseUrl?: string): Promise<SiteAssetFile[]> {
  const base = resolveAssetBaseUrl(assetBaseUrl);
  const out: SiteAssetFile[] = [];
  for (let i = 0; i < PUBLIC_ASSET_PATHS.length; i += 6) {
    const batch = PUBLIC_ASSET_PATHS.slice(i, i + 6);
    const fetched = await Promise.all(
      batch.map(async (p) => {
        const f = await fetchBase64(`${base}/${p}`);
        return { path: p, archivePath: `site-public/${p}`, b64: f.b64, type: f.type };
      })
    );
    for (const f of fetched) if (f) out.push(f);
  }
  return out;
}


function contentTypeForPath(path: string): string {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "gif") return "image/gif";
  if (ext === "ttf") return "font/ttf";
  return "application/octet-stream";
}

/**
 * Canonical schema.sql — client bundle එකට නොයවා, server route එකෙන් ගන්නවා.
 * (ලොග් වී ඉන්න admin/superadmin කෙනෙකුට විතරයි — token එකක් නැත්නම් හිස් string)
 */
async function fetchSchemaSql(baseUrl?: string, cronSecret?: string): Promise<string> {
  try {
    // Server (scheduled / auto) backup එකේදී browser session එකක් නෑ → absolute URL එක +
    // cron secret එකෙන් route එක කතා කරයි. Browser එකේදී සයින් වුණු admin ගේ token එකෙන්.
    const url = baseUrl ? `${baseUrl.replace(/\/$/, "")}/api/backup/schema` : "/api/backup/schema";
    let headers: Record<string, string> = {};
    if (cronSecret) {
      headers = { "x-backup-secret": cronSecret };
    } else {
      const sb = await authedClient();
      const { data } = await sb.auth.getSession();
      const token = data?.session?.access_token ?? "";
      if (!token) return "";
      headers = { Authorization: `Bearer ${token}` };
    }
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

/**
 * 🗂 Site design/update source snapshot එක (backup ZIP එකේ `site-source/`) —
 * server-only route එකකින් fetch වේ. Fail වුණොත් හිස් list එකක් එවයි
 * (full ZIP builder එක හිස් snapshot එකක් නම් backup එක නවත්වයි).
 */
async function fetchSiteSourceSnapshot(
  baseUrl?: string,
  cronSecret?: string
): Promise<{ version: string; files: { path: string; content: string }[] }> {
  const url = baseUrl ? `${baseUrl.replace(/\/$/, "")}/api/backup/site-source` : "/api/backup/site-source";
  let headers: Record<string, string> = {};
  if (cronSecret) {
    headers = { "x-backup-secret": cronSecret };
  } else {
    const sb = await authedClient();
    const { data } = await sb.auth.getSession();
    const token = data?.session?.access_token ?? "";
    if (!token) return { version: "", files: [] };
    headers = { Authorization: `Bearer ${token}` };
  }
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) return { version: "", files: [] };
  const json = (await res.json()) as { version?: string; files?: { path: string; content: string }[] };
  return { version: String(json.version ?? ""), files: Array.isArray(json.files) ? json.files : [] };
}

/* ------------------------------------------------------ LOGIN ACCOUNTS - */
/**
 * auth.users + auth.identities නැවත හදන SQL එක — profiles වල auth_email +
 * password_display (base64) එකෙන් password එකත් එක්කම. fresh Supabase
 * project එකකට database.sql run කළාම හැමෝටම පරණ password එකෙන්ම login වෙන්න පුළුවන්.
 * ⚠ profiles.id → auth.users FK එක නිසා මේ block එක DATA inserts වලට කලින් යා යුතුමයි.
 */
export function buildLoginAccountsSql(profiles: Record<string, unknown>[]): string[] {
  const lines: string[] = [];
  lines.push(`-- -------------------------- LOGIN ACCOUNTS ----------------------------`);
  lines.push(`-- fresh Supabase restore එකේ login වීමට — password එක්ක (pgcrypto)`);
  lines.push(`-- ⚠ මේ file එකේ passwords අඩංගුයි — රහසිගතව තබා ගන්න!`);
  lines.push(`set search_path = public, extensions;`);
  for (const p of profiles) {
    const id = String(p.id ?? "");
    const email = String(p.auth_email ?? "").trim();
    const plain = decodeDisplayPw(String(p.password_display ?? ""));
    if (!id || !email || !plain) {
      lines.push(`-- ⚠ login account skipped: ${email || id || "?"} (email/password නෑ — අවශ්‍ය නම් Admin එකෙන් reset කරන්න)`);
      continue;
    }
    lines.push(`DO $$ BEGIN
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', ${sqlVal(id)}, 'authenticated', 'authenticated', ${sqlVal(email)}, crypt(${sqlVal(plain)}, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
  ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password, email = EXCLUDED.email, email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now());
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'login account skipped: %', SQLERRM;
END $$;`);
    lines.push(`DO $$ BEGIN
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), ${sqlVal(id)}, ${sqlVal(id)}, json_build_object('sub', ${sqlVal(id)}, 'email', ${sqlVal(email)}, 'email_verified', true)::jsonb, 'email', now(), now(), now())
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'login identity skipped: %', SQLERRM;
END $$;`);
  }
  lines.push(`reset search_path;`);
  lines.push(``);
  return lines;
}

/* ------------------------------------------------------------- GENERATE -- */
export async function generateBackupSql(
  onProgress: (msg: string, pct: number) => void,
  client?: BackupClient,
  assetBaseUrl?: string,
  mediaOptions?: { readMedia?: BackupMediaReader; cronSecret?: string },
): Promise<{
  sql: string;
  tableCounts: Record<string, number>;
  imageCount: number;
  mediaRows: { path: string; b64: string; type: string }[];
  /** Format v3: ZIP එකේ site-assets/ files විදිහටත් දාන්න public assets ටික */
  siteAssets: SiteAssetFile[];
  /** ZIP registers වලට ආයෙත් fetch නොකර පාවිච්චි කරන්න (දෙපාරක් ගන්න එක නවත්වයි) */
  registerRows: { members: Record<string, unknown>[]; voters: Record<string, unknown>[] };
}> {
  const sb = client ?? (await authedClient());
  const lines: string[] = [];

  lines.push(`-- ============================================================`);
  lines.push(`-- Panduwasnuwara New MPCS — FULL SITE BACKUP`);
  lines.push(`-- Backup-Format: ${BACKUP_FORMAT_VERSION}`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- Same-site restore: Admin → Backup & Restore → Import (ZIP එකම තෝරන්න).`);
  lines.push(`-- Fresh Supabase restore: 1) ZIP එකේ schema.sql run කරන්න`);
  lines.push(`--   2) මේ file එක run කරන්න (logins password සහිතව හැදේ)`);
  lines.push(`--   3) Admin → Import එකෙන් ZIP එක එක් වරක් තෝරන්න — images storage එකට යයි.`);
  lines.push(`-- ⚠ මෙම file එකේ login passwords + Gemini API key (backup_secrets) අඩංගුයි — රහසිගතව තබා ගන්න!`);
  lines.push(`-- ============================================================`);
  lines.push(``);
  lines.push(`create extension if not exists "pgcrypto";`);
  lines.push(``);

  onProgress("Reading table schemas…", 5);
  const schemaCols = await fetchSchemaCols(BACKUP_TABLES);

  // gather rows — tables 3 බැගින් සමාන්තරව (server auto-backup එක timeout වෙන්නේ නැති වෙන්න).
  // ⚠ Supabase PostgREST max-rows = 1000 — ඒ නිසා table එකක් ඇතුළේ පිටු 4 බැගින් කියවයි (52k+ rows සම්පූර්ණ වේ).
  const gathered: { name: string; rows: Record<string, unknown>[] }[] = new Array(BACKUP_TABLES.length);
  const gatherWarnings: (string | undefined)[] = new Array(BACKUP_TABLES.length);
  let nextTableIdx = 0;
  let tablesDone = 0;

  async function fetchTableRows(t: (typeof BACKUP_TABLES)[number]): Promise<{ rows: Record<string, unknown>[]; warning?: string }> {
    const rows: Record<string, unknown>[] = [];
    let expected: number | null = null;
    for (let from = 0; ; from += 4000) {
      const pages = await Promise.all(
        [0, 1, 2, 3].map((i) => sb.from(t.name).select("*", from === 0 && i === 0 ? { count: "exact" } : {}).order(t.pk, { ascending: true }).range(from + i * 1000, from + i * 1000 + 999))
      );
      if (from === 0) expected = pages[0].count;
      let shortPage = false;
      for (const pg of pages) {
        if (pg.error) return { rows, warning: `-- ⚠ ${t.name}: ${pg.error.message}` };
        const got = (pg.data as Record<string, unknown>[]) ?? [];
        rows.push(...got);
        if (got.length < 1000) {
          shortPage = true;
          break;
        }
      }
      if (shortPage) break;
    }
    if (expected !== null && expected !== rows.length) return { rows, warning: `-- ${t.name}: row count changed or pagination was truncated (${rows.length}/${expected}); retry backup` };
    return { rows };
  }

  async function gatherWorker() {
    for (;;) {
      const idx = nextTableIdx++;
      if (idx >= BACKUP_TABLES.length) return;
      const t = BACKUP_TABLES[idx];
      onProgress(`Exporting ${t.name}…`, 8 + Math.round((tablesDone / BACKUP_TABLES.length) * 40));
      try {
        const { rows, warning } = await fetchTableRows(t);
        gathered[idx] = { name: t.name, rows };
        gatherWarnings[idx] = warning;
      } catch (e) {
        gathered[idx] = { name: t.name, rows: [] };
        gatherWarnings[idx] = `-- ⚠ ${t.name}: ${(e as Error).message}`;
      }
      tablesDone++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, BACKUP_TABLES.length) }, () => gatherWorker()));
  const tableFailures = gatherWarnings.filter(Boolean);
  if (tableFailures.length) throw new Error(`Full backup stopped — unreadable/incomplete tables: ${tableFailures.join("; ")}`);

  // 🔁 EXPORT dedupe — board_members / gallery_items වල duplicate rows ZIP එකට යන්නේ නෑ
  //    (site එකේ පේන ලෙසම: එකම නම / එකම image එක වරක් විතරයි). Merge කරද්දී හිස් තැන් පිරෙනවා.
  for (const g of gathered) {
    if (!g) continue;
    const before = g.rows.length;
    g.rows = orderBackupRows(g.name, dedupeTableRows(g.name, g.rows), SCHEMA_SELF_REFERENCES);
    if (g.rows.length !== before) {
      lines.push(`-- 🔁 ${g.name}: duplicate ${before - g.rows.length}ක් merge කළා (${before} → ${g.rows.length})`);
    }
  }

  // DDL
  onProgress("Writing table DDL…", 50);
  lines.push(`-- ------------------------------- TABLES -------------------------------`);
  for (const t of BACKUP_TABLES) {
    lines.push(DDL_OVERRIDE[t.name] ?? ddlFor(t, schemaCols[t.name] ?? []));
    lines.push(``);
  }

  // Capture bytes, not only URLs. Authenticated storage SDK reads work for
  // private/signed objects too; public HTTP fetches used to silently drop photos.
  onProgress("Downloading all stored files and referenced media…", 55);
  const liveTables = gathered.filter((t) => t.name !== "site_images_backup");
  const refs = scanMediaReferences(liveTables, PUBLIC_ASSET_PATHS);
  const paths = await listAllStorageFiles(sb);
  const aliases = new Map<string, string>();
  const tasks = new Map<string, MediaRef>();
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  for (const path of paths) tasks.set(path, { source: "", bucket: "site-images", key: path });
  for (const ref of refs) {
    if (ref.local) { aliases.set(ref.source, mediaArchivePath(ref)!); continue; }
    let path = mediaArchivePath(ref);
    // A storage URL on another project must NOT download the same key from
    // this project. Capture its actual bytes and rewrite by the exact alias.
    const ownStorage = ref.bucket && (ref.source.startsWith("/storage/") || (() => { try { return new URL(ref.source.startsWith("//") ? `https:${ref.source}` : ref.source).origin === new URL(base).origin; } catch { return false; } })());
    if (!ownStorage) {
      const hash = await sha256Hex(ref.source);
      const ext = (() => { try { return new URL(ref.source.startsWith("//") ? `https:${ref.source}` : ref.source).pathname.match(/\.[a-zA-Z0-9]{1,8}$/)?.[0] ?? ""; } catch { return ""; } })();
      path = ref.bucket && ref.bucket !== "site-images" ? `site-buckets/${ref.bucket}/backup-restored/${hash}${ext}` : `referenced-media/${hash}${ext}`;
    }
    if (!path) throw new Error("Could not archive media reference");
    aliases.set(ref.source, path);
    if (!tasks.has(path)) tasks.set(path, ownStorage ? ref : { source: ref.source });
  }
  const imgRows: { path: string; b64: string; type: string }[] = [];
  const entries = [...tasks];
  for (let i = 0; i < entries.length; i += 6) {
    onProgress(`File ${Math.min(i + 6, entries.length)}/${entries.length}…`, 55 + Math.round((i / Math.max(entries.length, 1)) * 28));
    const files = await Promise.all(entries.slice(i, i + 6).map(async ([path, ref]) => {
      try {
        if (ref.bucket && ref.key) {
          const { data, error } = await sb.storage.from(ref.bucket).download(ref.key);
          if (error || !data) throw new Error(error?.message ?? "No file returned");
          const bytes = new Uint8Array(await data.arrayBuffer());
          return { path, b64: bytesToB64(bytes), type: data.type || contentTypeForPath(path) };
        }
        return { path, ...await readExternalBackupMedia(ref.source, mediaOptions?.readMedia, assetBaseUrl, mediaOptions?.cronSecret) };
      } catch (e) { throw new Error(`Full backup stopped — media ${path}: ${(e as Error).message}`); }
    }));
    imgRows.push(...files);
  }
  onProgress("Adding all public files…", 86);
  const siteAssets = await fetchPublicAssets(assetBaseUrl);
  const byPath = new Map(imgRows.map((r) => [r.path, r]));
  for (const a of siteAssets) byPath.set(a.archivePath, { path: a.archivePath, b64: a.b64, type: a.type });
  const mediaRows = [...byPath.values()];
  if (aliases.size) byPath.set(MEDIA_INDEX_PATH, { path: MEDIA_INDEX_PATH, type: "application/json", b64: bytesToB64(new TextEncoder().encode(JSON.stringify(Object.fromEntries(aliases)))) });
  imgRows.splice(0, imgRows.length, ...byPath.values());
  // A restored cache may contain OLD bytes. Never emit those after fresh image
  // INSERTs: ON CONFLICT previously overwrote the new photos with stale data.
  const imageCache = gathered.find((t) => t.name === "site_images_backup");
  if (imageCache) imageCache.rows = [];

  // image INSERTs
  lines.push(`-- ------------------------------- IMAGES -------------------------------`);
  for (const im of imgRows) {
    lines.push(`INSERT INTO public.site_images_backup (path, data_base64, content_type) VALUES (${sqlVal(im.path)}, ${sqlVal(im.b64)}, ${sqlVal(im.type)}) ON CONFLICT (path) DO UPDATE SET data_base64 = EXCLUDED.data_base64, content_type = EXCLUDED.content_type;`);
  }
  lines.push(``);

  // ---- login accounts මුලින්ම (profiles FK → auth.users නිසා DATA වලට කලින්!) ----
  const profilesRows = gathered.find((g) => g.name === "profiles")?.rows ?? [];
  if (profilesRows.length) {
    onProgress("Preparing login accounts…", 86);
    lines.push(...buildLoginAccountsSql(profilesRows));
  }

  // row INSERTs
  onProgress("Writing data rows…", 88);
  lines.push(`-- ------------------------------- DATA ---------------------------------`);
  for (const t of gathered) {
    const pk = BACKUP_TABLES.find((x) => x.name === t.name)!.pk;
    lines.push(`-- ${t.name} (${t.rows.length} rows)`);
    // select("*") නිසා හැම row එකේම columns එකමයි — prefix/sets එක වරක් හැදුවාම ඇති (වේගය)
    const firstCols = t.rows.length ? Object.keys(t.rows[0]) : [];
    const firstSets = firstCols.filter((c) => c !== pk).map((c) => `${colName(c)} = EXCLUDED.${colName(c)}`).join(", ");
    const firstPrefix = `INSERT INTO public.${t.name} (${firstCols.map(colName).join(", ")}) VALUES (`;
    const firstSuffix = firstSets ? `) ON CONFLICT (${colName(pk)}) DO UPDATE SET ${firstSets};` : `) ON CONFLICT (${colName(pk)}) DO NOTHING;`;
    for (const r of t.rows) {
      const cols = Object.keys(r);
      if (!cols.length) continue;
      if (cols.length === firstCols.length && cols.every((c, ci) => c === firstCols[ci])) {
        lines.push(firstPrefix + cols.map((c) => sqlVal(r[c])).join(", ") + firstSuffix);
      } else {
        const sets = cols.filter((c) => c !== pk).map((c) => `${colName(c)} = EXCLUDED.${colName(c)}`).join(", ");
        lines.push(
          `INSERT INTO public.${t.name} (${cols.map(colName).join(", ")}) VALUES (${cols.map((c) => sqlVal(r[c])).join(", ")})` +
            (sets ? ` ON CONFLICT (${colName(pk)}) DO UPDATE SET ${sets};` : ` ON CONFLICT (${colName(pk)}) DO NOTHING;`)
        );
      }
    }
    lines.push(``);
  }

  onProgress("Backup ready ✅", 100);
  // manifest එකට — table එකින් එක row ගණන (site_images_backup = ඇත්තටම file එකේ තියන images ගණන)
  const tableCounts: Record<string, number> = {};
  for (const g of gathered) tableCounts[g.name] = g.rows.length;
  tableCounts["site_images_backup"] = imgRows.length;
  for (const [name, count] of Object.entries(tableCounts)) lines.push(`-- Backup-Table: ${name} ${count}`);
  return {
    sql: lines.join("\n"),
    tableCounts,
    imageCount: mediaRows.length,
    mediaRows,
    siteAssets,
    registerRows: {
      members: gathered.find((g) => g.name === "member_rows")?.rows ?? [],
      voters: gathered.find((g) => g.name === "voter_rows")?.rows ?? [],
    },
  };
}

/* --------------------------------------------------------------- PARSE --- */
// parseBackupSql + ParsedInsert දැන් @/lib/backup-utils.ts එකේ (මුලින්ම එතනින් re-export වේ)

/* -------------------------------------------------------------- RESTORE -- */
export async function restoreBackup(
  inserts: ParsedInsert[],
  onProgress: (msg: string, pct: number) => void,
  opts?: {
    tableCounts?: Record<string, number>; // includes EMPTY tables in a full snapshot
    client?: BackupClient; // dependency injection for isolated restore tests
    onlyTables?: string[]; // partial restore — තෝරගත් tables විතරක් (නැත්නම් සියල්ලම)
    /** Format v3: ZIP එකේ site-assets/public/ files — SQL එකේ නැති ඒවා storage එකට restore වේ */
    siteAssets?: { path: string; bytes: Uint8Array }[];
    mediaFiles?: { path: string; bytes: Uint8Array }[];
  }
): Promise<{ restored: Record<string, number>; errors: string[]; siteAssets: number }> {
  const sb = opts?.client ?? await authedClient();
  const restored: Record<string, number> = {};
  const errors: string[] = [];

  const byTable = new Map<string, Record<string, unknown>[]>();
  for (const ins of inserts) {
    const row: Record<string, unknown> = {};
    ins.cols.forEach((c, i) => (row[c] = ins.values[i] ?? null));
    if (!byTable.has(ins.table)) byTable.set(ins.table, []);
    byTable.get(ins.table)!.push(row);
  }
  for (const [name, count] of Object.entries(opts?.tableCounts ?? {})) {
    if (BACKUP_TABLES.some((t) => t.name === name) && count === 0 && !byTable.has(name)) byTable.set(name, []);
  }
  // 🔁 IMPORT dedupe — පරණ backup එකක duplicate board/gallery rows තිබුණත් ඒවා
  //    නැවත හැදෙන්නේ නෑ. (board_members_email_uniq index එකත් කැඩෙන්නේ නෑ.)
  let dedupedRows = 0;
  for (const [name, rows] of byTable) {
    const clean = orderBackupRows(name, dedupeTableRows(name, rows), SCHEMA_SELF_REFERENCES);
    if (clean.length !== rows.length) dedupedRows += rows.length - clean.length;
    byTable.set(name, clean);
  }

  // 1) storage images first (URL rewrite එකට)
  onProgress("Restoring images to storage…", 5);
  const selectedData = [...byTable].filter(([name]) => name !== "site_images_backup" && (!opts?.onlyTables || opts.onlyTables.includes(name))).map(([, rows]) => rows);
  const wantImages = !opts?.onlyTables || opts.onlyTables.includes("site_images_backup") || scanMediaReferences(selectedData, PUBLIC_ASSET_PATHS).length > 0;
  const imgRows: Record<string, unknown>[] = wantImages ? [...(byTable.get("site_images_backup") ?? [])] : [];
  // Format v3: ZIP එකේ site-assets/public/ files ටික SQL image rows වලට merge
  // කරයි (SQL එකේ දැනටමත් තියන path එකක් නම් ඒකම තියේ — duplicate නෑ)
  if (wantImages && opts?.siteAssets?.length) {
    const seen = new Set(imgRows.map((r) => String(r.path ?? "")));
    for (const a of opts.siteAssets) {
      const archivePath = siteAssetArchivePath(a.path);
      if (seen.has(archivePath)) continue;
      seen.add(archivePath);
      const row = { path: archivePath, data_base64: bytesToB64(a.bytes), content_type: contentTypeForPath(archivePath) };
      imgRows.push(row);
      // site_images_backup table එකටත් row එක යන්න byTable එකටත් දායි
      if (!byTable.has("site_images_backup")) byTable.set("site_images_backup", []);
      byTable.get("site_images_backup")!.push(row);
    }
  }
  if (wantImages && opts?.mediaFiles?.length) {
    const seen = new Set(imgRows.map((r) => String(r.path ?? "")));
    for (const file of opts.mediaFiles) {
      if (!safeMediaPath(file.path)) throw new Error("Unsafe media archive path");
      if (seen.has(file.path)) continue;
      const row = { path: file.path, data_base64: bytesToB64(file.bytes), content_type: contentTypeForPath(file.path) };
      imgRows.push(row); seen.add(file.path);
      if (!byTable.has("site_images_backup")) byTable.set("site_images_backup", []);
      byTable.get("site_images_backup")!.push(row);
    }
  }
  // Metadata is kept inside SQL (and inside SQL encryption); never published to
  // a public bucket because old signed URL query strings can contain tokens.
  const aliases = new Map<string, string>();
  for (const row of imgRows.filter((r) => r.path === MEDIA_INDEX_PATH)) {
    const index = JSON.parse(new TextDecoder().decode(b64ToBytes(String(row.data_base64 ?? "")))) as Record<string, unknown>;
    for (const [source, path] of Object.entries(index)) {
      if (typeof path !== "string" || !safeMediaPath(path)) throw new Error("Invalid media index");
      aliases.set(source, path);
    }
  }
  // Old backups may have duplicate cache INSERTs; prefer the first (fresh)
  // image block over later stale DATA INSERTs for the same path.
  const uniqueImages = new Map<string, Record<string, unknown>>();
  for (const row of imgRows) if (!uniqueImages.has(String(row.path))) uniqueImages.set(String(row.path), row);
  imgRows.splice(0, imgRows.length, ...[...uniqueImages.values()].filter((r) => r.path !== MEDIA_INDEX_PATH));
  if (byTable.has("site_images_backup")) byTable.set("site_images_backup", [...uniqueImages.values()]);
  const siteAssetCount = imgRows.filter((r) => String(r.path ?? "").startsWith("site-public/")).length;
  const urlMap = new Map<string, string>(); // old url -> new url
  for (const row of imgRows) {
    if (!safeMediaPath(String(row.path ?? "")) || typeof row.data_base64 !== "string") throw new Error("Invalid image/file in backup");
    // Zero-byte files are valid; missing/corrupt data is not. Validate ALL base64.
    b64ToBytes(row.data_base64);
  }
  for (let i = 0; i < imgRows.length; i++) {
    const r = imgRows[i];
    onProgress(`Image ${i + 1}/${imgRows.length} — ${String(r.path).slice(0, 40)}…`, 5 + Math.round((i / Math.max(imgRows.length, 1)) * 25));
    try {
      const b64 = String(r.data_base64 ?? "");
      const bin = atob(b64);
      const buf = new Uint8Array(bin.length);
      for (let j = 0; j < bin.length; j++) buf[j] = bin.charCodeAt(j);
      const blob = new Blob([buf], { type: String(r.content_type || "image/jpeg") });
      const archived = String(r.path).match(/^site-buckets\/([^/]+)\/(.+)$/);
      const bucket = archived?.[1] ?? "site-images";
      const key = archived?.[2] ?? String(r.path);
      // Other buckets must already exist with appropriate access policies. Never
      // copy a private referenced document into the public site-images bucket.
      const storage = sb.storage.from(bucket);
      const { error } = await storage.upload(key, blob, { upsert: true });
      if (error) throw new Error(error.message);
      let newUrl = "";
      if (bucket === "site-images") newUrl = storage.getPublicUrl(key).data.publicUrl;
      else {
        const signed = await storage.createSignedUrl(key, 3600);
        if (signed.error) throw new Error(signed.error.message);
        newUrl = signed.data.signedUrl;
      }
      // පරණ URL (backup rows වල තිබ්බ ඕන එකක්) path එකෙන් හඳුනාගමු — පස්සේ rewrite එකට
      if (!newUrl) throw new Error("No restored public URL returned");
      urlMap.set(String(r.path), newUrl);
    } catch (e) {
      errors.push(`image ${r.path}: ${(e as Error).message}`);
    }
  }

  if (errors.length) throw new Error(`Restore stopped before database deletion — ${errors.join("; ")}`);
  // Recursively rewrite every occurrence, including JSON-string settings and
  // external Board photos recorded in the media index.
  function rewrite(val: unknown): unknown { return rewriteMediaValue(val, urlMap, aliases); }
  const selectedRefs = wantImages ? scanMediaReferences(selectedData, PUBLIC_ASSET_PATHS) : [];
  const missing = selectedRefs.filter((ref) => {
    const path = aliases.get(ref.source) ?? mediaArchivePath(ref);
    return !path || !urlMap.has(path);
  });
  if (missing.length) throw new Error(`Restore stopped before database deletion — ${missing.length} referenced media file(s) missing from backup. Create a new complete backup or re-upload the missing files.`);

  // 2) wipe + insert — wipe එක reverse පිළිවෙළේ (children → parents), insert එක forward (parents → children)
  const ordered = BACKUP_TABLES.filter((t) => byTable.has(t.name)).filter(
    (t) => !opts?.onlyTables || opts.onlyTables.includes(t.name)
  );
  // ⚠ profiles + backup_secrets සම්පූර්ණයෙන් wipe කරන්නේ නෑ: RLS policies profiles එකෙන්
  //    බලන නිසා ඒක හිස් කළොත් admin තමන්වම lock out වෙනවා. එම tables upsert එකෙන් update වේ.
  //    backup_history එකත් audit ඉතිහාසය නිසා wipe කරන්නේ නෑ — restore එකේදී merge වේ.
  const NO_WIPE = new Set(["profiles", "backup_secrets", "backup_history"]);
  for (const t of [...ordered].reverse()) {
    if (NO_WIPE.has(t.name)) continue;
    // not(pk, is, null) — uuid/text ඕන pk එකකට වැඩ කරයි (පරණ neq("__backup_wipe__") එක uuid වල fail වුණා)
    const { error } = await sb.from(t.name).delete().not(t.pk, "is", null);
    if (error) throw new Error(`Restore stopped: wipe ${t.name}: ${error.message}. Some earlier tables may already have changed; use the safety backup.`);
  }

  for (let i = 0; i < ordered.length; i++) {
    const t = ordered[i];
    const rows = byTable.get(t.name)!.map((r) => {
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) o[k] = rewrite(v);
      return o;
    });
    onProgress(`Restoring ${t.name} (${rows.length} rows)…`, 35 + Math.round((i / ordered.length) * 58));
    for (let j = 0; j < rows.length; j += 200) {
      const { error } = await sb.from(t.name).upsert(rows.slice(j, j + 200), { onConflict: t.pk });
      if (error) {
        throw new Error(`Restore stopped: ${t.name}: ${error.message}. Restore is not transactional; use the safety backup to recover.`);
      }
    }
    restored[t.name] = rows.length;
  }

  // 2b) 📊 Restore එකෙන් පස්සේ system_settings වල සාමාජික/ඡන්ද ගණන් ඇත්තට sync කරයි
  //     — නැත්නම් පරණ backup එකක තිබ්බ පරණ ගණනක් pages වල පෙන්නන්න පුළුවන්.
  if (restored["member_rows"] != null || restored["voter_rows"] != null || restored["data_files"] != null) {
    try {
      const [m, v, mf, vf] = await Promise.all([
        sb.from("member_rows").select("id", { count: "exact", head: true }),
        sb.from("voter_rows").select("id", { count: "exact", head: true }),
        sb.from("data_files").select("file_name").eq("kind", "member"),
        sb.from("data_files").select("file_name").eq("kind", "voter"),
      ]);
      const uniq = (rows: { file_name?: string }[] | null) =>
        new Set((rows ?? []).map((r) => String(r.file_name ?? "").trim()).filter(Boolean)).size;
      const patch: { key: string; value: string }[] = [];
      if (typeof m.count === "number") patch.push({ key: "members_total", value: String(m.count) });
      if (typeof v.count === "number") patch.push({ key: "voters_total", value: String(v.count) });
      if (!mf.error) patch.push({ key: "members_files_count", value: String(uniq(mf.data as { file_name?: string }[] | null)) });
      if (!vf.error) patch.push({ key: "voters_files_count", value: String(uniq(vf.data as { file_name?: string }[] | null)) });
      if (patch.length) {
        const { error } = await sb.from("system_settings").upsert(patch, { onConflict: "key" });
        if (error) throw new Error(error.message);
      }
    } catch (e) {
      errors.push(`counters sync: ${(e as Error).message}`);
    }
  }

  // 2c) 🔁 Duplicate rows merge වුණා නම් ඒ ගැන දැනුම් දේ (කිසිවක් නැති වුණේ නෑ)
  if (dedupedRows > 0) {
    errors.push(`ℹ duplicate rows ${dedupedRows}ක් merge කළා (board/gallery) — දත්ත කිසිවක් මකා නෑ, හිස් තැන් පුරවා එක row එකක් කළා.`);
  }

  // 3) ⚠ Import/Restore එකෙන් කිසිම ගිණුමක් මකන්නේ නෑ (profiles NEVER deleted)
  //    කලින් "backup එකේ නැති profiles" stale කියලා auto-delete වුණා — ඒ නිසා
  //    backup එක ගත්තට පස්සේ හදපු admin/සාමාජික ගිණුම් import එකකදී නැති වුණා.
  //    දැන් ඒවා කිසිවක් මකන්නේ නෑ — කීයක් backup එකේ නැද්ද කියලා විතරයි වාර්තා කරන්නේ.
  const backupProfileIds = new Set(
    (byTable.get("profiles") ?? []).map((r) => String(r.id ?? "")).filter(Boolean)
  );
  if (backupProfileIds.size && ordered.some((t) => t.name === "profiles")) {
    try {
      const { data: u } = await sb.auth.getUser();
      if (u?.user?.id) backupProfileIds.add(u.user.id);
      let notInBackup = 0;
      for (let from = 0; from < 200000; from += 1000) {
        const { data, error } = await sb.from("profiles").select("id").range(from, from + 999);
        if (error || !data?.length) break;
        for (const r of data as { id: string }[]) {
          if (!backupProfileIds.has(String(r.id))) notInBackup += 1;
        }
        if (data.length < 1000) break;
      }
      if (notInBackup > 0) {
        errors.push(
          `ℹ backup එකේ නොතිබුණු ගිණුම් ${notInBackup}ක් තියෙනවා — කිසිවක් මකා නෑ (ආරක්ෂාවට). අවශ්‍ය නම් Admin → Registered Members එකෙන් අතින් ඉවත් කරන්න.`
        );
      }
    } catch (e) {
      errors.push(`profile check skipped: ${(e as Error).message}`);
    }
  }

  // 3b) Import එකෙන් පස්සේ Backup History එකත් අලුත්ම 5 ටම තබා ගනී
  //     (backup_history restore එකේදී merge වන නිසා පරණ backup එකක වැඩි history තිබිය හැක)
  if (ordered.some((t) => t.name === "backup_history")) {
    try {
      const { data, error } = await sb
        .from("backup_history")
        .select("id, created_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1000);
      if (error) throw new Error(error.message);
      const staleIds = backupHistoryIdsToPrune((data ?? []) as { id: string; created_at: string }[], BACKUP_HISTORY_KEEP);
      if (staleIds.length) {
        const { error: deleteError } = await sb.from("backup_history").delete().in("id", staleIds);
        if (deleteError) throw new Error(deleteError.message);
      }
    } catch (e) {
      errors.push(`backup_history prune: ${(e as Error).message}`);
    }
  }

  onProgress(errors.length ? "Restore finished with issues ⚠" : "Restore complete ✅", 100);
  return { restored, errors, siteAssets: siteAssetCount };
}

/* ------------------------------------------------- IMPORT VERIFY (v3.1) -- */
/**
 * 🔎 Import එකෙන් පස්සේ තහවුරු කිරීම — backup එකේ තිබුණු row ගාණ සහ
 * දැන් database එකේ ඇත්තටම තියෙන ගාණ සසඳයි.
 * (dedupe/merge නිසා ඇතැම් විට backup එකේ ගාණට වඩා අඩු විය හැක — ඒ නිසා
 *  "actual < expected" විතරයි problem එකක් විදිහට ගන්නේ.)
 */
export async function verifyRestore(
  expected: Record<string, number>,
  client?: BackupClient
): Promise<{ table: string; expected: number; actual: number; ok: boolean }[]> {
  const sb = client ?? (await authedClient());
  const out: { table: string; expected: number; actual: number; ok: boolean }[] = [];
  const names = Object.keys(expected).filter((n) => BACKUP_TABLES.some((t) => t.name === n));
  for (let i = 0; i < names.length; i += 5) {
    const batch = names.slice(i, i + 5);
    const res = await Promise.all(
      batch.map((n) => sb.from(n).select("*", { count: "exact", head: true }))
    );
    batch.forEach((n, idx) => {
      const actual = typeof res[idx]?.count === "number" ? (res[idx].count as number) : -1;
      const exp = expected[n] ?? 0;
      // dedupe/merge → අඩු වෙන්න පුළුවන්; නමුත් 0ක් වෙන්න හොඳ නෑ (exp > 0 නම්)
      const mergeOnly = ["profiles", "backup_secrets"].includes(n);
      const target = n === "backup_history" ? Math.min(exp, BACKUP_HISTORY_KEEP) : exp;
      const ok = actual >= 0 && (mergeOnly ? actual >= target : actual === target);
      out.push({ table: n, expected: exp, actual, ok });
    });
  }
  return out;
}

/* ------------------------------------------------------------- SECRETS --- */
export async function getBackupSecrets(): Promise<{ download: string; importPw: string; encryption: string } | null> {
  const sb = await authedClient();
  const { data, error } = await sb.from("backup_secrets").select("key, value");
  if (error || !data) return null;
  const map = new Map(data.map((r: { key: string; value: string }) => [r.key, r.value]));
  return {
    download: map.get("backup_download_password") ?? "",
    importPw: map.get("backup_import_password") ?? "",
    encryption: map.get("backup_encryption_password") ?? "",
  };
}

export async function setBackupSecret(
  key:
    | "backup_download_password"
    | "backup_import_password"
    | "backup_encryption_password"
    | "mega_email"
    | "mega_password"
    | "backup_cron_secret",
  value: string
) {
  const sb = await authedClient();
  const { error } = await sb.from("backup_secrets").upsert({ key, value }, { onConflict: "key" });
  return error ? error.message : null;
}

/* ------------------------------------------------------------- HISTORY --- */
export type BackupHistoryAction = "download" | "safety_download" | "import" | "scheduled";

export type BackupHistoryEntry = {
  id: string;
  action: BackupHistoryAction;
  actor_id: string | null;
  actor_name: string;
  actor_email: string;
  actor_role: string;
  file_name: string;
  file_size: number | null;
  encrypted: boolean;
  tables_count: number | null;
  rows_count: number | null;
  status: string;
  detail: string;
  created_at: string;
};

/** Backup History එකේ අලුත්ම `keep` ගාණ විතරක් තියාගෙන පරණ සටහන් auto-delete කරයි. */
export async function pruneBackupHistory(
  keep: number = BACKUP_HISTORY_KEEP
): Promise<{ deleted: number; error: string | null }> {
  try {
    const sb = await authedClient();
    const { data, error } = await sb
      .from("backup_history")
      .select("id, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1000);
    if (error) return { deleted: 0, error: error.message };
    const staleIds = backupHistoryIdsToPrune((data ?? []) as { id: string; created_at: string }[], keep);
    if (staleIds.length === 0) return { deleted: 0, error: null };
    const { data: deletedRows, error: deleteError } = await sb
      .from("backup_history")
      .delete()
      .in("id", staleIds)
      .select("id");
    if (deleteError) return { deleted: 0, error: deleteError.message };
    return { deleted: deletedRows?.length ?? staleIds.length, error: null };
  } catch (e) {
    return { deleted: 0, error: (e as Error).message };
  }
}

/** එක Backup History සටහනක් විතරක් manually මකයි (අදාළ ZIP file එක මකන්නේ නෑ). */
export async function deleteBackupHistoryEntry(id: string): Promise<string | null> {
  if (!id) return "History record ID එක නෑ";
  try {
    const sb = await authedClient();
    const { data, error } = await sb.from("backup_history").delete().eq("id", id).select("id");
    if (error) return error.message;
    if (!data || data.length === 0) return "History record එක හමු නොවුණා / permission නෑ";
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

export async function getBackupHistory(
  limit: number = BACKUP_HISTORY_KEEP
): Promise<{ entries: BackupHistoryEntry[]; error: string | null }> {
  try {
    // Page එක open කරද්දීත් පරණ history auto-clean වේ — පේන්නේ අලුත්ම 5 විතරයි.
    await pruneBackupHistory(BACKUP_HISTORY_KEEP);
    const sb = await authedClient();
    const { data, error } = await sb
      .from("backup_history")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(Math.min(Math.max(1, limit), BACKUP_HISTORY_KEEP));
    if (error) return { entries: [], error: error.message };
    return { entries: ((data ?? []) as BackupHistoryEntry[]), error: null };
  } catch (e) {
    return { entries: [], error: (e as Error).message };
  }
}

export async function recordBackupHistory(input: {
  action: BackupHistoryAction;
  fileName: string;
  fileSize?: number | null;
  encrypted?: boolean;
  tablesCount?: number | null;
  rowsCount?: number | null;
  status?: string;
  detail?: string;
}): Promise<BackupHistoryEntry | null> {
  try {
    const sb = await authedClient();
    const { data: u } = await sb.auth.getUser();
    let actorName = u?.user?.email ?? "";
    let actorEmail = u?.user?.email ?? "";
    let actorRole = "";
    if (u?.user) {
      const { data: prof } = await sb
        .from("profiles")
        .select("full_name, role, auth_email")
        .eq("id", u.user.id)
        .maybeSingle();
      const p = prof as { full_name?: string; role?: string; auth_email?: string } | null;
      actorName = p?.full_name || actorName;
      actorEmail = p?.auth_email || actorEmail;
      actorRole = p?.role || "";
    }
    const { data, error } = await sb
      .from("backup_history")
      .insert({
        action: input.action,
        actor_id: u?.user?.id ?? null,
        actor_name: actorName,
        actor_email: actorEmail,
        actor_role: actorRole,
        file_name: input.fileName,
        file_size: input.fileSize ?? null,
        encrypted: !!input.encrypted,
        tables_count: input.tablesCount ?? null,
        rows_count: input.rowsCount ?? null,
        status: input.status ?? "success",
        detail: input.detail ?? "",
      })
      .select("*")
      .single();
    if (error || !data) return null;
    const entry = data as BackupHistoryEntry;
    await pruneBackupHistory(BACKUP_HISTORY_KEEP);
    return entry;
  } catch {
    // History table එක නැති වුණත් (SQL run කරලා නැත්නම්) backup/restore එක නවත්වන්නේ නෑ
    return null;
  }
}


/* ============================================================================
 * FULL BACKUP ZIP — මුලු site එකම, එකක් නෑර:
 *   · schema.sql   (tables + RLS + functions + live chat DB logic)
 *   · database.sql (managed app tables + file bytes + profile-based login recovery)
 *   · Members Register + Voters Register — XLSX + CSV
 *   · manifest.json (version + row counts + SHA-256 hashes) · RECOVERY.txt · README.txt
 *   · විකල්ප: database.sql එක password එකකින් encrypt කළ හැක (AES-GCM)
 * Import: ZIP එකම තේරුවම preview → safety-backup → data + settings + images restore වේ.
 * ========================================================================== */
export async function generateBackupZip(
  onProgress: (msg: string, pct: number) => void,
  opts?: {
    encryptPassword?: string; // දීලා ඇත්නම් database.sql එක AES-GCM වලින් encrypt වේ
    client?: BackupClient; // server scheduled-backup එක service-role client එක inject කරයි
    assetBaseUrl?: string; // Format v3: public/ assets fetch කරන site base URL එක (නැත්නම් browser origin/env)
    cronSecret?: string; // Server backup (scheduled) එකේදී schema.sql ගන්න x-backup-secret
    onMeta?: (meta: { tableCounts: Record<string, number>; imageCount: number }) => void;
    readMedia?: BackupMediaReader;
  }
): Promise<Blob> {
  const zipMod = await import("jszip");
  const JSZip = zipMod.default;
  const xlsxMod = await import("xlsx");
  const XLSX = xlsxMod.default ?? xlsxMod;
  const zip = new JSZip();
  const generatedAt = new Date().toISOString();

  // Download/Safety ZIP එක හදන්න කලින්ම Backup History එක අලුත්ම 5 ට clean කරයි,
  // එවිට backup file එක ඇතුළේත් අලුත් retention update එකම තියේ.
  // (Server scheduled backup එකේදී client එක inject වෙන නිසා එතැන route එකෙන්ම prune කරයි.)
  if (!opts?.client) await pruneBackupHistory(BACKUP_HISTORY_KEEP);

  // manifest එකට — ZIP එකට දාන හැම file එකකම SHA-256 hash + size
  const files: Record<string, { sha256: string; size: number }> = {};
  async function addFile(name: string, content: string | ArrayBuffer, store = false) {
    // bytes එක වරක් හදලා hash + size + zip තුනටම පාවිච්චි කරයි (වේගය).
    // store=true: දැනටමත් compressed/encrypted දේ ආයෙත් deflate කරන්නේ නෑ (CPU නාස්තියක්).
    const bytes = typeof content === "string" ? new TextEncoder().encode(content) : new Uint8Array(content);
    zip.file(name, bytes, store ? { compression: "STORE" } : undefined);
    files[name] = { sha256: await sha256Hex(bytes), size: bytes.byteLength };
  }

  // 1) database.sql (images base64 + login accounts සමඟ)
  const { sql, tableCounts, imageCount, registerRows, siteAssets, mediaRows } = await generateBackupSql(
    (msg, pct) => onProgress(msg, Math.round(pct * 0.72)),
    opts?.client,
    opts?.assetBaseUrl,
    { readMedia: opts?.readMedia, cronSecret: opts?.cronSecret }
  );
  opts?.onMeta?.({ tableCounts, imageCount });
  const [databasePlainSha256, dbContent] = await Promise.all([
    sha256Hex(sql),
    opts?.encryptPassword ? encryptBackupText(sql, opts.encryptPassword) : Promise.resolve(sql),
  ]);
  // encrypted නම් cipher එක ආයෙත් compress කරන්න බෑ — STORE (වේගය)
  await addFile("database.sql", dbContent, !!opts?.encryptPassword);

  // 1b) schema.sql — canonical schema (tables + RLS + functions + live chat RPC logic).
  //     fresh Supabase project එකකට restore කරද්දී මුලින්ම run කළ යුත්තේ මෙයයි.
  let schemaSha256 = "";
  try {
    // 🔒 schema.sql එක Dං browser bundle එකට ගන්නේ නෑ (default passwords/seed
    //    credentials ඒකේ තියෙනවා) — superadmin-only server route එකෙන් ගන්නවා.
    const schemaText = await fetchSchemaSql(opts?.assetBaseUrl, opts?.cronSecret);
    if (typeof schemaText === "string" && schemaText.length > 1000) {
      schemaSha256 = await sha256Hex(schemaText);
      await addFile("schema.sql", schemaText);
    }
    else throw new Error("Canonical schema is empty/incomplete");
  } catch (e) { throw new Error(`Full backup stopped — schema.sql: ${(e as Error).message}`); }

  // 1c) Format v3 — SITE DESIGN / UPDATE PACKAGE:
  //     • site-assets/public/… = public/ files ටිකම (uploaded icons ඇතුළුව) —
  //       Import එකේදී storage එකේ site-public/ යටතේ restore වේ
  //     • site-source/… = CSS + mouse-cursor ඇතුළු අලුත්ම design/update
  //       source files ටික (current build එකේ නියම content එකම)
  onProgress("Adding site design & update files (CSS, cursor, icons)…", 75);
  let siteSourceFiles: { path: string; content: string }[] = [];
  let sitePackageVersion = "";
  try {
    // 🔒 Source snapshot එක දැන් **server route** එකකින් — browser bundle එකට MB ගණනක්
    //    එකතු වෙන්නේ නෑ (schema.sql එකට කළ විදිහම). Cron secret / admin token එකෙන් auth.
    const snap = await fetchSiteSourceSnapshot(opts?.assetBaseUrl, opts?.cronSecret);
    siteSourceFiles = snap.files;
    sitePackageVersion = snap.version;
    if (!siteSourceFiles.length) throw new Error("Source snapshot is empty");
  } catch (e) { throw new Error(`Full backup stopped — source snapshot: ${(e as Error).message}`); }
  for (const asset of siteAssets) {
    await addFile(`site-assets/public/${asset.path}`, b64ToBytes(asset.b64).buffer as ArrayBuffer, true);
  }
  for (const f of siteSourceFiles) await addFile(`site-source/${f.path}`, f.content);

  // Convenient binary copies (Board photos are visible under media/board/).
  // Encrypted backups MUST NOT leak private files outside encrypted database.sql.
  if (!opts?.encryptPassword) for (const file of mediaRows) {
    if (!file.path.startsWith("site-public/")) await addFile(`media/${file.path}`, b64ToBytes(file.b64).buffer as ArrayBuffer, true);
  }
  // 2) XLSX/CSV are reconstructed from the SAME successful DB snapshot.
  function sheet(rows: Record<string, unknown>[], noKey: string) {
    return rows.map((r, i) => ({
      "#": i + 1,
      [noKey === "member_no" ? "Member No" : "Voter No"]: r[noKey] ?? "",
      "Full Name": r.full_name ?? "",
      NIC: r.nic ?? "",
      Address: r.address ?? "",
      "Postal Address": r.postal_address ?? "",
      Gender: r.gender ?? "",
      File: r.file_name ?? "",
    }));
  }

  onProgress("Exporting Member Register (XLSX)…", 80);
  const members = registerRows.members;
  const mSheet = sheet(members, "member_no");
  const mWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(mWb, XLSX.utils.json_to_sheet(mSheet), "Members");
  const mBuf = XLSX.write(mWb, { type: "array", bookType: "xlsx", compression: true }) as ArrayBuffer;
  await addFile("Members-Register.xlsx", mBuf, true);

  onProgress("Exporting Voter Register (XLSX)…", 87);
  const voters = registerRows.voters;
  const vSheet = sheet(voters, "voter_no");
  const vWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(vWb, XLSX.utils.json_to_sheet(vSheet), "Voters");
  const vBuf = XLSX.write(vWb, { type: "array", bookType: "xlsx", compression: true }) as ArrayBuffer;
  await addFile("Voters-Register.xlsx", vBuf, true);

  // 3) CSV (Excel/Numbers වලට backup එකක් විදිහට — UTF-8 BOM සමඟ Sinhala හරි)
  const csvOf = (rows: Record<string, string | number>[]) => {
    const keys = rows.length ? Object.keys(rows[0]) : [];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    return "\ufeff" + [keys.map(esc).join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\r\n");
  };
  await addFile("Members-Register.csv", csvOf(mSheet as unknown as Record<string, string | number>[]));
  await addFile("Voters-Register.csv", csvOf(vSheet as unknown as Record<string, string | number>[]));

  // 4) README
  await addFile(
    "README.txt",
    [
      "Panduwasnuwara New MPCS — FULL SITE BACKUP (Format v" + BACKUP_FORMAT_VERSION + ")",
      "Generated: " + generatedAt,
      "",
      "මේ ZIP එකේ app backup inventory:",
      "  • schema.sql            — database ව්‍යුහය: tables + RLS + functions (live chat logic ඇතුළුව)",
      "  • database.sql          — සියලු app data: tables " + BACKUP_TABLES.length + "ම (members, voters, settings, emails,",
      "                          board, business, news, gallery, messages, live chat, applications,",
      "                          fuel, f28, activity logs) + සියලු images/photos (base64)",
      "                          + profiles වල තිබෙන credentials මත login recovery SQL",
      "  • site-assets/public/   — site එකේ public files " + siteAssets.length + "ක් (අලුත් phone/location/message",
      "                          icons ඇතුළු සියලු icons + images) — Import එකේදී storage එකට restore වේ",
      "  • site-source/          — අලුත්ම design/update source files " + siteSourceFiles.length + "ක්: globals.css (සියලු CSS),",
      "                          mouse-cursor animation, icon components, mega-menu, hotline cards,",
      "                          loading/speed files, Services fix — package " + (sitePackageVersion || "-"),
      "  • media/                — uploaded Board photos ඇතුළු ගොනු binary පිටපත් (encrypted නම් SQL ඇතුළේ පමණයි)",
      "  • Members-Register.xlsx — සියලු සාමාජික විස්තර (" + members.length + " පේළි)",
      "  • Voters-Register.xlsx  — සියලු ඡන්ද හිමි විස්තර (" + voters.length + " පේළි)",
      "  • Members-Register.csv / Voters-Register.csv — UTF-8 CSV",
      "  • manifest.json         — backup දිනය/version, table row ගණන, file hashes (integrity පරීක්ෂාවට)",
      "  • site-source/BACKUP_INVENTORY_SI.md — සම්පූර්ණ inventory, fixes හා සීමා (සිංහල)",
      "  • RECOVERY.txt          — හදිසි අවස්ථා checklist (site එක තියන තැන් + ගොඩගන්නා හැටි)",
      opts?.encryptPassword
        ? "  🔒 database.sql + uploaded media ENCRYPT වී ඇත. XLSX/CSV/public/source files encrypted නොවේ — ZIP එකත් රහසිගතව තබාගන්න."
        : "  🔒 ඕන නම් ඊළඟ වතාවේ Download කරද්දී Encrypt option එකෙන් password ආරක්ෂාව දාන්න.",
      "",
      "RESTORE කරන විදිහ:",
      "  A) ඒම site එකේම restore කරනවා නම් (සාමාන්‍ය අවස්ථාව):",
      "     Admin → Backup & Restore → Import → මේ ZIP file එකම තෝරන්න → import password එක දෙන්න.",
      "     (දත්ත + settings + images සියල්ල replace වේ; දැනට තියන login accounts ට බලපෑමක් නෑ)",
      "  B) අලුත්ම Supabase project එකකට restore කරනවා නම්:",
      "     1) Supabase SQL Editor එකේ schema.sql එක මුලින්ම run කරන්න",
      "     2) ඊට පස්සේ database.sql එක run කරන්න (login accounts password සහිතවම හැදෙනවා)",
      "     3) Site එකේ env අලුත් project එකට මාරු කර පරණ superadmin password එකෙන්ම login වෙන්න",
      "     4) Admin → Backup & Restore → Import එකෙන් මේ ZIP එක එක් වරක් තෝරන්න (images storage එකට යයි)",
      "",
      "සීමා: මුල් Excel workbook එක server එකේ ගබඩා කර නැත්නම් එහි formatting/macros නොමැත; registers data වලින් නැවත හදයි.",
      "Supabase Auth MFA/sessions/OAuth/provider config, arbitrary other buckets, old backup ZIP files, hosting env/secrets/DNS දත්ත dump එකක් නොවේ.",
      "Fresh project: login recovery සඳහා profiles වල auth_email + password_display තිබිය යුතුයි; නැති ගිණුම් reset/invite කරන්න.",
      "Import එකෙන් database structure/source code/env apply නොවේ: canonical schema.sql run කර source නැවත deploy කළ යුතුයි.",
      "Database writes are not a transaction. Keep the safety ZIP; a failed restore may need recovery from it.",
      "⚠ ආරක්ෂාව: මේ ZIP එකේ user login passwords + Gemini API key අඩංගුයි — ගොනුව රහසිගතව තබා ගන්න!",
      "🌐 Site design එක: මේ ZIP එකේ site-assets/ + site-source/ folders දෙකේ අලුත්ම",
      "   CSS, mouse-cursor animation, icons සහ design source files ටික ඇත. ඒම site",
      "   එකේම Import කළාම දත්ත/settings/images + site icons/images ටික restore වේ",
      "   (දැනට deploy වී ඇති design එක එලෙසම පවතියි). මුල සිටම site එක හදනවා නම්",
      "   GitHub code එක අරගෙන, මේ folders දෙකේ files ටික project එකේ public/ සහ",
      "   src/ තැන්වලට copy කරලා deploy කරන්න. සම්පූර්ණ code එක GitHub repo එකෙත් ඇත;",
      "   Database එකේ functions/logic සියල්ල schema.sql එකේ ඇත.",
    ].join("\n")
  );

  // 5) RECOVERY checklist — හදිසි අවස්ථාවක site එක ගොඩගන්න ඕන හැම තොරතුරක්ම
  await addFile(
    "RECOVERY.txt",
    buildRecoveryChecklist({ generatedAt, supabaseUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "") })
  );

  // 6) manifest.json — version + row counts + file hashes (මේ file එක තමන්වම hash කරන්නේ නෑ)
  let supabaseHost = "";
  try { supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host; } catch { /* empty */ }
  zip.file(
    "manifest.json",
    JSON.stringify(
      buildManifest({
        generatedAt,
        tableCounts,
        imageCount,
        encrypted: !!opts?.encryptPassword,
        supabaseHost,
        schemaSha256,
        databasePlainSha256,
        siteAssetCount: siteAssets.length,
        siteSourceFileCount: siteSourceFiles.length,
        sitePackageVersion,
        files,
      }),
      null,
      2
    )
  );

  onProgress("Creating ZIP archive…", 93);
  return await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 3 } }, (meta) =>
    onProgress("Compressing… " + Math.round(meta.percent) + "%", 93 + Math.round(meta.percent * 0.07))
  );
}
