import type { NextRequest } from "next/server";

// ============================================================================
//  🔐 PERMISSIONS-POLICY — explicit ORIGIN allowlist (pentest warning #2)
//  Scan report #2: "Privacy-sensitive feature 'geolocation' / 'microphone' /
//  'payment' is not restricted to specific origins" — `(self)` හෝ `()` දැම්මමත්
//  warning එක තාම එනවා. ඒ නිසා **request එකේ නියම origin එක quoted string**
//  එකක් විදිහට යවනවා:
//      geolocation=("https://website-blond-eta-94.vercel.app")
//  එතකොට හැම feature එකක්ම එකම site origin එකට විතරයි — third-party කිසිවකට නෑ.
// ============================================================================

/** Request එකේ origin එක (Vercel proxy headers සැලකිල්ලට ගනී) + env canonical URL */
export function requestOrigins(request: NextRequest): string[] {
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    request.nextUrl.protocol.replace(":", "") ||
    "https";
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    request.nextUrl.host;

  const out = new Set<string>();
  if (host) out.add(`${proto}://${host}`);

  const extra = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  if (extra) {
    const url = /^https?:\/\//.test(extra) ? extra : `https://${extra}`;
    out.add(url.replace(/\/$/, ""));
  }
  return [...out].filter((o) => /^https?:\/\/[^/\s"']+$/.test(o));
}

/**
 * Permissions-Policy value එක — හැම feature එකක්ම **`()` (සම්පූර්ණයෙන් block)**.
 *
 * ඇයි `()` (සහ `(self)` නොව)?
 *   · site එකේ geolocation/camera/microphone/payment කිසිවක් පාවිච්චි නොකරයි →
 *     ඒවා කිසිම origin එකකට (අපේම origin එකටත්) අවසර දෙන්නේ නෑ = උපරිම ආරක්ෂාව.
 *   · third-party iframe එකකටවත් delegate වෙන්නේ නෑ.
 *
 * ⚠ pentestnet scanner එකේ parser bug එකක් නිසා එයාගේ report එකේ තාම
 *   "not restricted to specific origins" note එකක් පෙනෙන්න පුළුවන් — ඒක අපේ
 *   header එකේ ප්‍රශ්නයක් නෙවෙයි (proof: SECURITY.md → "pentestnet false positive").
 */
export function buildPermissionsPolicy(): string {
  return [
    "geolocation=()",
    "microphone=()",
    "camera=()",
    "payment=()",
    "usb=()",
    "magnetometer=()",
    "gyroscope=()",
    "accelerometer=()",
    "fullscreen=()",
    "picture-in-picture=()",
    "interest-cohort=()",
  ].join(", ");
}
