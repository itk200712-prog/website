import { MEDIA_INDEX_PATH, scanMediaReferences, mediaArchivePath } from "@/lib/backup-media";
import { sha256Hex, type ParsedInsert } from "@/lib/backup-utils";
export type CapturedMedia = { path: string; b64: string; type: string };
export type MediaAudit = { version: 1; verified: boolean; totalFiles: number; totalBytes: number;
  groups: { category: string; references: number; captured: number; missing: number }[];
  files: { id: string; bytes: number; sha256: string; contentType: string }[] };
function decode(b64: string): Uint8Array {
  const s = atob(b64), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
/** Object stores sometimes return application/octet-stream for valid uploaded images. */
export function capturedMediaType(file: CapturedMedia): string {
  if (/^image\//i.test(file.type)) return file.type;
  if (file.type && !/^(?:application\/octet-stream|binary\/octet-stream)$/i.test(file.type)) return file.type;
  const head = atob(file.b64.slice(0, 1024));
  if (head.startsWith("\x89PNG\r\n\x1a\n")) return "image/png";
  if (head.startsWith("\xff\xd8\xff")) return "image/jpeg";
  if (/^GIF8[79]a/.test(head)) return "image/gif";
  if (head.startsWith("RIFF") && head.slice(8,12) === "WEBP") return "image/webp";
  if (head.slice(4,8) === "ftyp" && /avif|avis/.test(head.slice(8,32))) return "image/avif";
  if (/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(head)) return "image/svg+xml";
  const ext = file.path.split(".").pop()?.toLowerCase();
  return ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", avif: "image/avif", gif: "image/gif", svg: "image/svg+xml", bmp: "image/bmp", ico: "image/x-icon" } as Record<string,string>)[ext ?? ""] ?? file.type ?? "application/octet-stream";
}
export function inlineMedia(source: string): { b64: string; type: string } | null {
  const m = source.match(/^data:((?:image|audio|video|font)\/[a-z0-9.+-]+|application\/pdf)(;base64)?,([\s\S]*)$/i);
  if (!m) return null;
  const bytes = m[2] ? decode(m[3].replace(/\s/g, "")) : new TextEncoder().encode(decodeURIComponent(m[3]));
  let raw = "";
  for (let i = 0; i < bytes.length; i += 0x8000) raw += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { type: m[1].toLowerCase(), b64: btoa(raw) };
}
export async function inlineMediaPath(source: string): Promise<string> {
  const file = inlineMedia(source);
  if (!file) throw new Error("Invalid inline media");
  const ext = ({ "image/jpeg": "jpg", "image/svg+xml": "svg" } as Record<string, string>)[file.type] ?? file.type.split("/")[1].replace(/[^a-z0-9]/g, "");
  return `inline-media/${await sha256Hex(source)}.${ext}`;
}
function category(table: string, row: Record<string, unknown>): string {
  if (table === "board_members") return "board";
  if (table === "system_settings" && row.key === "chat_bot_avatar") return "bot";
  if (table === "system_settings" && /animation|template/i.test(String(row.key ?? ""))) return "templates";
  return "other";
}
export async function auditCapturedMedia(tables: { name: string; rows: Record<string, unknown>[] }[], media: CapturedMedia[], aliases: ReadonlyMap<string, string>, publicPaths: readonly string[]): Promise<MediaAudit> {
  const byPath = new Map(media.map((m) => [m.path, m]));
  const groups = new Map<string, { category: string; references: number; captured: number; missing: number }>();
  for (const name of ["board", "bot", "templates", "other"]) groups.set(name, { category: name, references: 0, captured: 0, missing: 0 });
  for (const table of tables.filter((t) => t.name !== "site_images_backup")) for (const row of table.rows) {
    const group = groups.get(category(table.name, row))!;
    for (const ref of scanMediaReferences(row, publicPaths)) {
      group.references++;
      const inline = inlineMedia(ref.source);
      const path = aliases.get(ref.source) ?? mediaArchivePath(ref) ?? (inline ? await inlineMediaPath(ref.source) : undefined);
      // Inline bytes are already in the data row in older backups, too.
      const file = path ? byPath.get(path) : undefined;
      if ((file && decode(file.b64).length > 0) || (inline && decode(inline.b64).length > 0)) group.captured++; else group.missing++;
    }
  }
  const files: MediaAudit["files"] = [];
  let totalBytes = 0;
  for (const file of media) {
    const bytes = decode(file.b64);
    totalBytes += bytes.length;
    // Do not leak object names, old signed URLs or personal fields in a plaintext
    // inventory accompanying an encrypted SQL backup.
    files.push({ id: await sha256Hex(file.path), bytes: bytes.length, sha256: await sha256Hex(bytes), contentType: file.type });
  }
  return { version: 1, verified: [...groups.values()].every((g) => g.missing === 0), totalFiles: media.length, totalBytes, groups: [...groups.values()], files };
}

/** Inspect/decrypt happens locally. Reading this must NEVER restore the database. */
export async function inspectBackupMedia(inserts: ParsedInsert[], publicPaths: readonly string[] = []): Promise<{ audit: MediaAudit; media: CapturedMedia[] }> {
  const tables = new Map<string, Record<string, unknown>[]>();
  const media = new Map<string, CapturedMedia>();
  const aliases = new Map<string, string>();
  for (const insert of inserts) {
    const row = Object.fromEntries(insert.cols.map((col, i) => [col, insert.values[i]]));
    if (!tables.has(insert.table)) tables.set(insert.table, []);
    tables.get(insert.table)!.push(row);
    if (insert.table === "site_images_backup") {
      if (row.path === MEDIA_INDEX_PATH) {
        const parsed = JSON.parse(new TextDecoder().decode(decode(String(row.data_base64 ?? ""))));
        for (const [source, path] of Object.entries(parsed)) if (typeof path === "string") aliases.set(source, path);
      } else if (typeof row.path === "string" && typeof row.data_base64 === "string" && !media.has(row.path)) {
        decode(row.data_base64); // corrupt base64 must not pass verification
        media.set(row.path, { path: row.path, b64: row.data_base64, type: String(row.content_type ?? "application/octet-stream") });
      }
    }
  }
  for (const [name, rows] of tables) if (name !== "site_images_backup") for (const row of rows) for (const ref of scanMediaReferences(row, publicPaths)) {
    const inline = inlineMedia(ref.source);
    if (inline) { const path = await inlineMediaPath(ref.source); if (!media.has(path)) media.set(path, { path, ...inline }); }
  }
  const list = [...media.values()];
  return { media: list, audit: await auditCapturedMedia([...tables].map(([name, rows]) => ({ name, rows })), list, aliases, publicPaths) };
}
