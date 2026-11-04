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
