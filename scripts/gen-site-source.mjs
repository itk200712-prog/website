// ============================================================================
// Backup Format v3 — site design/update source snapshot generator
// ----------------------------------------------------------------------------
// `npm run build` / `npm run dev` එකට කලින් (prebuild/predev) මේ script එක
// දුවලා, පහත design/update files වල නියම current content එක
// `src/lib/site-source.generated.ts` එකට ලියනවා. Backup ZIP එක හදන විට
// එම snapshot එක `site-source/` folder එකක් විදිහට ZIP එකට යනවා — ඒ නිසා
// CSS/mouse-cursor වගේ design updates හැම එකක්ම අලුත්ම backup එකේ තියෙනවා.
//
// ⚠ අලුත් design/feature file එකක් එකතු කළොත් FILES list එකටත් දාන්න.
// Server-only secret logic (API routes) මෙතන දාන්න එපා — frontend/design
// files විතරයි.
// ============================================================================
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE_PACKAGE_VERSION = "2026-11-07-production-security-v27";

const FILES = [
  "src/app/globals.css",
  "src/app/layout.tsx",
  "src/app/loading.tsx",
  "src/app/businesses/[slug]/loading.tsx",
  "src/app/businesses/[slug]/page.tsx",
  "src/app/admin/loading.tsx",
  "src/app/admin/businesses/page.tsx",
  "src/app/admin/animation/page.tsx",
  "src/app/admin/data/page.tsx",
  "src/app/admin/member-update/page.tsx",
  "src/app/admin/settings/page.tsx",
  "src/app/membership/members/page.tsx",
  "src/app/membership/voters/page.tsx",
  "src/app/admin/gallery/page.tsx",
  "src/app/admin/news/page.tsx",
  "src/app/gallery/page.tsx",
  "src/app/signin/page.tsx",
  "src/app/register/page.tsx",
  "src/middleware.ts",
  "next.config.ts",
  "src/app/robots.ts",
  "src/app/sitemap.ts",
  "src/app/.well-known/security.txt/route.ts",
  "SECURITY.md",
  "src/components/cursor-follower.tsx",
  "src/components/hero-slideshow.tsx",
  "src/components/floating-lang.tsx",
  "src/components/lang-switcher.tsx",
  "src/components/site-icons.tsx",
  "src/components/box-icon.tsx",
  "src/components/site-header.tsx",
  "src/components/business-detail.tsx",
  "src/components/directory.tsx",
  "src/components/pdf-progress.tsx",
  "src/components/admin-special-access.tsx",
  "src/components/auth-shell.tsx",
  "src/components/register-notice.tsx",
  "src/components/gallery-grid.tsx",
  "src/components/media-info.tsx",
  "src/components/news-client.tsx",
  "src/components/site-sections.tsx",
  "src/components/site-footer.tsx",
  "src/components/home-sections.tsx",
  "src/lib/data.ts",
  "src/lib/i18n.tsx",
  "src/lib/types.ts",
  "src/lib/gallery-social.ts",
  "src/lib/media-info.ts",
  "src/lib/pdf-register.ts",
  "src/lib/register-rows.ts",
  "src/lib/member-update.ts",
  "src/lib/special-access.ts",
  "src/lib/admin-account.ts",
  "src/lib/register-notice.ts",
  "src/lib/motion-compat.ts",
  "src/lib/animation-settings.ts",
  "src/lib/branch-settings.ts",
  "src/lib/site-source-assets.ts",
  "src/lib/supabase/storage.ts",
  "next.config.ts",
];

// ============================================================================
//  🆕 AUTO-DISCOVER — ඉදිරියේදී එකතු කරන **ඕනෑම** design/update file එකක්
//     backup එකට අපේම එකතු වේ. අතින් FILES list එකට දාන්න ඕන නෑ.
//     (ඉහත FILES list එක = අනිවාර්ය ලැයිස්තුව; auto-discover එකෙන් අමතර ඒවා එකතු වේ.)
//
//  🔒 secrets/සර්වර් code කවදාවත් snapshot එකට නොයයි — snapshot එක browser
//     bundle එකට යන නිසා (backup.ts client එකේත් import වේ). Deny-list:
//       src/app/api/**         → API routes (service keys, cron secrets)
//       src/lib/supabase/**    → Supabase clients
//       *.generated.ts         → මේ ගොනුවම
//       .env*, *.pem, *.key    → ඕනෑම secret file
// ============================================================================
import { readdirSync, statSync } from "node:fs";
import { relative } from "node:path";

const AUTO_ROOTS = ["src", "."]; // src එකේ සියල්ල + root config files
const AUTO_EXT = /\.(tsx?|css|md|json|mjs)$/;
const DENY = [
  /^src\/lib\/supabase\//, // client wrappers (env-only) — පහළ content guard එකෙන් රහස් ඉවත් වේ
  /\.generated\.ts$/,
  /^\.env/,
  /\.(pem|key|crt|p12)$/,
  /^node_modules\//,
  /^\.next\//,
  /^supabase\//,
  /^scripts\//,
  /^public\//,
  /package-lock\.json$/,
];
const isDenied = (rel) => DENY.some((re) => re.test(rel));

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (AUTO_EXT.test(name)) {
      const rel = relative(root, full).split("\\").join("/");
      if (!isDenied(rel)) out.push(rel);
    }
  }
}
const discovered = [];
for (const r of AUTO_ROOTS) {
  try {
    walk(join(root, r), discovered);
  } catch {
    /* root නැත්නම් skip */
  }
}
// root එකේ .md/.json වගේ ගොනු auto-discover කරන්නේ නෑ (package.json වගේ) — FILES එකේ ඒවා තියෙනවා
const rootOnlySafe = discovered.filter((rel) => {
  if (!rel.includes("/")) return /^(next\.config|tsconfig|SECURITY)\.?(ts|json|md)?$/.test(rel) || rel === "SECURITY.md" || rel === "next.config.ts";
  return true;
});
// 🔐 Content guard — file එකක **ඇතුළෙම** රහසක් (JWT / private key / hard-coded
//    password) හමු වුණොත් ඒක snapshot එකෙන් ඉවත් කරයි. ඒ නිසා API routes වගේ
//    files auto-add කළත් backup ZIP එකෙන් රහස් පිටතට යන්නේ නෑ.
const SECRET_PATTERNS = [
  /eyJhbGciOi[A-Za-z0-9._-]{20,}/, // Supabase JWT (anon/service)
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  // ඇත්ත මුරපදයක් වගේ පෙනෙන අගයක් (අකුරු+විශේෂ ලකුණු, space නෑ) — "Password" label එකට අහු නොවේ
  /(?:password|secret|api[_-]?key)\s*[:=]\s*["'](?=[^"'\s]*[@#$!%^&*])[^"'\s]{8,}["']/i,
];
const quarantined = [];
const ALL = [...new Set([...FILES, ...rootOnlySafe])].filter((rel) => {
  let text = "";
  try {
    text = readFileSync(join(root, rel), "utf8");
  } catch {
    return false;
  }
  if (SECRET_PATTERNS.some((re) => re.test(text))) {
    quarantined.push(rel);
    return false;
  }
  return true;
});
if (quarantined.length) console.log(`secret guard: skipped ${quarantined.join(", ")}`);

const entries = ALL.map((path) => {
  const content = readFileSync(join(root, path), "utf8");
  return `  { path: ${JSON.stringify(path)}, content: ${JSON.stringify(content)} },`;
});

const out = [
  "// ⚠ AUTO-GENERATED by scripts/gen-site-source.mjs (prebuild/predev) — අතින් edit කරන්න එපා.",
  "// Backup Format v3: ZIP එකේ site-source/ එකට යන design/update source snapshot එක.",
  `export const SITE_PACKAGE_VERSION = ${JSON.stringify(SITE_PACKAGE_VERSION)};`,
  "export interface SiteSourceFile { path: string; content: string }",
  "export const SITE_SOURCE_FILES: SiteSourceFile[] = [",
  ...entries,
  "];",
  "",
].join("\n");

writeFileSync(join(root, "src/lib/site-source.generated.ts"), out, "utf8");
console.log(
  `site-source snapshot: ${ALL.length} files → src/lib/site-source.generated.ts ` +
    `(curated ${FILES.length} + auto-discovered ${ALL.length - FILES.filter((f) => ALL.includes(f)).length})`
);

// ============================================================================
//  🖼 PUBLIC ASSETS MANIFEST — `public/` එකේ තියෙන **හැම** file එකක්ම
//     auto-generate වේ → ඉදිරියේදී එකතු කරන icon/image/font එකක් backup ZIP
//     එකට (site-assets/public/) අපේම එකතු වේ.
// ============================================================================
const publicFiles = [];
function walkPublic(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkPublic(full);
    else {
      const rel = relative(join(root, "public"), full).split("\\").join("/");
      // ආරක්ෂාව: .map / source files වගේ ඒවා අවශ්‍ය නෑ
      if (!/\.(map|ts|tsx|d\.ts)$/.test(rel)) publicFiles.push(rel);
    }
  }
}
walkPublic(join(root, "public"));
publicFiles.sort();

const assetsOut = [
  "// ⚠ AUTO-GENERATED by scripts/gen-site-source.mjs — අතින් edit කරන්න එපා.",
  "// Backup Format v3: `public/` එකේ හැම file එකක්ම site-assets/public/ එකට යයි.",
  "export const PUBLIC_ASSET_FILES: string[] = [",
  ...publicFiles.map((p) => `  ${JSON.stringify(p)},`),
  "];",
  "",
].join("\n");
writeFileSync(join(root, "src/lib/public-assets.generated.ts"), assetsOut, "utf8");
console.log(`public assets manifest: ${publicFiles.length} files → src/lib/public-assets.generated.ts`);
