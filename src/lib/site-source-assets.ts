// ============================================================================
// SITE DESIGN / UPDATE SOURCE SNAPSHOT — Backup Format v3
// ----------------------------------------------------------------------------
// Backup ZIP එකේ දත්ත විතරක් නෙවෙයි, අලුත්ම site design එක හදන source files
// ටිකත් (CSS, mouse-cursor animation, uploaded-icon components, mega-menu,
// hotline charm cards, loading/speed files, Services CRUD fix) `site-source/`
// folder එකක් විදිහට ඇතුළත් වෙනවා.
//
// Snapshot එක හැදෙන්නේ build/dev එකට කලින් දුවන
// `scripts/gen-site-source.mjs` එකෙන් (prebuild/predev) — ඒ නිසා හැම
// deploy එකකම backup එකට යන්නේ ඒ වෙලාවේ නියම current file content එකමයි.
// File list එක තියෙන්නේ එම generator script එකේ.
// ============================================================================

import { SITE_PACKAGE_VERSION, SITE_SOURCE_FILES, type SiteSourceFile } from "./site-source.generated";

export { SITE_PACKAGE_VERSION };
export type { SiteSourceFile };

/** Backup ZIP එකට යන current design/update source files ටික */
export function getSiteSourceFiles(): SiteSourceFile[] {
  return SITE_SOURCE_FILES;
}
