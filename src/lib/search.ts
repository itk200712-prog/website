// ============================================================================
// Token-based name matching — නමේ වචන කිහිපයක් දුන්නොත් ඒ වචන ඔක්කොම
// අඩංගු නම් හමුවේ (වචන අතර පිළිවෙළ වැදගත් නෑ).
// ============================================================================

const TOKEN_SPLIT = /[\s,.;:/\\|]+/;

export function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .split(TOKEN_SPLIT)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** සියලුම tokens අදාළ text එකේ තියෙනවා නම් true */
export function tokenMatch(haystack: string, query: string): boolean {
  const ts = tokens(query);
  if (!ts.length) return true;
  const h = haystack.toLowerCase();
  return ts.every((t) => h.includes(t));
}

/** row එකේ කිහිප field එකක් එකට ගෙන tokenMatch */
export function rowMatch(row: Record<string, unknown>, query: string, fields: string[]): boolean {
  const h = fields.map((f) => String(row[f] ?? "")).join(" ");
  return tokenMatch(h, query);
}
