// ============================================================================
// Backup utilities — pure helpers (supabase මත රඳා පවතින්නේ නෑ, test කළ හැක)
//  · SQL parse (restore preview/verify එකට)
//  · SHA-256 hashes (manifest integrity)
//  · Password encryption (AES-GCM + PBKDF2 — WebCrypto)
//  · Manifest + RECOVERY checklist builders
// ============================================================================

/** v3 = දත්ත වලට අමතරව site design/update package එකත් (public icons/images
 *  `site-assets/` + CSS/cursor source files `site-source/`) ZIP එකට ඇතුළත් වේ. */
export const BACKUP_FORMAT_VERSION = 3;
/** Backup History එකේ තබා ගන්නේ අලුත්ම සටහන් 5 විතරයි — පරණ ඒවා auto-delete වේ. */
export const BACKUP_HISTORY_KEEP = 5;
export const ENCRYPTED_PREFIX = "MPCS-ENCRYPTED-BACKUP v1";
/** v2 = gzip කරලා encrypt කරනවා — file එක ~4 ගුණයකින් කුඩායි (auto-backup timeout නැති වෙන්න) */
export const ENCRYPTED_PREFIX_V2 = "MPCS-ENCRYPTED-BACKUP v2";

/* --------------------------------------------------------------- PARSE --- */
export type ParsedInsert = { table: string; cols: string[]; values: unknown[] };

/** Latest `keep` ගාණෙන් පිටත තියෙන Backup History row IDs (auto-delete කරන්න). */
export function backupHistoryIdsToPrune<T extends { id: string; created_at: string }>(
  entries: readonly T[],
  keep: number = BACKUP_HISTORY_KEEP
): string[] {
  const safeKeep = Math.max(0, Math.floor(Number.isFinite(keep) ? keep : BACKUP_HISTORY_KEEP));
  return [...entries]
    .filter((e) => typeof e?.id === "string" && e.id)
    .sort((a, b) => {
      const byTime = Date.parse(b.created_at) - Date.parse(a.created_at);
      return Number.isFinite(byTime) && byTime !== 0 ? byTime : String(b.id).localeCompare(String(a.id));
    })
    .slice(safeKeep)
    .map((e) => e.id);
}

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

/** Import preview එකට — table එකින් එක row ගණන */
export function summarizeInserts(inserts: ParsedInsert[]): { tables: { name: string; rows: number }[]; totalRows: number } {
  const map = new Map<string, number>();
  for (const ins of inserts) map.set(ins.table, (map.get(ins.table) ?? 0) + 1);
  const tables = [...map.entries()].map(([name, rows]) => ({ name, rows }));
  return { tables, totalRows: inserts.length };
}

/* ---------------------------------------------------------------- HASH --- */
function bytesToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(data: string | ArrayBuffer | Uint8Array): Promise<string> {
  const buf = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", buf instanceof Uint8Array ? (buf.buffer as ArrayBuffer) : buf);
  return bytesToHex(digest);
}

/* ------------------------------------------------------------ ENCRYPTION - */
function u8ToB64(u8: Uint8Array): string {
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) bin += String.fromCharCode(...u8.subarray(i, i + CH));
  return btoa(bin);
}

function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations: 150_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export function isEncryptedBackupText(text: string): boolean {
  const t = text.trimStart();
  return t.startsWith(ENCRYPTED_PREFIX) || t.startsWith(ENCRYPTED_PREFIX_V2);
}

/** native gzip (browser + Node දෙකේම තියෙනවා) — නැත්නම් null (v1 fallback එකට) */
async function gzipBytes(input: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  const stream = new Blob([input.buffer as ArrayBuffer]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzipBytes(input: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("මේ browser එකේ v2 encrypted backup එක අරින්න බෑ — අලුත් Chrome එකක් පාවිච්චි කරන්න");
  }
  const stream = new Blob([input.buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** database.sql text එක password එකකින් encrypt කරයි (v2: gzip → AES-GCM) */
export async function encryptBackupText(plain: string, password: string): Promise<string> {
  if (!password) throw new Error("Encryption password එකක් අවශ්‍යයි");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const plainBytes = new TextEncoder().encode(plain);
  const gz = await gzipBytes(plainBytes).catch(() => null);
  const payload = gz ?? plainBytes;
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    payload.buffer as ArrayBuffer
  );
  const prefix = gz ? ENCRYPTED_PREFIX_V2 : ENCRYPTED_PREFIX;
  return `${prefix}\n${u8ToB64(salt)}.${u8ToB64(iv)}.${u8ToB64(new Uint8Array(cipher))}`;
}

/** encrypt කරපු backup එක ආපහු plain SQL එකට හරවයි (v1 + v2 දෙකම) — password වැරදි නම් throw කරයි */
export async function decryptBackupText(envelope: string, password: string): Promise<string> {
  const lines = envelope.trim().split(/\r?\n/);
  const isV2 = !!lines[0]?.startsWith(ENCRYPTED_PREFIX_V2);
  if ((!isV2 && !lines[0]?.startsWith(ENCRYPTED_PREFIX)) || !lines[1]) throw new Error("මේක encrypted backup file එකක් නෙවෙයි");
  const [saltB64, ivB64, dataB64] = lines[1].split(".");
  if (!saltB64 || !ivB64 || !dataB64) throw new Error("Encrypted backup එක corrupt වී ඇත");
  const key = await deriveKey(password, b64ToU8(saltB64));
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToU8(ivB64).buffer as ArrayBuffer }, key, b64ToU8(dataB64).buffer as ArrayBuffer);
  } catch {
    throw new Error("Encryption password එක වැරදියි (හෝ file එක corrupt)");
  }
  const bytes = isV2 ? await gunzipBytes(new Uint8Array(plain)) : new Uint8Array(plain);
  return new TextDecoder().decode(bytes);
}

/* ------------------------------------------------------------- MANIFEST -- */
export interface BackupManifest {
  app: string;
  formatVersion: number;
  generatedAt: string;
  encrypted: boolean;
  supabaseHost: string;
  tableCounts: Record<string, number>;
  totalRows: number;
  imageCount: number;
  schemaSha256: string;
  databasePlainSha256: string;
  /** Format v3: ZIP එකේ `site-assets/public/` යටතේ යන public files ගාණ (icons ඇතුළුව) */
  siteAssetCount?: number;
  /** Format v3: ZIP එකේ `site-source/` යටතේ යන design/update source files ගාණ (CSS/cursor ඇතුළුව) */
  siteSourceFileCount?: number;
  /** Format v3: site design package එකේ version ලකුණ */
  sitePackageVersion?: string;
  files: Record<string, { sha256: string; size: number }>;
}

export function buildManifest(input: {
  generatedAt: string;
  tableCounts: Record<string, number>;
  imageCount: number;
  encrypted: boolean;
  supabaseHost: string;
  schemaSha256: string;
  databasePlainSha256: string;
  siteAssetCount?: number;
  siteSourceFileCount?: number;
  sitePackageVersion?: string;
  files: Record<string, { sha256: string; size: number }>;
}): BackupManifest {
  return {
    app: "Panduwasnuwara New MPCS — Full Site Backup",
    formatVersion: BACKUP_FORMAT_VERSION,
    generatedAt: input.generatedAt,
    encrypted: input.encrypted,
    supabaseHost: input.supabaseHost,
    tableCounts: input.tableCounts,
    totalRows: Object.values(input.tableCounts).reduce((a, b) => a + b, 0),
    imageCount: input.imageCount,
    schemaSha256: input.schemaSha256,
    databasePlainSha256: input.databasePlainSha256,
    siteAssetCount: input.siteAssetCount ?? 0,
    siteSourceFileCount: input.siteSourceFileCount ?? 0,
    sitePackageVersion: input.sitePackageVersion ?? "",
    files: input.files,
  };
}

/* ---------------------------------------------------- RECOVERY CHECKLIST - */
export function buildRecoveryChecklist(opts: { generatedAt: string; supabaseUrl: string }): string {
  return [
    "════════════════════════════════════════════════════════════════════",
    "  Panduwasnuwara New MPCS — RECOVERY CHECKLIST (හදිසි අවස්ථාවකට)",
    "  Generated: " + opts.generatedAt,
    "════════════════════════════════════════════════════════════════════",
    "",
    "■ Site එක තියෙන තැන් (values නෙවෙයි — තැන් විතරයි):",
    "  • Live website : https://website-blond-eta-94.vercel.app",
    "  • Code (GitHub): https://github.com/itk200712-prog/website",
    "  • Hosting      : Vercel (GitHub main branch එකට push කළාම auto-deploy වේ)",
    "  • Database     : Supabase — " + (opts.supabaseUrl || "(.env එකේ NEXT_PUBLIC_SUPABASE_URL)"),
    "  • Email යවන්නේ: FormSubmit (formsubmit.co) — ලැබෙන inbox ලැයිස්තුව",
    "                   Admin → Emails සහ Admin → Settings වල ඇත.",
    "                   අලුත් inbox එකක් දැම්මොත් මුලින්ම ඒ inbox එකට එන",
    "                   activation email එක click කළ යුතුමයි.",
    "",
    "■ Site එක දුවන්න අවශ්‍ය env keys (Vercel → Settings → Environment):",
    "  • NEXT_PUBLIC_SUPABASE_URL",
    "  • NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "  • SUPABASE_SERVICE_ROLE_KEY — Baymax AI + Admin password reset සඳහා",
    "    අවශ්‍ය server-only key එක (Supabase → Project Settings → API).",
    "    මෙය කවදාවත් NEXT_PUBLIC_ නමින් දාන්න එපා, කිසිවෙකුට පෙන්වන්න එපා.",
    "  • GEMINI_API_KEY (විකල්පයි) — සාමාන්‍යයෙන් Admin → Live Chat එකෙන්",
    "    save කරන key එක backup_secrets එකේ restore වේ; එය නැත්නම් විතරක් මේ env එකෙන් දෙන්න.",
    "",
    "■ මුල සිටම site එක ගොඩගන්නා ආකාරය (Disaster recovery):",
    "  1) GitHub එකෙන් code එක ගන්න (හෝ Vercel එකේ දැනටමත් deploy වී ඇත්නම් එපා).",
    "     මේ ZIP එකේ site-assets/public/ එකේ public icons/images ටිකත්,",
    "     site-source/ එකේ CSS/mouse-cursor ඇතුළු අලුත්ම design source files",
    "     ටිකත් ඇත — code එක නැවත හදන විට එම folders දෙකේ files ටික",
    "     project එකේ අදාළ තැන්වලට (public/ සහ src/) copy කරන්න.",
    "  2) අලුත් Supabase project එකක් හදන්න (supabase.com — free පුළුවන්)",
    "  3) Supabase SQL Editor එකේ මේ ZIP එකේ schema.sql එක run කරන්න",
    "  4) ඊට පස්සේ database.sql එක run කරන්න (login accounts password සහිතව)",
    "     — database.sql එක encrypt වී ඇත්නම් මුලින්ම Admin → Import එකෙන්",
    "       password එක දී decrypt කරගත යුතුයි (එයින්ම restore ද වේ)",
    "  5) Vercel env keys (URL + anon + SUPABASE_SERVICE_ROLE_KEY) අලුත් Supabase එකට මාරු කර Redeploy කරන්න",
    "  6) පරණ superadmin password එකෙන් login වී Admin → Backup → Import",
    "     එකෙන් මේ ZIP එක එක් වරක් තෝරන්න (images storage එකට යනවා)",
    "  7) Admin → Emails වල inbox ටික හරිද බලන්න; අලුත් inbox ඇත්නම්",
    "     FormSubmit activation එක කරන්න",
    "  8) Admin → Live Chat එකෙන් Baymax AI Test එක කරන්න (Gemini key එක",
    "     backup_secrets එකෙන් restore වී තිබේ). Original Super Admin ලකුණ",
    "     (profiles.is_root_admin) ද backup එකෙන් එන බැවින් admin-ආරක්ෂණ",
    "     නීති ඒ ආකාරයෙන්ම පවතියි.",
    "",
    "■ Test Restore (අවුරුද්දකට වරක්වත් අනිවාර්යයෙන් කරන්න):",
    "  ඉහත 2–4 පියවර අතුරු Supabase project එකක කරලා, සාමාජිකයෙක් search",
    "  කරලා + login වෙලා බලන්න. පරීක්ෂා නොකළ backup එකක් විශ්වාස කරන්න බෑ.",
    "",
    "■ Scheduled auto-backup (විකල්ප):",
    "  Admin → Backup & Restore එකේ Scheduled card එකෙන් දවස් ගාණ (උදා: 3/7)",
    "  සහ වෙලාව තෝරලා Save කරන්න. එම card එකේම ඇති SQL එක Supabase SQL",
    "  Editor එකේ එක වරක් run කළාම, නියමිත දවසේ ඒ වෙලාවට මේ FULL ZIP",
    "  backup එකම (schema + logins + images + registers) Supabase",
    "  'backups' bucket එකට සහ/හෝ MEGA එකට ඉබේම යනවා.",
    "",
    "■ Supabase Pro ($25/මාසෙට) ගත්තා නම් දෛනික auto-backups + point-in-time",
    "  recovery ලැබෙනවා — මේ ZIP backup එකට අමතර දෙවෙනි ආරක්ෂාවක් ලෙස හොඳයි.",
    "",
    "■ ආරක්ෂාව:",
    "  • මේ ZIP එකේ login passwords + Gemini API key (backup_secrets) ඇත — පිටපත් 3ක් තැන් 2ක තියාගන්න",
    "    (උදා: Office PC + Pen drive + Google Drive), පිට අයට දෙන්න එපා.",
    "  • Backup download/import/encryption passwords තුනම ඇත්තේ Admin → Backup පිටුවේය",
    "    (superadmin ට පමණක් පෙනේ) — ඒවාද database.sql එකේ backup_secrets",
    "    table එකේ සුරැකේ.",
    "════════════════════════════════════════════════════════════════════",
  ].join("\n");
}
