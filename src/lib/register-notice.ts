// ============================================================================
// Register update notice — "සියලුම සාමාජිකයන් යාවත්කාලීන වෙමින් පවතී"
// ----------------------------------------------------------------------------
// Member Details (All Members) සහ Eligible Voters පිටු දෙකේම උඩින් පෙන්වන
// notice එක. Admin → Settings එකෙන් on/off කරන්නත්, පිටු දෙකට වෙන වෙනම
// hide/show කරන්නත්, text එකයි දුරකථන අංකයයි වෙනස් කරන්නත් පුළුවන්.
//
// system_settings table එකේ save වන නිසා Download Backup සහ Import Backup
// දෙකේම (manual + scheduled/MEGA) ස්වයංක්‍රීයව යනවා — වෙනම SQL අවශ්‍ය නෑ.
// ============================================================================

import type { RegisterNoticeSetting } from "@/lib/types";

export const REGISTER_NOTICE_KEY = "register_update_notice";
export const REGISTER_NOTICE_PHONE = "+94 77 945 3982";
export const REGISTER_NOTICE_PHONE_DIAL = "+94779453982";

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

/** "+94 77 945 3982" → "+94779453982" (tel: link එකට) */
export function noticeDialFromPhone(phone: string): string {
  const raw = clean(phone);
  if (!raw) return REGISTER_NOTICE_PHONE_DIAL;
  const plus = raw.startsWith("+");
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return REGISTER_NOTICE_PHONE_DIAL;
  if (digits.startsWith("94")) return `+${digits}`;
  if (digits.startsWith("0")) return `+94${digits.slice(1)}`;
  return plus ? `+${digits}` : `+94${digits}`;
}

export function isNoticePhoneValid(phone: string): boolean {
  const digits = clean(phone).replace(/[^\d]/g, "");
  return digits === "94779453982" ? true : /^(?:94\d{9}|0\d{9}|\+?94\d{9})$/.test(digits);
}

export function defaultRegisterNotice(): RegisterNoticeSetting {
  return {
    enabled: true,
    showMembers: true,
    showVoters: true,
    title_si: "සියලුම සාමාජිකයන් යාවත්කාලීන වෙමින් පවතී",
    title_en: "All Member Records Are Being Updated",
    message_si:
      "මේ මොහොත වන විට සියලුම සාමාජිකයන් යාවත්කාලීන වෙමින් පවතින අතර, මෙහි ඔබගේ තොරතුරු නැතිනම් එය යාවත්කාලීන වනතුරු රැඳී සිටින්න. යාවත්කාලීන වූ විගස එය මෙහි ප්‍රදර්ශනය වන්නේය. වැඩිදුර විස්තර සඳහා අප අමතන්න.",
    message_en:
      "All member records are being updated right now. If your information is not listed here yet, please wait until it is updated — it will appear here as soon as the update is complete. For further assistance, please contact us.",
    phone: REGISTER_NOTICE_PHONE,
    phoneDial: REGISTER_NOTICE_PHONE_DIAL,
  };
}

/** හිස්/වැරදි values ට default එක දෙයි — DB එකේ කොටසක් විතරක් තිබුණත් වැඩ කරයි */
export function normalizeRegisterNotice(v: unknown): RegisterNoticeSetting {
  const base = defaultRegisterNotice();
  if (!v || typeof v !== "object" || Array.isArray(v)) return base;
  const r = v as Record<string, unknown>;
  const phone = clean(r.phone) || base.phone;
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : base.enabled,
    showMembers: typeof r.showMembers === "boolean" ? r.showMembers : base.showMembers,
    showVoters: typeof r.showVoters === "boolean" ? r.showVoters : base.showVoters,
    title_si: clean(r.title_si) || base.title_si,
    title_en: clean(r.title_en) || base.title_en,
    message_si: clean(r.message_si) || base.message_si,
    message_en: clean(r.message_en) || base.message_en,
    phone,
    phoneDial: clean(r.phoneDial) || noticeDialFromPhone(phone),
  };
}

export function parseRegisterNotice(raw: string | undefined | null): RegisterNoticeSetting {
  if (!raw) return defaultRegisterNotice();
  try {
    return normalizeRegisterNotice(JSON.parse(raw) as unknown);
  } catch {
    return defaultRegisterNotice();
  }
}

export function serializeRegisterNotice(n: RegisterNoticeSetting): string {
  return JSON.stringify(normalizeRegisterNotice(n));
}

/** අදාළ පිටුවේ notice එක පෙන්විය යුතුද? */
export function shouldShowRegisterNotice(
  n: RegisterNoticeSetting | undefined | null,
  kind: "member" | "voter"
): boolean {
  const notice = n ? normalizeRegisterNotice(n) : defaultRegisterNotice();
  if (!notice.enabled) return false;
  return kind === "member" ? notice.showMembers : notice.showVoters;
}

/** පිටුවට අදාළ භාෂාවෙන් title/message */
export function registerNoticeText(
  n: RegisterNoticeSetting,
  lang: string
): { title: string; message: string } {
  const si = lang === "si";
  return {
    title: si ? n.title_si : n.title_en,
    message: si ? n.message_si : n.message_en,
  };
}
