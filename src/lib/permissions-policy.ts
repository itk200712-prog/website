// ============================================================================
//  🔐 PERMISSIONS-POLICY (pentest warning #2) — විමසුම + අවසාන තීරණය
// ============================================================================
//  pentestnet scan එකේ note එක:
//      "Privacy-sensitive feature 'geolocation' / 'microphone' / 'payment'
//       is not restricted to specific origins."
//
//  අපි පරීක්ෂා කළ **හැම** format එකකුත් එකම warning එක දුන්නා:
//      camera=()                                  → warning
//      camera=(self)                              → warning
//      camera=("https://<site>")  (explicit origin) → warning
//  ඒත් — header එකේ **මුලින්ම** තියෙන feature එක විතරක් "pass" වෙනවා:
//
//      header එක                        පස්සේ note වුණේ
//      ------------------------------  ---------------------------
//      camera=..., microphone=...       microphone, geolocation, payment
//      geolocation=..., microphone=...  camera, microphone, payment
//      geolocation=(), microphone=(),   camera, microphone, payment
//
//  එකම syntax, එකම value — order එක වෙනස් කළාම pass වෙන feature එකත් වෙනස් වෙනවා.
//  ඒ කියන්නේ pentestnet ගේ parser එක header එකේ **පළවෙනි directive එක විතරයි**
//  කියවනවා (site එකේ වැරැද්දක් නෙවෙයි). cloudflare.com වගේ ලොකු site එකකටත්
//  එකම warning එකම එනවා — එයාගේත් header එක `geolocation=(), camera=(), microphone=()`
//  වුණාම "camera, microphone, payment" කියලා note වෙනවා.
//
//  ඒ නිසා අපේ තීරණය = **වඩාත් ආරක්ෂිත + spec-compliant header එක** තියාගන්නවා:
//  හැම feature එකක්ම `()` → කිසිම origin එකකට (අපේම origin එකටවත්) අවසර නෑ,
//  third-party iframe එකකටවත් delegate වෙන්නේ නෑ. (MDN / W3C standard syntax.)
// ============================================================================

/**
 * Permissions-Policy value එක — හැම feature එකක්ම `()` (සම්පූර්ණයෙන් block).
 *
 * ඇයි `()` (සහ `(self)` නොව)?
 *   · site එකේ geolocation / camera / microphone / payment / usb / sensors
 *     කිසිවක් පාවිච්චි කරන්නේ නෑ → block කිරීම උපරිම ආරක්ෂාව.
 *   · `(self)` දැම්මොත් same-origin script එකකට (XSS) ඒවා පාවිච්චි කරන්න පුළුවන්.
 *
 * ⚠ pentestnet report එකේ මේ header එකට තාම "Warning" එකක් පෙන්නුවත් එයාගේ
 *   parser bug එකක් නිසා — browser එකට යන header එක නිවැරදියි. විස්තර: SECURITY.md
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
