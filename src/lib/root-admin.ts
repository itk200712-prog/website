// ============================================================================
//  Original (root) Super Admin protection — pure permission helpers
//  නීතිය: මුල සිටම සිටි original superadmin ට හැර, අලුතින් එකතු වූ
//  superadmin කෙනෙක්ටවත් වෙනත් admin කෙනෙක්ගේ ගිණුම edit / password reset /
//  delete කරන්න බෑ. සාමාන්‍ය user (member) ගිණුම් ඕනෑම admin කෙනෙක්ට පුළුවන්.
//  තමන්ගේම password එක වෙනස් කිරීම Admin → Profile එකෙන් (මෙයින් නෙවෙයි).
// ============================================================================

export type AccountLike = {
  id?: string | null;
  role?: string | null;
  joined_date?: string | null;
  created_at?: string | null;
  is_root_admin?: boolean | null;
  nic?: string | null;
  auth_email?: string | null;
};

export function isAdminRole(role?: string | null): boolean {
  return role === "admin" || role === "superadmin";
}

function timeOf(a: AccountLike): number {
  const t = Date.parse(a.joined_date || a.created_at || "");
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

/** Seed එකෙන් හැදෙන මුල්ම ගිණුමද? (nic = SUPERADMIN / superadmin@… email) */
function isSeedRoot(a: AccountLike): boolean {
  const nic = (a.nic ?? "").trim().toUpperCase();
  const email = (a.auth_email ?? "").trim().toLowerCase();
  return nic === "SUPERADMIN" || email === "superadmin@members.mpcs.lk" || email === "superadmin@mpcs.lk";
}

/**
 * Original superadmin ගේ id එක හොයනවා:
 *  1) DB එකේ is_root_admin = true කියා ලකුණු කරලා ඇත්නම් එයාමයි
 *  2) නැත්නම් seed ගිණුම (SUPERADMIN)
 *  3) නැත්නම් ඉස්සෙල්ලම හැදුණු superadmin
 */
export function pickRootAdminId(accounts: AccountLike[]): string {
  const supers = (accounts ?? []).filter((a) => a?.id && a.role === "superadmin");
  if (!supers.length) return "";
  const flagged = supers.filter((a) => a.is_root_admin === true);
  const pool = flagged.length ? flagged : supers;
  return (
    [...pool].sort(
      (a, b) =>
        Number(isSeedRoot(b)) - Number(isSeedRoot(a)) ||
        timeOf(a) - timeOf(b) ||
        String(a.id).localeCompare(String(b.id))
    )[0]?.id || ""
  );
}

export function isRootAdmin(actor?: AccountLike | null, rootId?: string): boolean {
  return Boolean(actor?.id && rootId && actor.id === rootId && actor.role === "superadmin");
}

/** Password එක බලන්න පුළුවන්ද — member ලාගේ ඕන admin කෙනෙක්ට; admin ලාගේ root ට + තමන්ට විතරයි */
export function canViewPassword(actor: AccountLike | null | undefined, target: AccountLike | null | undefined, rootId: string): boolean {
  if (!actor?.id || !target?.id || !isAdminRole(actor.role)) return false;
  if (!isAdminRole(target.role)) return true;
  return actor.id === target.id || isRootAdmin(actor, rootId);
}

/** වෙනත් අයෙකුගේ password එක reset කරන්න — member ලාගේ ඕන admin කෙනෙක්ට; admin ලාගේ root ට විතරයි (තමන්ගේ එක Profile එකෙන්) */
export function canResetPassword(actor: AccountLike | null | undefined, target: AccountLike | null | undefined, rootId: string): boolean {
  if (!actor?.id || !target?.id || !isAdminRole(actor.role)) return false;
  if (actor.id === target.id) return false;
  if (!isAdminRole(target.role)) return true;
  return isRootAdmin(actor, rootId);
}

/** ගිණුම මකන්න — root ගේ ගිණුම කාටවත් බෑ; admin ගිණුම් root ට විතරයි; member ලා ඕන admin කෙනෙක්ට */
export function canDeleteAccount(actor: AccountLike | null | undefined, target: AccountLike | null | undefined, rootId: string): boolean {
  if (!actor?.id || !target?.id || !isAdminRole(actor.role)) return false;
  if (actor.id === target.id) return false;
  if (rootId && target.id === rootId) return false;
  if (!isAdminRole(target.role)) return true;
  return isRootAdmin(actor, rootId);
}

/** ගිණුමේ මූලික විස්තර edit කරන්න — member ලා ඕන admin කෙනෙක්ට; admin ලා root ට (+ තමන්ට තමන්ගේ විස්තර) */
export function canEditAccount(actor: AccountLike | null | undefined, target: AccountLike | null | undefined, rootId: string): boolean {
  if (!actor?.id || !target?.id || !isAdminRole(actor.role)) return false;
  if (actor.id === target.id) return true;
  if (!isAdminRole(target.role)) return true;
  return isRootAdmin(actor, rootId);
}

/** Role එක වෙනස් කරන්න (admin/superadmin දීම/අයින් කිරීම) — root ට විතරයි, තමන්ගේ එක බෑ */
export function canChangeRole(actor: AccountLike | null | undefined, target: AccountLike | null | undefined, rootId: string): boolean {
  if (!target?.id) return false;
  if (rootId && target.id === rootId) return false;
  return isRootAdmin(actor, rootId) && actor?.id !== target.id;
}
