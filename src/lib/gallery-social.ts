// ============================================================================
// Gallery social helpers — comment replies (one-level threads), like/view
// counts සහ superadmin boost amounts සඳහා pure logic (test කළ හැකි ලෙස)
// ============================================================================

import type { GalleryComment } from "@/lib/types";

export interface GalleryCommentNode extends GalleryComment {
  replies: GalleryComment[];
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
