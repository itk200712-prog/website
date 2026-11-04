// ============================================================================
//  Member Update — වෙබ් අඩවියේ register එකේ තියෙන සාමාජික/චන්ද හිමි විස්තර
//  edit කරන්න ඇති පොදු logic එක (pure helpers — test කරන්න පුළුවන්).
//
//  ✅ මෙතන delete එකක් නෑ. edit විතරයි.
//  ✅ සාමාජිකයෙක් update වුණාම ඒ පුද්ගලයාගේ චන්ද හිමි පේළිය (voter_rows) ද
//     ඉබේම update වෙනවා — NIC එකෙන්, නැත්නම් නම + ලිපිනයෙන් match කරලා.
// ============================================================================

export type RegisterFields = {
  member_no?: string | null;
  voter_no?: string | null;
  nic?: string | null;
  full_name?: string | null;
  address?: string | null;
  postal_address?: string | null;
  gender?: string | null;
};

/** 12 අංක හෝ 9 අංක + v/x (ඔයාගේ රටේ ජා.හැ.අංක රීතිය) */
export const NIC_PATTERN = /^(\d{12}|\d{9}[vVxX])$/;

export function cleanText(v: string | null | undefined): string {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

export function sanitizeNic(v: string | null | undefined): string {
  return cleanText(v).replace(/\s/g, "").toUpperCase();
}

function norm(v: string | null | undefined): string {
  return cleanText(v).toLowerCase();
}

/** පේළියේ අංකය — member වගුවේ member_no, voter වගුවේ voter_no */
export function rowNumber(r: RegisterFields): string {
  return cleanText(r.member_no ?? r.voter_no);
}

/** තීරු 6න් හිස් ඒවා (ඇඩ්මින් පැනලයේ badge එකට) */
export function missingColumns(r: RegisterFields): string[] {
  const out: string[] = [];
  if (!rowNumber(r)) out.push("අංකය");
  if (!sanitizeNic(r.nic)) out.push("NIC");
  if (!cleanText(r.full_name)) out.push("නම");
  if (!cleanText(r.address)) out.push("ලිපිනය");
  if (!cleanText(r.postal_address)) out.push("තැපැල් ලිපිනය");
  if (!cleanText(r.gender)) out.push("ස්ත්‍රී/පුරුෂ");
  return out;
}

/** Save කරන්න කලින් පරීක්ෂා කිරීම — හිස් නම් error එකක් return කරයි */
export function validateRegisterEdit(r: RegisterFields): string[] {
  const errors: string[] = [];
  if (!rowNumber(r)) errors.push("අංකය අනිවාර්යයි");
  if (cleanText(r.full_name).length < 2) errors.push("නම අනිවාර්යයි");
  if (cleanText(r.full_name).length > 120) errors.push("නම දිග වැඩියි");
  const nic = sanitizeNic(r.nic);
  if (nic && !NIC_PATTERN.test(nic)) errors.push("NIC — අංක 12ක් හෝ අංක 9ක් + V/X විය යුතුයි");
  const g = cleanText(r.gender);
  if (g && !["පුරුෂ", "පිරිමි", "කාන්තා"].includes(g)) errors.push("ස්ත්‍රී/පුරුෂ — පුරුෂ/පිරිමි/කාන්තා පමණයි");
  return errors;
}

/** සාමාජිකයාගේ වෙනස් වූ දත්ත — චන්ද හිමි පේළියට දාන patch එක */
export function voterSyncPatch(member: RegisterFields) {
  return {
    nic: sanitizeNic(member.nic),
    full_name: cleanText(member.full_name),
    address: cleanText(member.address),
    postal_address: cleanText(member.postal_address),
    gender: cleanText(member.gender),
  };
}

/**
 * මේ voter පේළිය අර සාමාජිකයාමද?
 * 1) NIC එකෙන් (අලුත් NIC එක හෝ edit කරන්න කලින් තිබූ NIC එක)
 * 2) නැත්නම් නම + ලිපිනය එකම නම් (අලුත් අගයන් හෝ පරණ අගයන්)
 * voter_no වෙනස් අංකනයක් නිසා ඒකෙන් match කරන්නේ නෑ.
 */
export function voterMatchesMember(
  voter: RegisterFields,
  member: RegisterFields,
  original: RegisterFields = {}
): boolean {
  const vNic = sanitizeNic(voter.nic);
  if (vNic) {
    if (vNic === sanitizeNic(member.nic)) return true;
    if (vNic === sanitizeNic(original.nic)) return true;
  }
  const vName = norm(voter.full_name);
  const vAddr = norm(voter.address);
  if (!vName) return false;
  return [member, original].some((m) => {
    const name = norm(m.full_name);
    return Boolean(name) && name === vName && norm(m.address) === vAddr;
  });
}
