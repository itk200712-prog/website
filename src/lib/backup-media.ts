// Shared, browser-safe media discovery/rewriting. Never fetch an arbitrary URL here.
export const MEDIA_INDEX_PATH = "__backup_media_index__.json";
export type MediaRef = { source: string; bucket?: string; key?: string; local?: string };
const MEDIA_EXT = /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp|pdf|docx?|xlsx?|csv|mp4|webm|mp3|wav)(?:[?#]|$)/i;
const MEDIA_FIELD = /(?:photo|image|avatar|logo|icon|banner|thumbnail|letterhead|attachment|document|file_url|video|audio|products|background|watermark|cover|src)/i;
const TOKENS = /(?:https?:\/\/|\/\/|\/storage\/v1\/)[^\s"'<>\\)]+/g;

export function safeMediaPath(path: string): boolean {
  return !!path && !path.startsWith("/") && !/[\x00-\x1f\\]/.test(path) &&
    path.split("/").every((p) => !!p && p !== "." && p !== "..");
}

export function storageMediaRef(source: string): MediaRef | null {
  try {
    const u = new URL(source.startsWith("//") ? `https:${source}` : source, "https://relative.invalid");
    const m = u.pathname.match(/^\/storage\/v1\/(?:object\/(?:public|sign|authenticated)|render\/image\/(?:public|sign|authenticated))\/([^/]+)\/(.+)$/);
    if (!m) return null;
    const bucket = decodeURIComponent(m[1]);
    const key = decodeURIComponent(m[2]);
    if (!safeMediaPath(key) || !/^[a-zA-Z0-9._-]+$/.test(bucket)) return null;
    return { source, bucket, key };
  } catch { return null; }
}

export function mediaArchivePath(ref: MediaRef): string | undefined {
  if (ref.bucket && ref.key) return ref.bucket === "site-images" ? ref.key : `site-buckets/${ref.bucket}/${ref.key}`;
  if (ref.local) return `site-public/${ref.local}`;
}

/** Walk objects, arrays AND settings containing stringified JSON; no JSON escape truncation. */
export function scanMediaReferences(value: unknown, publicPaths: readonly string[] = []): MediaRef[] {
  const refs = new Map<string, MediaRef>();
  const publicSet = new Set(publicPaths);
  function consider(source: string, field: string) {
    if (/^data:(?:image|audio|video|font)\/|^data:application\/pdf/i.test(source)) { refs.set(source, { source }); return; }
    const storage = storageMediaRef(source);
    if (storage) { refs.set(source, storage); return; }
    const local = source.replace(/^\//, "").split(/[?#]/)[0];
    if (!/^https?:|^\/\//i.test(source) && (publicSet.has(local) || (source.startsWith("/") && !source.startsWith("//") && (MEDIA_FIELD.test(field) || MEDIA_EXT.test(source))))) {
      refs.set(source, { source, local }); return;
    }
    if (/^(?:https?:)?\/\//i.test(source) && (MEDIA_FIELD.test(field) || MEDIA_EXT.test(source)))
      refs.set(source, { source });
    if (/^(?:blob:|file:)/i.test(source) && MEDIA_FIELD.test(field))
      throw new Error(`Unpersisted media in ${field}: upload the file again before backup`);
    // data: images already have their bytes inside the backed-up DB value.
  }
  function walk(v: unknown, field: string) {
    if (typeof v === "string") {
      const s = v.trim();
      if (/^data:(?:image|audio|video|font)\/|^data:application\/pdf/i.test(s)) { consider(s, field); return; }
      if (/^(?:blob:|file:)/i.test(s) && MEDIA_FIELD.test(field)) consider(s, field);
      if (/^[\[{]/.test(s)) {
        try { walk(JSON.parse(s), field); return; } catch (e) { if (e instanceof Error && e.message.startsWith("Unpersisted media")) throw e; }
      }
      if (/^(?:(?:https?:)?\/\/|\/[^/])/i.test(s) && !/\s/.test(s)) consider(s, field);
      else if (publicSet.has(s.replace(/^\//, "").split(/[?#]/)[0])) consider(s, field);
      else {
        for (const m of s.matchAll(TOKENS)) consider(m[0], field);
      }
    } else if (Array.isArray(v)) v.forEach((item) => walk(item, field));
    else if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      // system_settings stores the semantic name in `key`, and URL/JSON in `value`.
      const hint = typeof obj.key === "string" ? obj.key : field;
      for (const [k, item] of Object.entries(obj)) walk(item, k === "value" ? hint : `${field}.${k}`);
    }
  }
  walk(value, "");
  return [...refs.values()];
}

/** Exact aliases plus per-occurrence storage parsing: multiple old project URLs are not lost. */
export function rewriteMediaValue(value: unknown, urls: ReadonlyMap<string, string>, aliases: ReadonlyMap<string, string>): unknown {
  function rewriteStr(s: string): string {
    const exact = aliases.get(s);
    if (exact && urls.has(exact)) return urls.get(exact)!;
    const ref = storageMediaRef(s);
    const path = ref && mediaArchivePath(ref);
    if (path && urls.has(path)) return urls.get(path)!;
    const local = `site-public/${s.replace(/^\//, "").split(/[?#]/)[0]}`;
    if (!/^https?:|^\/\//i.test(s) && urls.has(local)) return urls.get(local)!;
    if (/^[\[{]/.test(s.trim())) {
      try { return JSON.stringify(rewriteMediaValue(JSON.parse(s), urls, aliases)); } catch { /* ordinary text */ }
    }
    return s.replace(TOKENS, (token) => {
      const alias = aliases.get(token);
      const ref = storageMediaRef(token);
      const path = alias ?? (ref && mediaArchivePath(ref));
      return path ? urls.get(path) ?? token : token;
    });
  }
  if (typeof value === "string") return rewriteStr(value);
  if (Array.isArray(value)) return value.map((v) => rewriteMediaValue(v, urls, aliases));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewriteMediaValue(v, urls, aliases)]));
  return value;
}

export type StorageListItem = { name: string; id?: string | null; metadata?: unknown };
/** No 5,000/10,000-file or six-level silent cutoff. A safety limit fails loudly. */
export async function listStoragePaths(list: (prefix: string, offset: number) => Promise<StorageListItem[]>): Promise<string[]> {
  const paths: string[] = [];
  const seenFiles = new Set<string>();
  const pending = [""];
  const visited = new Set<string>();
  while (pending.length) {
    const prefix = pending.pop()!;
    if (visited.has(prefix)) throw new Error(`Storage folder repeated: ${prefix}`);
    visited.add(prefix);
    if (prefix.split("/").length > 128) throw new Error("Storage nesting exceeds safe backup limit (128)");
    for (let offset = 0; ; offset += 100) {
      const items = await list(prefix, offset);
      for (const item of items) {
        if (!item.name || item.name.includes("/")) throw new Error("Invalid storage listing entry");
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (!safeMediaPath(path)) throw new Error("Unsafe storage path");
        if (item.id === null || (item.id === undefined && item.metadata == null)) pending.push(path);
        else {
          if (seenFiles.has(path)) throw new Error(`Storage pagination repeated an object: ${path}`);
          seenFiles.add(path); paths.push(path);
        }
      }
      if (items.length < 100) break;
    }
  }
  return paths;
}
