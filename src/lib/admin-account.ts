// ============================================================================
//  Admin account creation guards — "Add Administrator" එකෙන් පරණ ගිණුමක්
//  overwrite / delete වෙන එක නවත්තන pure helpers (test කරන්න පුළුවන්).
//
//  ප්‍රශ්නය: Supabase `auth.signUp()` එකට දැනටමත් තියෙන email එකක් දුන්නොත්
//  (Confirm email ON වෙලා තිබ්බොත්) error එකක් එන්නේ නෑ — ඒ පරණ user ගේම
//  `id` එක `identities: []` එක්ක ආපහු එනවා. ඒ id එකෙන් profiles row එක
//  upsert කළොත් පරණ admin ගේ නම/NIC/role/password ඔක්කොම නව විස්තර වලින්
//  වෙනස් වෙනවා (= admin කෙනෙක් "නැති" වෙනවා). ඒ නිසා:
//    1) signUp එකට කලින් NIC / email clash එකක් තියෙනවද බලනවා
//    2) signUp response එකේ identities හිස් නම් "දැනටමත් තියෙනවා" කියලා හඳුනාගන්නවා
//    3) ඒ id එකට profile row එකක් දැනටමත් තියෙනවා නම් (හිස් stub එකක් මිස) ලියන්නේ නෑ
// ============================================================================

export type ProfileLite = {
  id?: string | null;
  full_name?: string | null;
  nic?: string | null;
  auth_email?: string | null;
  role?: string | null;
};

/** NIC එක compare කරන්න ලෑස්ති කරනවා (trim + uppercase — DB එකේ තියෙන විදිහම) */
export function nicVariants(nic: string): string[] {
  const raw = String(nic ?? "").trim();
  if (!raw) return [];
  const upper = raw.toUpperCase();
  return raw === upper ? [raw] : [raw, upper];
}

/** "මේ ගිණුම දැනටමත් තියෙනවා" පණිවිඩය — clash එකක් නැත්නම් null */
export function accountClashMessage(clash: ProfileLite | null | undefined, nic: string): string | null {
  if (!clash) return null;
  const who = String(clash.full_name ?? "").trim() || String(nic ?? "").trim();
  const id = String(clash.nic ?? "").trim() || String(clash.auth_email ?? "").trim() || String(nic ?? "").trim();
  const role = String(clash.role ?? "member").trim() || "member";
  return `⚠ "${who}" (${id} · ${role}) කියා දැනටමත් ගිණුමක් තියෙනවා — කිසි දෙයක් වෙනස් කළේ නෑ. වෙන NIC එකක් දාන්න, නැත්නම් Admin → Registered Members එකෙන් ඒ ගිණුම Edit කරන්න.`;
}

/**
 * `auth.signUp()` එකේ ප්‍රතිඵලය අනුව ගිණුම දැනටමත් තියෙනවද?
 *  · error message එකේ "already registered" → ඔව්
 *  · `identities: []` (Supabase obfuscation) → ඔව්
 *  · user id එකක් නෑ → අලුත් ගිණුමක් හැදුවේ නෑ
 */
export function signupAlreadyExists(
  user: { id?: string | null; identities?: unknown[] | null } | null | undefined,
  errorMessage?: string | null
): boolean {
  if (/already registered/i.test(String(errorMessage ?? ""))) return true;
  if (!user?.id) return true;
  if (Array.isArray(user.identities) && user.identities.length === 0) return true;
  return false;
}

/** Profile row එකක් තිබ්බත් ඒක හිස් stub එකක්ද? (trigger එකකින් හැදුණු row එකක් පුරවන්න ඉඩ දෙන්න) */
export function isEmptyProfileStub(row: { nic?: string | null; full_name?: string | null } | null | undefined): boolean {
  if (!row) return true;
  return !String(row.nic ?? "").trim() && !String(row.full_name ?? "").trim();
}

/**
 * Profile එකක් ලියන්න අවසර තියෙනවද? (දැනටමත් පිරුණු ගිණුමක් නම් කවදාවත් නෑ)
 * @returns error message එකක් හෝ null (ලියන්න පුළුවන්)
 */
export function profileWriteBlocker(row: ProfileLite | null | undefined): string | null {
  if (!row) return null;
  if (isEmptyProfileStub(row)) return null;
  return "⚠ මේ ගිණුමට දැනටමත් profile එකක් තියෙනවා — කිසි දෙයක් වෙනස් කළේ නෑ";
}

/** Delete RPC එක "මකන්න බෑ" කිව්වාද? (එතකොට profile fallback delete එකක් යවන්නේ නෑ) */
export function isProtectedDeleteRefusal(message?: string | null): boolean {
  return /original superadmin|only the original|cannot delete|own account|not signed in|only administrators|account not found/i.test(
    String(message ?? "")
  );
}
