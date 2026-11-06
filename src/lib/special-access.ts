// ============================================================================
// Download With Special — "සර්ච් කරපු ටික PDF කරන්න" අවසර පද්ධතිය
//
//  · F28 වගේම තෝරාගත් (authenticate කරපු) users ලට විතරයි button එක පේන්නේ.
//  · Sign in වෙලා නැති අයට / sign in වෙලා අවසර නැති අයට button එක පේන්නෙම නෑ.
//  · අවසර දෙන්නේ Admin → Data & Live Metrics → "Download With Special" panel එකෙන්.
//  · Row එකක status = active නම් විතරයි වැඩ කරන්නේ (disabled නම් නෑ).
// ============================================================================

export const SPECIAL_ACCESS_TABLE = "special_download_access";
export const SPECIAL_ACCESS_LABEL = "Download With Special";

export type SpecialAccessRow = {
  id: string;
  user_id: string;
  nic?: string | null;
  full_name?: string | null;
  status?: string | null;
  created_at?: string | null;
};

/** UI එකේ තත්ත්වය */
export type SpecialAccessState = "unknown" | "none" | "active" | "disabled" | "error";

/** මේ state එකෙන් button එක පෙන්නන්නද? */
export function canUseSpecialDownload(state: SpecialAccessState): boolean {
  return state === "active";
}

/** DB row එකකින් state එක */
export function accessStateFromRow(row: Pick<SpecialAccessRow, "status"> | null | undefined): SpecialAccessState {
  if (!row) return "none";
  return String(row.status ?? "").toLowerCase() === "active" ? "active" : "disabled";
}

/** Special PDF එකේ label එක — සෙවුම් වචනයත් එක්ක (PDF එකේ "ගොනුව: …" වල පේනවා) */
export function specialFileLabel(base: string, query: string): string {
  const safe = query
    .trim()
    .replace(/[\\/:*?"<>|\n\r\t]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const cleanBase = base.trim() || "Register";
  // දැනටම base එකේ search term එක අගට තියෙනවා නම් ආයෙ දාන්නේ නෑ
  if (!safe || cleanBase.endsWith(safe)) return `${cleanBase}-Special`;
  return `${cleanBase}-${safe}`;
}

/** PDF file එකේ නම (buildRegisterPdf එකේ රටාවම) */
export function specialPdfFileName(label: string, kind: "member" | "voter"): string {
  return `${label}-${kind === "member" ? "members" : "voters"}-register.pdf`;
}

/** Admin panel එකේ පෙන්වන අවසර ලැයිස්තුව — නම හෝ NIC අනුව filter */
export function filterAccessUsers<T extends { full_name?: string | null; nic?: string | null }>(
  users: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return users;
  const parts = q.split(/\s+/).filter(Boolean);
  return users.filter((u) => {
    const hay = `${u.full_name ?? ""} ${u.nic ?? ""}`.toLowerCase();
    return parts.every((p) => hay.includes(p));
  });
}

/** එකම user දෙපාරක් list එකේ නොපෙන්න (user_id අනුව unique) */
export function dedupeAccessRows(rows: SpecialAccessRow[]): SpecialAccessRow[] {
  const map = new Map<string, SpecialAccessRow>();
  for (const r of rows) {
    if (!r?.user_id) continue;
    const prev = map.get(r.user_id);
    if (!prev) map.set(r.user_id, r);
    else if (String(r.status) === "active") map.set(r.user_id, r); // active එකට මුල් තැන
  }
  return [...map.values()];
}
