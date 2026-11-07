// ============================================================================
// Token-based name matching — නමේ වචන කිහිපයක් දුන්නොත් ඒ වචන ඔක්කොම
// අඩංගු නම් හමුවේ (වචන අතර පිළිවෙළ වැදගත් නෑ).
//
// 🆕 v2 — සිංහල අකුරු වෙනස්කම් නොසලකා හැරීම (spelling tolerance):
//   "දොරටියගෙදර" (ා නැතුව) සහ "දොරටියාගෙදර" (ා සමඟ) — එකම ප්‍රතිඵල ලැබේ.
//   පාවිච්චියේදී බොහෝ දෙනා අකුරු (ා ි ී ු ෙ ේ …) අතපසු කරන නිසා
//   පළමුව **හරියටම** සොයා, නැත්නම් පමණක් **ලිහිල්** (matra-නොසලකන) සෙවුමක් කරයි.
// ============================================================================

const TOKEN_SPLIT = /[\s,.;:/\\|]+/;

/** සිංහල අකුරක්/ලකුණක් තියෙනවද (query එකේ) */
export const hasSinhala = (s: string): boolean => /[\u0D80-\u0DFF]/.test(s);

/**
 * ශුන්‍ය-පළල (ZWSP/ZWJ/ZWNJ/BOM) + සිංහල ස්වර/භාග ලක්ෂණ (matras) ඉවත් කර
 * සංසන්දනය කළ හැකි "කළඹ" එකක් හදයි.
 *   දොරටියාගෙදර → දරටයගදර
 *   දොරටියගෙදර  → දරටයගදර   (දෙකම එකම!)
 * අනුස්වර (ං) සහ විසර්ග (ඃ) ඉවත් නොකෙරේ — ඒවා අර්ථය වෙනස් කරයි.
 */
export function foldSinhala(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u0DCA\u0DCF-\u0DDF\u0DF2\u0DF3]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .split(TOKEN_SPLIT)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** සියලුම tokens අදාළ text එකේ තියෙනවා නම් true (හරියටම) */
export function tokenMatch(haystack: string, query: string): boolean {
  const ts = tokens(query);
  if (!ts.length) return true;
  const h = String(haystack ?? "").toLowerCase();
  return ts.every((t) => h.includes(t));
}

/** සිංහල අකුරු වෙනස්කම් නොසලකා සෙවීම */
export function tokenMatchLoose(haystack: string, query: string): boolean {
  const ts = tokens(query);
  if (!ts.length) return true;
  const h = foldSinhala(haystack);
  return ts.every((t) => h.includes(foldSinhala(t)));
}

export type MatchKind = "exact" | "loose" | null;

/**
 * ලිහිල් සෙවුම යොදන්නේ **සිංහල අකුරු 3ක් හෝ වැඩි** වචනයකට විතරයි —
 * "ගම" / "කම" වගේ කෙටි වචන වලදී matra ඉවත් කිරීම නිසා වැඩිපුර (වැරදි)
 * ප්‍රතිඵල එන්න පුළුවන් නිසා. ("දොරටියගෙදර" → 8 අකුරු → ලිහිල් සෙවුම on)
 */
export const LOOSE_MIN_LETTERS = 3;

/**
 * එක් පේළියක් සෙවුමට ගැළපෙන විදිහ:
 *   "exact" → අකුරු හරියටම ගැළපේ
 *   "loose" → අකුරු වෙනස්කම් (ා ි ී …) නොසලකා ගැළපේ
 *   null    → ගැළපෙන්නේ නෑ
 */
export function rowMatchKind(row: Record<string, unknown>, query: string, fields: string[]): MatchKind {
  if (!query.trim()) return "exact";
  const h = fields.map((f) => String(row[f] ?? "")).join(" ");
  if (tokenMatch(h, query)) return "exact";
  // ① ඉංග්‍රීසි / අංක සෙවුම් වලට ලිහිල් සෙවුමක් ඕන නෑ (හරියටම ගැළපුණේ නැත්නම් නෑ)
  if (!hasSinhala(query)) return null;
  // ② කෙටි සිංහල වචන (අකුරු 3ට අඩු) → ලිහිල් සෙවුම නෑ (වැරදි ප්‍රතිඵල වැළැක්වීම)
  const folded = tokens(query).map(foldSinhala).filter(Boolean);
  if (!folded.length || folded.some((t) => t.length < LOOSE_MIN_LETTERS)) return null;
  // ③ සිංහල අකුරු වෙනස්කම් (ා ි ී ු ෙ ේ …) නිසා විතරක් ගැළපෙනවා නම් "loose"
  if (tokenMatchLoose(h, query)) return "loose";
  return null;
}

/** row එකේ කිහිප field එකක් එකට ගෙන tokenMatch (exact හෝ loose) */
export function rowMatch(row: Record<string, unknown>, query: string, fields: string[]): boolean {
  return rowMatchKind(row, query, fields) !== null;
}
