// ============================================================================
// Backup & Restore engine — full-site SQL dump / restore (superadmin only UI)
// Dump  = DDL + INSERTs (all tables, all rows) + site-images base64 (site_images_backup)
// Restore = wipe + re-insert + storage re-upload + URL rewrite (project මාරු වුණත්)
// ============================================================================

import { createClient, authedClient } from "@/lib/supabase/client";

export type BackupTable = { name: string; pk: string };

export const BACKUP_TABLES: BackupTable[] = [
  { name: "profiles", pk: "id" },
  { name: "member_rows", pk: "id" },
  { name: "voter_rows", pk: "id" },
  { name: "data_files", pk: "id" },
  { name: "data_imports", pk: "id" },
  { name: "membership_applications", pk: "id" },
  { name: "board_members", pk: "id" },
  { name: "business_units", pk: "id" },
  { name: "business_services", pk: "id" },
  { name: "business_contacts", pk: "id" },
  { name: "business_branches", pk: "id" },
  { name: "news", pk: "id" },
  { name: "gallery_items", pk: "id" },
  { name: "gallery_comments", pk: "id" },
  { name: "fuel_prices", pk: "type" },
  { name: "system_settings", pk: "key" },
  { name: "messages", pk: "id" },
  { name: "f28_members", pk: "id" },
  { name: "f28_items", pk: "id" },
  { name: "backup_secrets", pk: "key" },
  { name: "site_images_backup", pk: "path" },
];

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
    const sb = createClient();
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
const IMG_RE = /https?:\/\/[^"'\s)]+?\/storage\/v1\/object\/public\/site-images\/([^"'\s?)]+)/g;

async function collectImagePaths(tables: { name: string; rows: Record<string, unknown>[] }[]): Promise<string[]> {
  const paths = new Set<string>();
  for (const t of tables)
    for (const r of t.rows)
      for (const v of Object.values(r))
        if (typeof v === "string") {
          IMG_RE.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = IMG_RE.exec(v))) paths.add(decodeURIComponent(m[1]));
        }
  // bucket list (ට නැති අයින් වූ ගොනුත්)
  try {
    const sb = await authedClient();
    const { data } = await sb.storage.from("site-images").list("", { limit: 1000 });
    for (const f of data ?? []) if (f.name && !f.name.includes("/")) paths.add(f.name);
    // folders
    for (const f of data ?? []) {
      if (f.id === null && f.name) {
        const { data: sub } = await sb.storage.from("site-images").list(f.name, { limit: 1000 });
        for (const g of sub ?? []) if (g.name) paths.add(`${f.name}/${g.name}`);
      }
    }
  } catch { /* listing නැත්නම් scan එකෙන් ආපු ඒවා ඇති */ }
  return [...paths];
}

async function fetchBase64(url: string): Promise<{ b64: string; type: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/jpeg";
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    const CH = 0x8000;
    for (let i = 0; i < buf.length; i += CH) bin += String.fromCharCode(...buf.subarray(i, i + CH));
    return { b64: btoa(bin), type };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------- GENERATE -- */
export async function generateBackupSql(onProgress: (msg: string, pct: number) => void): Promise<string> {
  const sb = await authedClient();
  const lines: string[] = [];

  lines.push(`-- ============================================================`);
  lines.push(`-- Panduwasnuwara New MPCS — FULL SITE BACKUP`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- Restore (fresh Supabase): run this file in SQL Editor,`);
  lines.push(`--   then use Admin → Backup & Restore → Import with this file`);
  lines.push(`--   to re-upload images to storage.`);
  lines.push(`-- ============================================================`);
  lines.push(``);
  lines.push(`create extension if not exists "pgcrypto";`);
  lines.push(``);

  onProgress("Reading table schemas…", 5);
  const schemaCols = await fetchSchemaCols(BACKUP_TABLES);

  // gather rows
  const gathered: { name: string; rows: Record<string, unknown>[] }[] = [];
  for (let i = 0; i < BACKUP_TABLES.length; i++) {
    const t = BACKUP_TABLES[i];
    onProgress(`Exporting ${t.name}…`, 8 + Math.round((i / BACKUP_TABLES.length) * 40));
    try {
      const { data, error } = await sb.from(t.name).select("*").limit(100000);
      if (error) {
        lines.push(`-- ⚠ ${t.name}: ${error.message}`);
        continue;
      }
      gathered.push({ name: t.name, rows: (data as Record<string, unknown>[]) ?? [] });
    } catch (e) {
      lines.push(`-- ⚠ ${t.name}: ${(e as Error).message}`);
    }
  }

  // DDL
  onProgress("Writing table DDL…", 50);
  lines.push(`-- ------------------------------- TABLES -------------------------------`);
  for (const t of BACKUP_TABLES) {
    lines.push(ddlFor(t, schemaCols[t.name] ?? []));
    lines.push(``);
  }

  // images
  onProgress("Downloading site images…", 55);
  const paths = await collectImagePaths(gathered);
  const imgRows: { path: string; b64: string; type: string }[] = [];
  for (let i = 0; i < paths.length; i++) {
    onProgress(`Image ${i + 1}/${paths.length} — ${paths[i].slice(0, 40)}…`, 55 + Math.round((i / Math.max(paths.length, 1)) * 30));
    const url = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/public/site-images/${paths[i]}`;
    const f = await fetchBase64(url);
    if (f) imgRows.push({ path: paths[i], b64: f.b64, type: f.type });
  }

  // image INSERTs
  lines.push(`-- ------------------------------- IMAGES -------------------------------`);
  for (const im of imgRows) {
    lines.push(`INSERT INTO public.site_images_backup (path, data_base64, content_type) VALUES (${sqlVal(im.path)}, ${sqlVal(im.b64)}, ${sqlVal(im.type)}) ON CONFLICT (path) DO UPDATE SET data_base64 = EXCLUDED.data_base64, content_type = EXCLUDED.content_type;`);
  }
  lines.push(``);

  // row INSERTs
  onProgress("Writing data rows…", 88);
  lines.push(`-- ------------------------------- DATA ---------------------------------`);
  for (const t of gathered) {
    const pk = BACKUP_TABLES.find((x) => x.name === t.name)!.pk;
    lines.push(`-- ${t.name} (${t.rows.length} rows)`);
    for (const r of t.rows) {
      const cols = Object.keys(r);
      if (!cols.length) continue;
      const sets = cols.filter((c) => c !== pk).map((c) => `${colName(c)} = EXCLUDED.${colName(c)}`).join(", ");
      lines.push(
        `INSERT INTO public.${t.name} (${cols.map(colName).join(", ")}) VALUES (${cols.map((c) => sqlVal(r[c])).join(", ")})` +
          (sets ? ` ON CONFLICT (${colName(pk)}) DO UPDATE SET ${sets};` : ` ON CONFLICT (${colName(pk)}) DO NOTHING;`)
      );
    }
    lines.push(``);
  }

  onProgress("Backup ready ✅", 100);
  return lines.join("\n");
}

/* --------------------------------------------------------------- PARSE --- */
export type ParsedInsert = { table: string; cols: string[]; values: unknown[] };

function parseValueTuple(s: string): unknown[] {
  const out: unknown[] = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /[\s,]/.test(s[i])) i++;
    if (i >= s.length) break;
    if (s[i] === "'") {
      let v = "";
      i++;
      while (i < s.length) {
        if (s[i] === "'" && s[i + 1] === "'") { v += "'"; i += 2; continue; }
        if (s[i] === "'") { i++; break; }
        v += s[i++];
      }
      out.push(v);
    } else if (s.slice(i, i + 4).toUpperCase() === "NULL" && !/[\w]/.test(s[i + 4] ?? " ")) {
      out.push(null);
      i += 4;
    } else if (s.slice(i, i + 4).toUpperCase() === "TRUE" && !/[\w]/.test(s[i + 4] ?? " ")) {
      out.push(true);
      i += 4;
    } else if (s.slice(i, i + 5).toUpperCase() === "FALSE" && !/[\w]/.test(s[i + 5] ?? " ")) {
      out.push(false);
      i += 5;
    } else {
      let j = i;
      while (j < s.length && !/[\s,)]/.test(s[j])) j++;
      const n = Number(s.slice(i, j));
      out.push(Number.isFinite(n) ? n : s.slice(i, j));
      i = j;
    }
    while (i < s.length && /[\s,]/.test(s[i])) i++;
  }
  return out;
}

export function parseBackupSql(sql: string): ParsedInsert[] {
  const out: ParsedInsert[] = [];
  const re = /INSERT\s+INTO\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*VALUES\s*\(/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const table = m[1];
    const cols = m[2].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    // find matching close paren of VALUES tuple
    let i = re.lastIndex;
    let depth = 1;
    let inStr = false;
    while (i < sql.length && depth > 0) {
      const ch = sql[i];
      if (inStr) {
        if (ch === "'") {
          if (sql[i + 1] === "'") i++;
          else inStr = false;
        }
      } else {
        if (ch === "'") inStr = true;
        else if (ch === "(") depth++;
        else if (ch === ")") depth--;
      }
      i++;
    }
    const tuple = sql.slice(re.lastIndex, i - 1);
    out.push({ table, cols, values: parseValueTuple(tuple) });
    re.lastIndex = i;
  }
  return out;
}

/* -------------------------------------------------------------- RESTORE -- */
export async function restoreBackup(
  inserts: ParsedInsert[],
  onProgress: (msg: string, pct: number) => void
): Promise<{ restored: Record<string, number>; errors: string[] }> {
  const sb = await authedClient();
  const restored: Record<string, number> = {};
  const errors: string[] = [];

  const byTable = new Map<string, Record<string, unknown>[]>();
  for (const ins of inserts) {
    const row: Record<string, unknown> = {};
    ins.cols.forEach((c, i) => (row[c] = ins.values[i] ?? null));
    if (!byTable.has(ins.table)) byTable.set(ins.table, []);
    byTable.get(ins.table)!.push(row);
  }

  // 1) storage images first (URL rewrite එකට)
  onProgress("Restoring images to storage…", 5);
  const imgRows = byTable.get("site_images_backup") ?? [];
  const urlMap = new Map<string, string>(); // old url -> new url
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  for (let i = 0; i < imgRows.length; i++) {
    const r = imgRows[i];
    onProgress(`Image ${i + 1}/${imgRows.length} — ${String(r.path).slice(0, 40)}…`, 5 + Math.round((i / Math.max(imgRows.length, 1)) * 25));
    try {
      const b64 = String(r.data_base64 ?? "");
      const bin = atob(b64);
      const buf = new Uint8Array(bin.length);
      for (let j = 0; j < bin.length; j++) buf[j] = bin.charCodeAt(j);
      const blob = new Blob([buf], { type: String(r.content_type || "image/jpeg") });
      const { error } = await sb.storage.from("site-images").upload(String(r.path), blob, { upsert: true });
      if (error) throw new Error(error.message);
      const { data: pub } = sb.storage.from("site-images").getPublicUrl(String(r.path));
      const newUrl = pub?.publicUrl ?? "";
      // පරණ URL (backup rows වල තිබ්බ ඕන එකක්) path එකෙන් හඳුනාගමු — පස්සේ rewrite එකට
      if (newUrl) urlMap.set(String(r.path), newUrl);
    } catch (e) {
      errors.push(`image ${r.path}: ${(e as Error).message}`);
    }
  }

  // old URL patterns -> path mapping (rows වල තියෙන https://xxx/site-images/<path>)
  const pathOldUrl = new Map<string, string>(); // path -> old url found in data
  for (const [, rows] of byTable)
    for (const r of rows)
      for (const v of Object.values(r))
        if (typeof v === "string") {
          IMG_RE.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = IMG_RE.exec(v))) pathOldUrl.set(decodeURIComponent(m[1]), v.slice(m.index, m.index + m[0].length));
        }

  function rewrite(val: unknown): unknown {
    if (typeof val !== "string") return val;
    let s = val;
    for (const [path, newUrl] of urlMap) {
      const oldUrl = pathOldUrl.get(path);
      if (oldUrl && oldUrl !== newUrl) s = s.split(oldUrl).join(newUrl);
    }
    return s;
  }

  // 2) wipe + insert each table (order: BACKUP_TABLES order — profiles first)
  const ordered = BACKUP_TABLES.filter((t) => byTable.has(t.name));
  for (let i = 0; i < ordered.length; i++) {
    const t = ordered[i];
    const rows = byTable.get(t.name)!.map((r) => {
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) o[k] = rewrite(v);
      return o;
    });
    onProgress(`Restoring ${t.name} (${rows.length} rows)…`, 30 + Math.round((i / ordered.length) * 65));
    try {
      await sb.from(t.name).delete().neq(t.pk, "__backup_wipe__");
    } catch { /* empty */ }
    for (let j = 0; j < rows.length; j += 200) {
      const { error } = await sb.from(t.name).upsert(rows.slice(j, j + 200), { onConflict: t.pk });
      if (error) {
        errors.push(`${t.name}: ${error.message}`);
        break;
      }
    }
    restored[t.name] = rows.length;
  }

  onProgress("Restore complete ✅", 100);
  return { restored, errors };
}

/* ------------------------------------------------------------- SECRETS --- */
export async function getBackupSecrets(): Promise<{ download: string; importPw: string } | null> {
  const sb = await authedClient();
  const { data, error } = await sb.from("backup_secrets").select("key, value");
  if (error || !data) return null;
  const map = new Map(data.map((r: { key: string; value: string }) => [r.key, r.value]));
  return {
    download: map.get("backup_download_password") ?? "",
    importPw: map.get("backup_import_password") ?? "",
  };
}

export async function setBackupSecret(key: "backup_download_password" | "backup_import_password", value: string) {
  const sb = await authedClient();
  const { error } = await sb.from("backup_secrets").upsert({ key, value }, { onConflict: "key" });
  return error ? error.message : null;
}
