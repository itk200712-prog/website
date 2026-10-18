// ============================================================================
// Backup utilities — pure helpers (supabase මත රඳා පවතින්නේ නෑ, test කළ හැක)
//  · SQL parse (restore preview/verify එකට)
//  · SHA-256 hashes (manifest integrity)
//  · Password encryption (AES-GCM + PBKDF2 — WebCrypto)
//  · Manifest + RECOVERY checklist builders
// ============================================================================

export const BACKUP_FORMAT_VERSION = 2;
export const ENCRYPTED_PREFIX = "MPCS-ENCRYPTED-BACKUP v1";

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
  return text.trimStart().startsWith(ENCRYPTED_PREFIX);
}

/** database.sql text එක password එකකින් encrypt කරයි (AES-GCM) */
export async function encryptBackupText(plain: string, password: string): Promise<string> {
  if (!password) throw new Error("Encryption password එකක් අවශ්‍යයි");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv.buffer as ArrayBuffer }, key, new TextEncoder().encode(plain));
  return `${ENCRYPTED_PREFIX}\n${u8ToB64(salt)}.${u8ToB64(iv)}.${u8ToB64(new Uint8Array(cipher))}`;
}

/** encrypt කරපු backup එක ආපහු plain SQL එකට හරවයි — password වැරදි නම් throw කරයි */
export async function decryptBackupText(envelope: string, password: string): Promise<string> {
  const lines = envelope.trim().split(/\r?\n/);
  if (!lines[0]?.startsWith(ENCRYPTED_PREFIX) || !lines[1]) throw new Error("මේක encrypted backup file එකක් නෙවෙයි");
  const [saltB64, ivB64, dataB64] = lines[1].split(".");
  if (!saltB64 || !ivB64 || !dataB64) throw new Error("Encrypted backup එක corrupt වී ඇත");
  const key = await deriveKey(password, b64ToU8(saltB64));
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToU8(ivB64).buffer as ArrayBuffer }, key, b64ToU8(dataB64).buffer as ArrayBuffer);
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error("Encryption password එක වැරදියි (හෝ file එක corrupt)");
  }
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
    "  (මේ දෙක විතරයි — service-role key එකක් site එකට ඕන නෑ)",
    "",
    "■ මුල සිටම site එක ගොඩගන්නා ආකාරය (Disaster recovery):",
    "  1) GitHub එකෙන් code එක ගන්න (හෝ Vercel එකේ දැනටමත් deploy වී ඇත්නම් එපා)",
    "  2) අලුත් Supabase project එකක් හදන්න (supabase.com — free පුළුවන්)",
    "  3) Supabase SQL Editor එකේ මේ ZIP එකේ schema.sql එක run කරන්න",
    "  4) ඊට පස්සේ database.sql එක run කරන්න (login accounts password සහිතව)",
    "     — database.sql එක encrypt වී ඇත්නම් මුලින්ම Admin → Import එකෙන්",
    "       password එක දී decrypt කරගත යුතුයි (එයින්ම restore ද වේ)",
    "  5) Vercel env keys දෙක අලුත් Supabase එකට මාරු කර Redeploy කරන්න",
    "  6) පරණ superadmin password එකෙන් login වී Admin → Backup → Import",
    "     එකෙන් මේ ZIP එක එක් වරක් තෝරන්න (images storage එකට යනවා)",
    "  7) Admin → Emails වල inbox ටික හරිද බලන්න; අලුත් inbox ඇත්නම්",
    "     FormSubmit activation එක කරන්න",
    "",
    "■ Test Restore (අවුරුද්දකට වරක්වත් අනිවාර්යයෙන් කරන්න):",
    "  ඉහත 2–4 පියවර අතුරු Supabase project එකක කරලා, සාමාජිකයෙක් search",
    "  කරලා + login වෙලා බලන්න. පරීක්ෂා නොකළ backup එකක් විශ්වාස කරන්න බෑ.",
    "",
    "■ Scheduled auto-backup (විකල්ප, උසස්):",
    "  Repo එකේ supabase/functions/scheduled-backup + supabase/scheduled-backup.sql",
    "  ඇත. සක්‍රිය කරන්න: supabase functions deploy scheduled-backup;",
    "  BACKUP_CRON_SECRET secret එක දාන්න; scheduled-backup.sql එකේ රහස්/URL",
    "  පුරවා run කරන්න. එවිට සතියකට වරක් data-only backup එකක් 'backups'",
    "  bucket එකට ඉබේම වැටේ. (images සහිත සම්පූර්ණ backup එකකට මේ ZIP එකයි)",
    "",
    "■ Supabase Pro ($25/මාසෙට) ගත්තා නම් දෛනික auto-backups + point-in-time",
    "  recovery ලැබෙනවා — මේ ZIP backup එකට අමතර දෙවෙනි ආරක්ෂාවක් ලෙස හොඳයි.",
    "",
    "■ ආරක්ෂාව:",
    "  • මේ ZIP එකේ login passwords ඇත — පිටපත් 3ක් තැන් 2ක තියාගන්න",
    "    (උදා: Office PC + Pen drive + Google Drive), පිට අයට දෙන්න එපා.",
    "  • Backup download/import passwords දෙක ඇත්තේ Admin → Backup පිටුවේය",
    "    (superadmin ට පමණක් පෙනේ) — ඒවාද database.sql එකේ backup_secrets",
    "    table එකේ සුරැකේ.",
    "════════════════════════════════════════════════════════════════════",
  ].join("\n");
}
