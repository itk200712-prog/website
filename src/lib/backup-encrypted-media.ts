import { encryptBackupText, decryptBackupText, sha256Hex } from "@/lib/backup-utils";
import { safeMediaPath } from "@/lib/backup-media";
import type { CapturedMedia, MediaAudit } from "@/lib/backup-media-audit";
export const ENCRYPTED_MEDIA_PATH = "encrypted-media/ALL-IMAGES.enc";
function bytes(b64: string) {
  const raw = atob(b64), out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
/** Separate AES-GCM+gzip payload; original SQL bytes remain for backwards-compatible restore. */
export async function encryptMediaPackage(media: CapturedMedia[], audit: MediaAudit, password: string): Promise<string> {
  if (!audit.verified || media.length !== audit.totalFiles) throw new Error("Incomplete media package");
  return encryptBackupText(JSON.stringify({ format: "mpcs-encrypted-media-v1", media, audit }), password);
}
export async function decryptMediaPackage(envelope: string, password: string): Promise<{ media: CapturedMedia[]; audit: MediaAudit }> {
  const value = JSON.parse(await decryptBackupText(envelope, password));
  if (value.format !== "mpcs-encrypted-media-v1" || value.audit?.version !== 1 || !Array.isArray(value.media) || !Array.isArray(value.audit?.files) || !Array.isArray(value.audit?.groups) || !value.audit.verified) throw new Error("Invalid/incomplete encrypted media package");
  const media: CapturedMedia[] = value.media;
  const audit: MediaAudit = value.audit;
  if (media.length !== audit.totalFiles || audit.files.length !== media.length) throw new Error("Encrypted media file count mismatch");
  const expected = new Map(audit.files.map(f => [f.id, f]));
  const paths = new Set<string>(); let totalBytes = 0;
  for (const f of media) {
    if (typeof f.path !== "string" || !safeMediaPath(f.path) || paths.has(f.path) || typeof f.b64 !== "string" || typeof f.type !== "string") throw new Error("Invalid encrypted media entry");
    paths.add(f.path);
    const data = bytes(f.b64), check = expected.get(await sha256Hex(f.path));
    if (!check || data.length !== check.bytes || check.sha256 !== await sha256Hex(data) || check.contentType !== f.type) throw new Error("Encrypted image bytes/hash mismatch");
    totalBytes += data.length;
  }
  if (totalBytes !== audit.totalBytes || audit.groups.some(g => g.missing !== 0 || g.captured !== g.references)) throw new Error("Encrypted media coverage mismatch");
  return { media, audit };
}
export async function verifyMediaPackageMatchesSql(pack: { media: CapturedMedia[]; audit: MediaAudit }, sql: { media: CapturedMedia[]; audit: MediaAudit }): Promise<void> {
  const canonical = (audit: MediaAudit) => JSON.stringify([...audit.files].sort((a,b) => a.id.localeCompare(b.id)));
  if (!sql.audit.verified || canonical(pack.audit) !== canonical(sql.audit) || JSON.stringify(pack.audit.groups) !== JSON.stringify(sql.audit.groups)) throw new Error("Encrypted image package does not match SQL backup bytes/references");
}
