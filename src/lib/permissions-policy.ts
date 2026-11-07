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
 * හැම privacy-sensitive feature එකකටම **explicit origin allowlist** එක.
 * origins හිස් නම් `feature=()` (සම්පූර්ණයෙන් block) — කවදාවත් `(self)`/`*` නෑ.
 */
export function buildPermissionsPolicy(origins: string[]): string {
  const allow = origins.map((o) => `"${o}"`).join(" ");
  const feature = (name: string) => (allow ? `${name}=(${allow})` : `${name}=()`);
  return [
    feature("camera"),
    feature("microphone"),
    feature("geolocation"),
    feature("payment"),
    feature("usb"),
    feature("magnetometer"),
    feature("gyroscope"),
    feature("accelerometer"),
    feature("fullscreen"),
    feature("picture-in-picture"),
    "interest-cohort=()",
  ].join(", ");
}
