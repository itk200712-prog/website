// ============================================================================
//  Register rows — "තීරු 6ම පිරුණු පේළි පමණයි" filter
//  Excel එකේ එක තීරුවක් හිස් නම් (හෝ පේළිය මුළුමනින්ම හිස් නම්) ඒ පේළිය
//  වෙබ් අඩවියේ හෝ generated PDF එකේ පෙන්වන්නේ නෑ. පිළිවෙල එහෙමම තියෙනවා.
//    columns: අංකය · NIC · සම්පූර්ණ නම · ලිපිනය · තැපැල් ලිපිනය · ස්ත්‍රී/පුරුෂ
// ============================================================================

export type RegisterRowLike = {
  member_no?: string | null;
  voter_no?: string | null;
  nic?: string | null;
  full_name?: string | null;
  address?: string | null;
  postal_address?: string | null;
  gender?: string | null;
};

/** මේ පේළියේ තීරු 6ම පිරී තිබේද? */
export function isCompleteRegisterRow(r: RegisterRowLike): boolean {
  const no = String(r.member_no ?? r.voter_no ?? "").trim();
  const nic = String(r.nic ?? "").trim();
  const name = String(r.full_name ?? "").trim();
  const address = String(r.address ?? "").trim();
  const postal = String(r.postal_address ?? "").trim();
  const gender = String(r.gender ?? "").trim();
  return Boolean(no && nic && name && address && postal && gender);
}

/** තීරු 6ම පිරුණු පේළි පමණක් — එම පිළිවෙලම රැක ගනිමින් */
export function filterCompleteRegisterRows<T extends RegisterRowLike>(rows: T[]): T[] {
  return rows.filter(isCompleteRegisterRow);
}

/**
 * 🔁 එකම පුද්ගලයා rows දෙකක් වුණොත් (Excel දෙපාරක් upload / append mode) ලැයිස්තුවේ,
 * PDF එකේ සහ ගණන් වල එක වරක් විතරක් පෙන්වයි. පළමු පේළිය (මුල් පිළිවෙල) තබා ගනී.
 */
export function registerRowKey(r: RegisterRowLike): string {
  const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return [
    norm(r.member_no ?? r.voter_no),
    norm(r.nic),
    norm(r.full_name),
    norm(r.address),
    norm(r.postal_address),
    norm(r.gender),
  ].join("|");
}

/** Duplicate rows ඉවත් කර එලෙසම පිළිවෙළ තබා ගනී (තීරු 6ම ඇති ඒවා පමණක් සලකයි) */
export function dedupeRegisterRows<T extends RegisterRowLike>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const k = registerRowKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/** ලැයිස්තුවට යන අවසාන පේළි — තීරු 6ම පිරුණු + duplicate රහිත (මුල් පිළිවෙළ) */
export function displayRegisterRows<T extends RegisterRowLike>(rows: T[]): T[] {
  return dedupeRegisterRows(filterCompleteRegisterRows(rows));
}
