// ============================================================================
// Gallery social helpers — comment replies (one-level threads), like/view
// counts සහ superadmin boost amounts සඳහා pure logic (test කළ හැකි ලෙස)
// ============================================================================

import type { GalleryComment, GalleryItem } from "@/lib/types";

export interface GalleryCommentNode extends GalleryComment {
  replies: GalleryComment[];
}

export interface GalleryAlbum {
  key: string;
  cover: GalleryItem;
  photos: GalleryItem[];
  totalLikes: number;
  totalViews: number;
  totalComments: number;
}

function normalizeAlbumText(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

/** Admin batch upload එකේ ids: gal-<stamp>-1, gal-<stamp>-2 ... — stamp එක album key එකයි */
function batchAlbumParts(id: string): { key: string; order: number } | null {
  const m = /^gal-(\d+)-(\d+)$/.exec(String(id ?? ""));
  if (!m) return null;
  return { key: `batch:gal-${m[1]}`, order: Number(m[2]) };
}

/**
 * Photo එක අයිති album එකේ key එක.
 * 1) එකවර upload කරපු batch එකක් නම් batch stamp එකෙන්ම group වෙනවා.
 * 2) නැත්නම් එකම Title + Description + Aspect තියෙන photos එකම album එකක් විදිහට
 *    සලකනවා (එකින් එක upload කළත් එකම මාතෘකාව/විස්තරය නම් එක කොටසක්).
 * Title එක හිස් photos වැරදියට ඔක්කොම එකට එකතු නොවෙන්න ඒවා වෙන්ව තබනවා.
 */
export function galleryAlbumKey(item: GalleryItem): string {
  const batch = batchAlbumParts(item.id);
  if (batch) return batch.key;
  const title = normalizeAlbumText(item.title);
  if (!title) return `single:${item.id}`;
  return `meta:${title}\u001f${normalizeAlbumText(item.description)}\u001f${item.aspect ?? "4:3"}`;
}

/**
 * Gallery items ටික albums විදිහට group කරයි — album එකකට එක card එකයි.
 * මුල් පිළිවෙල රැකෙනවා; batch photos ඒවායේ අංක පිළිවෙලට (1,2,3...) එනවා.
 */
export function groupGalleryItems(items: GalleryItem[]): GalleryAlbum[] {
  const byKey = new Map<string, { item: GalleryItem; index: number }[]>();
  (items ?? []).forEach((item, index) => {
    const key = galleryAlbumKey(item);
    const arr = byKey.get(key) ?? [];
    arr.push({ item, index });
    byKey.set(key, arr);
  });

  return Array.from(byKey.entries()).map(([key, entries]) => {
    const photos = entries
      .slice()
      .sort((a, b) => {
        const ao = batchAlbumParts(a.item.id)?.order;
        const bo = batchAlbumParts(b.item.id)?.order;
        if (ao != null && bo != null && ao !== bo) return ao - bo;
        return a.index - b.index;
      })
      .map((x) => x.item);
    return {
      key,
      cover: photos[0],
      photos,
      totalLikes: photos.reduce((sum, p) => sum + normalizeGalleryCount(p.likes), 0),
      totalViews: photos.reduce((sum, p) => sum + normalizeGalleryCount(p.views), 0),
      totalComments: photos.reduce((sum, p) => sum + (p.comments?.length ?? 0), 0),
    } satisfies GalleryAlbum;
  });
}

/** දීපු photo එක තියෙන album එක (lightbox එක album එක ඇතුළෙ විතරක් යන්න) */
export function findGalleryAlbum(items: GalleryItem[], itemId: string): GalleryAlbum | null {
  return groupGalleryItems(items).find((a) => a.photos.some((p) => p.id === itemId)) ?? null;
}

/** DB එකෙන් එන ඕනෑම අගයක් ආරක්ෂිත non-negative integer count එකක් කරයි */
export function normalizeGalleryCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/** Superadmin boost එකට දෙන ගණන 1–100000 අතරට clamp කරයි (වැරදි නම් 0) */
export function clampBoostAmount(value: string | number): number {
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return 0;
  return Math.min(100000, Math.max(0, Math.floor(n)));
}

/** Superadmin "Random Views" — වරකට 25–250 අතර අහඹු views ගණනක් */
export function randomGalleryViews(rng: () => number = Math.random): number {
  const r = Math.min(0.999999, Math.max(0, rng()));
  return 25 + Math.floor(r * 226); // 25..250
}

/** Comment එකක root (top-level) comment id එක — cycle/missing parent වලට ආරක්ෂිතයි */
function rootCommentId(comment: GalleryComment, byId: Map<string, GalleryComment>): string {
  let cur = comment;
  const seen = new Set<string>();
  while (cur.parent_id && byId.has(cur.parent_id) && !seen.has(cur.id)) {
    seen.add(cur.id);
    cur = byId.get(cur.parent_id)!;
  }
  return cur.id;
}

/**
 * Flat comments ලැයිස්තුව top-level comments + ඒවායේ replies විදිහට ගොඩනඟයි.
 * Reply එකකට දාපු reply එකක් වුණත් එම thread එකේම top-level එක යටතේම පෙන්වයි
 * (එක මට්ටමේ thread විතරයි — කියවන්න ලේසියි). Parent එක නැති reply එකක්
 * top-level එකක් ලෙසම පෙන්වයි.
 */
export function buildGalleryCommentTree(comments: GalleryComment[]): GalleryCommentNode[] {
  const list = comments ?? [];
  const byId = new Map(list.map((c) => [c.id, c] as const));
  const repliesByRoot = new Map<string, GalleryComment[]>();
  const roots: GalleryComment[] = [];

  for (const c of list) {
    const rootId = rootCommentId(c, byId);
    if (rootId === c.id) {
      roots.push(c);
    } else {
      const arr = repliesByRoot.get(rootId) ?? [];
      arr.push(c);
      repliesByRoot.set(rootId, arr);
    }
  }

  return roots.map((c) => ({ ...c, replies: repliesByRoot.get(c.id) ?? [] }));
}

/** Comments + replies ඔක්කොම එකතුව (header count එකට) */
export function countGalleryComments(comments: GalleryComment[] | undefined | null): number {
  return comments?.length ?? 0;
}

/** එක comment/reply එකක likes අගය විතරක් update කළ අලුත් ලැයිස්තුව */
export function updateGalleryCommentLikes(
  comments: GalleryComment[],
  commentId: string,
  likes: number
): GalleryComment[] {
  const next = normalizeGalleryCount(likes);
  return (comments ?? []).map((c) => (c.id === commentId ? { ...c, likes: next } : c));
}
