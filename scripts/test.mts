// ============================================================================
//  Panduwasnuwara MPCS — logic & data verification tests
//  ක්‍රියා කරවන්න: npm test   (npx tsx scripts/test.ts)
// ============================================================================

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dirname, "..");
let pass = 0, fail = 0;

function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ""}`); }
}

// ---- import TS modules via tsx ----
const seed = await import("../src/lib/seed.ts");
const auth = await import("../src/lib/auth.ts");
const branchSettings = await import("../src/lib/branch-settings.ts");
const animSettings = await import("../src/lib/animation-settings.ts");
const motionCompat = await import("../src/lib/motion-compat.ts");
const memberUpdate = await import("../src/lib/member-update.ts");
const specialAccess = await import("../src/lib/special-access.ts");

console.log("\n── 1) Seed data (screenshots) ──");
ok("14 business divisions", seed.BUSINESSES.length === 14, `got ${seed.BUSINESSES.length}`);
const svcCount = seed.BUSINESSES.reduce((n, b) => n + b.services.length, 0);
ok("Business services total (63 across 14 units)", svcCount === 63, `got ${svcCount}`);
ok("Rural Bank has 6 services", seed.BUSINESSES.find((b) => b.slug === "rural-bank")!.services.length === 6);
ok("22 Rural Bank branches", seed.RURAL_BANK_BRANCHES.length === 22, `got ${seed.RURAL_BANK_BRANCHES.length}`);
ok("9 board members", seed.BOARD.length === 9, `got ${seed.BOARD.length}`);
ok("3 news items", seed.NEWS.length === 3, `got ${seed.NEWS.length}`);
ok("3 gallery items", seed.GALLERY.length === 3, `got ${seed.GALLERY.length}`);
const dir = await import("../src/lib/directory-rows.ts");
ok("52 member Excel files, rows sum = 52,964",
  dir.MEMBER_FILES.length === 52 && dir.MEMBER_FILES.reduce((n, f) => n + f.rows, 0) === 52964,
  `files=${dir.MEMBER_FILES.length} sum=${dir.MEMBER_FILES.reduce((n, f) => n + f.rows, 0)}`);
ok("Primary 6 files exact (3600/2363/2166/2073/2001/1989)",
  ["Hettipola.xlsx|3600","Panduwasnuwara.xlsx|2363","Diyulwawa.xlsx|2166","Barampola.xlsx|2073","Kanogama.xlsx|2001","Madulla.xlsx|1989"]
    .every((s, i) => dir.MEMBER_FILES[i].file_name === s.split("|")[0] && dir.MEMBER_FILES[i].rows === Number(s.split("|")[1])));
ok("1 voter file (2359 rows)", dir.VOTER_FILES.length === 1 && dir.VOTER_FILES[0].rows === 2359);
ok("Members registry = 52,964 rows", dir.getMemberRows().length === 52964, `got ${dir.getMemberRows().length}`);
ok("Voters registry = 2,359 rows", dir.getVoterRows().length === 2359, `got ${dir.getVoterRows().length}`);
ok("Members pagination: ceil(52964/25) = 2119 pages", Math.ceil(52964 / 25) === 2119);
ok("Voters pagination: ceil(2359/25) = 95 pages", Math.ceil(2359 / 25) === 95);
ok("Captured head rows preserved (41/01 මුදිත ලියනආරච්චි)", dir.getMemberRows()[0].member_no === "41/01" && dir.getMemberRows()[0].full_name.includes("මුදිත"));
ok("Captured voter head (01/01)", dir.getVoterRows()[0].voter_no === "01/01");

console.log("\n── 2) Fuel prices (req #5) ──");
const fuel = Object.fromEntries(seed.FUEL_PRICES.map((f) => [f.type, f.price]));
ok("Petrol 92 = 414", fuel.petrol92 === 414);
ok("Super Diesel = 528", fuel.super_diesel === 528);
ok("Kerosene = 285", fuel.kerosene === 285);

console.log("\n── 3) System settings (req #1 contact email, #2 WhatsApp) ──");
ok("WhatsApp number 94742352670", seed.SETTINGS.whatsapp_number === "94742352670");
ok("Designer social links (footer popup)", seed.SITE.designer.whatsapp === "https://wa.me/94764247716" && seed.SITE.designer.facebook === "https://www.facebook.com/profile.php?id=61595473522949");
const footerSrc = readFileSync(join(root, "src/components/site-footer.tsx"), "utf8");
const headerSrc = readFileSync(join(root, "src/components/site-header.tsx"), "utf8");
ok("Header brand always shows the full Panduwasnuwara New MPCS LTD name (mobile lockup, no truncation)",
  headerSrc.includes("Panduwasnuwara New MPCS LTD") &&
  headerSrc.includes('data-testid="site-brand"') &&
  headerSrc.includes("MPCS LTD") &&
  !headerSrc.includes("max-w-[150px]") &&
  !headerSrc.includes("{isHome ? t.brand : t.brandFull}") );
const hubRouteSrc = readFileSync(join(root, "src/app/hub/route.ts"), "utf8");
const hubHtml = readFileSync(join(root, "src/app/hub/hub.html"), "utf8");
const middlewareSrc = readFileSync(join(root, "src/middleware.ts"), "utf8");
const permissionsPolicySrc = readFileSync(join(root, "src/lib/permissions-policy.ts"), "utf8");
const permissionsPolicyModule = await import("../src/lib/permissions-policy.ts");
const adminShellEarlySrc = readFileSync(join(root, "src/components/admin.tsx"), "utf8");
ok("Hidden /hub standalone page is direct-URL-only (no public/admin link)",
  hubRouteSrc.includes('from "./hub.html"') &&
  hubRouteSrc.includes("text/html; charset=utf-8") &&
  hubRouteSrc.includes("noindex, nofollow") &&
  middlewareSrc.includes('"/hub"') &&
  hubHtml.includes("<title>Panduwasnuwara MPCS LTD | Official Links</title>") &&
  !headerSrc.includes('"/hub"') &&
  !footerSrc.includes('"/hub"') &&
  !adminShellEarlySrc.includes('"/hub"'));
ok("Footer social icons use Admin links; designer popup stays separate",
  footerSrc.includes('const footerFbHref = socialLinks?.fb || "#";') &&
  footerSrc.includes("socialLinks?.wa ||") &&
  footerSrc.includes("href={SITE.designer.whatsapp}") &&
  footerSrc.includes("href={SITE.designer.facebook}") &&
  !footerSrc.includes("socialLinks?.wa || SITE.designer") &&
  !footerSrc.includes("socialLinks?.fb || SITE.designer"));
const exampleUiSrc = [
  "src/components/live-chat.tsx",
  "src/app/signin/page.tsx",
  "src/app/register/page.tsx",
  "src/components/apply-form.tsx",
  "src/components/site-sections.tsx",
  "src/app/admin/data/page.tsx",
  "src/lib/search.ts",
  "src/lib/auth.ts",
].map((p) => readFileSync(join(root, p), "utf8")).join("\n");
const nicExampleTokens = [...exampleUiSrc.matchAll(/(?<![\d-])(?:\d{9}V|\d{12})(?![\d-])/g)].map((m) => m[0]);
ok("Examples use Maduranga + fake NIC formats only (no personal example name/NIC)",
  nicExampleTokens.length > 0 &&
  nicExampleTokens.every((x) => x === "123456789V" || x === "123456789012") &&
  exampleUiSrc.includes("Maduranga") &&
  exampleUiSrc.includes("මදුරංග"));
ok("contact email itk200712@gmail.com", seed.SETTINGS.contact_email_1 === "itk200712@gmail.com");
ok("Years of service 50", seed.SETTINGS.years_of_service === 50 || seed.SETTINGS.years_of_service === "50");
ok("Hero images 5ක් (auto-change slideshow)", Array.isArray(seed.SETTINGS.hero_images) && seed.SETTINGS.hero_images.length === 5, `got ${seed.SETTINGS.hero_images?.length}`);
ok("Hero image files exist (hero-1..5)", seed.SETTINGS.hero_images.every((h: string) => h.startsWith("/images/hero/hero-")));

console.log("\n── 4) Login logic (req #3 NIC login, #7 password display) ──");
ok("nicToEmail('931234567v')", auth.nicToEmail("931234567v") === "931234567v@members.mpcs.lk");
ok("nicToEmail lowercases NIC", auth.nicToEmail("931234567V") === "931234567v@members.mpcs.lk");
const b64 = Buffer.from("Kenula@123").toString("base64");
ok("decodePw(base64) round-trips", auth.decodePw(b64) === "Kenula@123", `got ${auth.decodePw(b64)}`);
ok("NIC/phone formats (9+V or 12 · 0+9 more or +94+9)",
  auth.validateNic("123456789V") === null &&
  auth.validateNic("123456789v") === null &&
  auth.validateNic("123456789012") === null &&
  auth.validateNic("12345678V") !== null &&
  auth.validateNic("12345678901") !== null &&
  auth.validateNic("123456789") !== null &&
  auth.validatePhone("0771234567") === null &&
  auth.validatePhone("+94771234567") === null &&
  auth.validatePhone("077123456") !== null &&
  auth.validatePhone("+9477123456") !== null &&
  auth.validatePhone("07712345678") !== null &&
  auth.normalizeNic(" 123 456 789 v ") === "123456789V" &&
  auth.normalizePhone("+94 77-1234567") === "+94771234567" &&
  auth.looksLikeNicAttempt("12345678V") === true &&
  auth.looksLikeNicAttempt("Maduranga") === false &&
  auth.looksLikeNicAttempt("41/01") === false);

console.log("\n── 5) WhatsApp recovery link format (req #2) ──");
const wa = `https://wa.me/${seed.SETTINGS.whatsapp_number}?text=${encodeURIComponent("test")}`;
ok("wa.me/94742352670 link", wa.startsWith("https://wa.me/94742352670?text="));

console.log("\n── 6) email service endpoint (req #1) ──");
ok("mail service is SMTP-only", readFileSync(join(root, "src/lib/mail-server.ts"), "utf8").includes("nodemailer.createTransport"));

console.log("\n── 7) Default business template (req #4) ──");
const fresh = seed.BUSINESSES.find((b) => b.slug === "ristbury-tiara");
ok("Hemas-format default features", fresh.services[0].features_en.includes("Trusted quality") && fresh.services[0].features_en.includes("Member privileges") && fresh.services[0].features_en.includes("Certified standard"));
ok("Default desc fallback present", fresh.services[0].desc_en.startsWith("Premier service offered by"));
const hemas = seed.BUSINESSES.find((b) => b.slug === "hemas");
ok("Hemas page has its own default-style services (6)", hemas.services.length === 6);
const businessDetailSrc = readFileSync(join(root, "src/components/business-detail.tsx"), "utf8");
const businessPageSrc = readFileSync(join(root, "src/app/businesses/[slug]/page.tsx"), "utf8");
const adminBusinessesSrc = readFileSync(join(root, "src/app/admin/businesses/page.tsx"), "utf8");
const siteSectionsSrc = readFileSync(join(root, "src/components/site-sections.tsx"), "utf8");
const contactInfoSrc = readFileSync(join(root, "src/components/contact-info.tsx"), "utf8");
const globalsCssSrc = readFileSync(join(root, "src/app/globals.css"), "utf8");
const supabaseClientSrc = readFileSync(join(root, "src/lib/supabase/client.ts"), "utf8");
ok("Coop City branches: five Admin-managed cards above Department Contact & Inquiries",
  businessDetailSrc.includes("export function CoopCityBranches") &&
  businessDetailSrc.includes("Our Coop City & Mini Coop City Branch") &&
  businessDetailSrc.includes("Coop City Type") &&
  businessDetailSrc.includes("Manager Name") &&
  businessDetailSrc.includes("Hot Line") &&
  businessDetailSrc.includes('b.slug !== "coop-city"') &&
  businessPageSrc.indexOf("<CoopCityBranches") > -1 &&
  businessPageSrc.indexOf("<CoopCityBranches") < businessPageSrc.indexOf("<BusinessContacts") &&
  adminBusinessesSrc.includes("COOP_CITY_BRANCH_LIMIT = 5") &&
  adminBusinessesSrc.includes("Our Coop City & Mini Coop City Branch Settings") &&
  adminBusinessesSrc.includes("const [branchRows, setBranchRows]") &&
  adminBusinessesSrc.includes('dbDelete("business_branches"') &&
  adminBusinessesSrc.includes("dbInsertMany(") &&
  adminBusinessesSrc.includes('"business_branches"') &&
  !adminBusinessesSrc.includes('role_en: "Regional Branch"'));
ok("Branch first-save regression: empty replace-delete cannot block inserts + detail page is live",
  adminShellEarlySrc.includes("opts: { allowEmpty?: boolean }") &&
  adminShellEarlySrc.includes("!opts.allowEmpty") &&
  adminBusinessesSrc.includes('dbDelete("business_contacts", { business_slug: editFor.slug }, { allowEmpty: true })') &&
  adminBusinessesSrc.includes('dbDelete("business_branches", { business_slug: editFor.slug }, { allowEmpty: true })') &&
  businessPageSrc.includes('export const dynamic = "force-dynamic"'));
ok("Consumer page: long Regional rows above separate Sales/Store manager rows + branch Delete setting",
  businessDetailSrc.includes("export function ConsumerManagerContacts") &&
  businessDetailSrc.includes("Manager Type") &&
  businessDetailSrc.includes("Regional Name") &&
  businessDetailSrc.includes("Manager Name") &&
  businessDetailSrc.includes('b.special === "consumer"') &&
  businessDetailSrc.includes("mx-auto mt-8 grid max-w-6xl items-start gap-6") &&
  businessDetailSrc.includes("contact-pro-amber self-start") &&
  businessPageSrc.indexOf("<RegionalBranches") > -1 &&
  businessPageSrc.indexOf("<RegionalBranches") < businessPageSrc.indexOf("<BusinessContacts") &&
  adminBusinessesSrc.includes("To delete Mandapola or any other branch") &&
  adminBusinessesSrc.includes("Delete this branch") &&
  adminBusinessesSrc.includes('"Regional Name"'));
ok("Site-wide professional animated contact cards",
  globalsCssSrc.includes("@keyframes contactRise") &&
  globalsCssSrc.includes(".contact-pro-card") &&
  globalsCssSrc.includes(".contact-pro-call") &&
  globalsCssSrc.includes("prefers-reduced-motion") &&
  siteSectionsSrc.includes("contact-pro-card contact-pro-indigo") &&
  siteSectionsSrc.includes("contact-pro-card contact-pro-slate") &&
  businessDetailSrc.includes("contact-pro-card contact-pro-charm") &&
  globalsCssSrc.includes(".contact-pro-charm .contact-pro-hotline") &&
  businessDetailSrc.includes("contact-pro-hotline") &&
  businessDetailSrc.includes("contact-pro-call") &&
  contactInfoSrc.includes("card contact-pro-card contact-pro-indigo"));
ok("Branch settings helpers: Rural rows renumber/delete-all + branch photos map by slug/name",
  branchSettings.parseRuralBankBranches("[]", seed.RURAL_BANK_BRANCHES).length === 0 &&
  branchSettings.normalizeRuralBankBranches([{ name: "A Branch", name_si: "අ ශාඛාව", manager: "M", phone: "037" }])[0].no === "01" &&
  branchSettings.withBranchPhotos(
    [{ name: "Hettipola Coop City", manager: "S", location: "Near Office", phone: "076" }],
    "coop-city",
    branchSettings.nextBranchPhotoMap({}, "coop-city", [{ name: "Hettipola Coop City", manager: "S", location: "Near Office", phone: "076", photo: "https://example.com/a.jpg" }])
  )[0].photo === "https://example.com/a.jpg");
ok("Branch photo/Rural edit-delete settings + fast Admin business save",
  adminShellEarlySrc.includes("export async function dbInsertMany") &&
  adminBusinessesSrc.includes("Rural Bank Branch Network Settings") &&
  adminBusinessesSrc.includes("Branch Name (Sinhala)") &&
  adminBusinessesSrc.includes("Branch Photo") &&
  adminBusinessesSrc.includes("uploadBranchPhoto") &&
  adminBusinessesSrc.includes("Promise.all([replaceContacts(), replaceBranches()])") &&
  adminBusinessesSrc.includes('editSaving ? "Saving..." : "Save Changes"') &&
  supabaseClientSrc.includes("let cachedClient") &&
  supabaseClientSrc.includes("let authReady") &&
  businessDetailSrc.includes("export function RuralBankNetwork({ b }") &&
  businessDetailSrc.includes("br.photo") &&
  businessPageSrc.includes("<RuralBankNetwork b={b} />"));
const siteIconsSrc = readFileSync(join(root, "src/components/site-icons.tsx"), "utf8");
const siteHeaderSrc = readFileSync(join(root, "src/components/site-header.tsx"), "utf8");
const rootLayoutSrc = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
const cursorFollowerSrc = readFileSync(join(root, "src/components/cursor-follower.tsx"), "utf8");
const typesSrc = readFileSync(join(root, "src/lib/types.ts"), "utf8");
const uploadedIconFiles = readdirSync(join(root, "public/icons"));
ok("Services edit/delete persist by id + uploaded site icons + mega/cursor professional polish",
  adminBusinessesSrc.includes("const [editingService") &&
  adminBusinessesSrc.includes("openEditService") &&
  adminBusinessesSrc.includes('dbUpdate("business_services", serviceMatch') &&
  adminBusinessesSrc.includes('dbDelete("business_services", serviceMatch') &&
  !adminBusinessesSrc.includes('show("Edit service")') &&
  !adminBusinessesSrc.includes('dbDelete("business_services", { business_slug: current.slug, order: s.order })') &&
  typesSrc.includes("id?: string;") &&
  ["phone-call.png", "location.png", "comment.png", "message.png"].every((f) => uploadedIconFiles.includes(f)) &&
  siteIconsSrc.includes("PhoneImageIcon") &&
  siteIconsSrc.includes("LocationImageIcon") &&
  siteIconsSrc.includes("CommentImageIcon") &&
  siteIconsSrc.includes("MessageImageIcon") &&
  businessDetailSrc.includes("PhoneImageIcon as PhoneCall") &&
  businessDetailSrc.includes("LocationImageIcon as MapPin") &&
  adminShellEarlySrc.includes("MessageImageIcon as MessageCircle") &&
  globalsCssSrc.includes("@keyframes siteIconRing") &&
  globalsCssSrc.includes("@keyframes siteIconPin") &&
  globalsCssSrc.includes("@keyframes megaItemIn") &&
  globalsCssSrc.includes(".cursor-fx-ring") &&
  siteHeaderSrc.includes("--mega-index") &&
  siteHeaderSrc.includes("mega-item-current") &&
  rootLayoutSrc.includes("<CursorFollower />") &&
  cursorFollowerSrc.includes('(pointer: fine)') &&
  cursorFollowerSrc.includes("prefers-reduced-motion: reduce"));
ok("animation settings helpers: brightness clamp + unlimited products dedupe + constant marquee speed",
  animSettings.BUSINESS_ANIMATION_KEY === "business_animation_settings" &&
  animSettings.clampAnimationBrightness(5) === 10 &&
  animSettings.clampAnimationBrightness(999) === 120 &&
  animSettings.clampAnimationBrightness("abc") === 55 &&
  animSettings.parseBusinessAnimations(JSON.stringify({
    "coop-city": { bgImage: " https://x/bg.jpg ", brightness: 40, products: ["a.jpg", "a.jpg", "b.jpg"] },
    hemas: { bgImage: "", brightness: 55, products: [] },
  }))["coop-city"].products.join(",") === "a.jpg,b.jpg" &&
  animSettings.parseBusinessAnimations(JSON.stringify({ hemas: { products: [] } })).hemas === undefined &&
  animSettings.normalizeBusinessAnimation({ products: Array.from({ length: 25 }, (_, i) => `p${i}.jpg`) }).products.length === 25 &&
  animSettings.animationMarqueeDurationSeconds(1) === 18 &&
  animSettings.animationMarqueeDurationSeconds(8) === 24 &&
  animSettings.animationMarqueeDurationSeconds(20) === 60 &&
  animSettings.getBusinessAnimation({}, "coop-city") === undefined &&
  animSettings.animationWatermarkOpacity(55) === 0.165 &&
  animSettings.animationWatermarkOpacity(120) === 0.35 &&
  animSettings.animationWatermarkOpacity(10) === 0.03);
const adminAnimationSrc = readFileSync(join(root, "src/app/admin/animation/page.tsx"), "utf8");
const siteDataSrc = readFileSync(join(root, "src/lib/data.ts"), "utf8");
ok("animation: Admin section (bg+brightness+products per business) → settings → animated public hero",
  adminShellEarlySrc.includes('href: "/admin/animation"') &&
  adminShellEarlySrc.includes('label: "Animation"') &&
  adminAnimationSrc.includes("BUSINESS_ANIMATION_KEY") &&
  adminAnimationSrc.includes('dbUpsert("system_settings"') &&
  adminAnimationSrc.includes("Background / Watermark Image") &&
  adminAnimationSrc.includes("Watermark Brightness") &&
  adminAnimationSrc.includes("Animated Product Images") &&
  adminAnimationSrc.includes('uploadSiteImage(f, "animation-bg"') &&
  adminAnimationSrc.includes('uploadSiteImage(f, "animation-products"') &&
  siteDataSrc.includes("parseBusinessAnimations") &&
  siteDataSrc.includes("getBusinessAnimation(animations, slug)") &&
  businessDetailSrc.includes("biz-anim-bg") &&
  businessDetailSrc.includes("biz-products-marquee") &&
  businessDetailSrc.includes("export function BusinessPageWatermark") &&
  businessDetailSrc.includes("fixed inset-0 -z-10") &&
  businessDetailSrc.includes("brightness(${brightness}%)") &&
  !businessDetailSrc
    .slice(
      businessDetailSrc.indexOf("export function BusinessHero"),
      businessDetailSrc.indexOf("export function BusinessPageWatermark")
    )
    .includes("bgImage") &&
  businessPageSrc.includes("<BusinessPageWatermark b={b} />") &&
  !adminAnimationSrc.includes("MAX_ANIMATION_PRODUCTS") &&
  adminAnimationSrc.includes("Animated Product Images ({draft.products.length})") &&
  adminAnimationSrc.includes("animationMarqueeDurationSeconds(draft.products.length)") &&
  businessDetailSrc.includes("animationMarqueeDurationSeconds(products.length)") &&
  globalsCssSrc.includes("@keyframes bizProductsScroll") &&
  globalsCssSrc.includes("@keyframes bizMarqueeIn") &&
  globalsCssSrc.includes("@keyframes bizBgZoom") &&
  // marquee track එක නිසා Admin පිටුව screen එකෙන් එළියට පැනලා Save/View Page හැංගෙන්නේ නෑ
  adminAnimationSrc.includes("lg:grid-cols-[320px_minmax(0,1fr)]") &&
  adminAnimationSrc.includes("card min-w-0 max-w-full overflow-hidden p-5") &&
  adminAnimationSrc.includes("field min-w-0 flex-1") &&
  adminAnimationSrc.includes("pb-36") &&
  globalsCssSrc.includes("contain: inline-size"));
const adminGallerySrc = readFileSync(join(root, "src/app/admin/gallery/page.tsx"), "utf8");
ok("gallery: upload ANY number of photos under one tagline (no 3-photo cap, progress, append + chunked batch insert, same title)",
  adminGallerySrc.includes("onBatchPhotos") &&
  adminGallerySrc.includes("batchPhotos") &&
  adminGallerySrc.includes("multiple") &&
  adminGallerySrc.includes("const files = picked;") &&
  !adminGallerySrc.includes("picked.slice(0, 3)") &&
  adminGallerySrc.includes("setBatchPhotos((prev) => [...prev, ...urls])") &&
  adminGallerySrc.includes("batchProgress") &&
  adminGallerySrc.includes("i += CONCURRENCY") &&
  adminGallerySrc.includes("i += 50") &&
  adminGallerySrc.includes('dbInsertMany("gallery_items"') &&
  adminGallerySrc.includes("එකවර Photos ඕනෑම ගණනක්") &&
  adminGallerySrc.includes("Upload Photos (Any Number)"));
ok("gallery admin delete: empty DB does not resurrect seed/default photos + stale default delete succeeds + storage cleanup",
  adminGallerySrc.includes('isSupabaseConfigured() ? [] : [...GALLERY]') &&
  adminGallerySrc.includes('((data ?? []) as unknown as GalleryItem[])') &&
  !adminGallerySrc.includes('if (data && data.length > 0)') &&
  adminGallerySrc.includes('.select("id")') &&
  adminGallerySrc.includes('.maybeSingle()') &&
  adminGallerySrc.includes("පරණ default image එක අයින් කළා") &&
  adminGallerySrc.includes("deleteSiteImage") &&
  adminGallerySrc.includes("deletingId"));

console.log("\n── 8) Board categories (director board page) ──");
ok("chairman=1, vice-chairman=1", seed.BOARD.filter((m) => m.category === "chairman").length === 1 && seed.BOARD.filter((m) => m.category === "vice-chairman").length === 1);
ok("5 directors (screenshots: 9 total = 1+1+5+2)", seed.BOARD.filter((m) => m.category === "director").length === 5);
ok("2 officers", seed.BOARD.filter((m) => m.category === "officer").length === 2);

console.log("\n── 9) Service titles from screenshot lists (req #10 data) ──");
const rb = seed.BUSINESSES.find((b) => b.slug === "rural-bank").services.map((s) => s.title_en);
ok("Rural Bank: Savings Accounts", rb.includes("Savings Accounts"));
ok("Rural Bank: Gold Pawning & Jewellery Loans", rb.includes("Gold Pawning & Jewellery Loans"));
const fuelSvc = seed.BUSINESSES.find((b) => b.slug === "fuel-station").services.map((s) => s.title_en);
ok("Fuel Station: Fuel Pass Scheme for Members", fuelSvc.includes("Fuel Pass Scheme for Members"));
ok("Fuel Station: Priority Queue for Members", fuelSvc.includes("Priority Queue for Members"));

console.log("\n── 10) SQL files (separate schema + seed) ──");
const schema = readFileSync(join(root, "supabase/schema.sql"), "utf8");
const seedSql = schema; // එකම SQL file එකේ schema + data + storage ඔක්කොම
ok("supabase/ එකේ SQL files: schema.sql + scheduled-backup.sql විතරයි (අනවශ්‍ය fragments නෑ)",
  JSON.stringify(readdirSync(join(root, "supabase")).filter((f) => f.endsWith(".sql")).sort()) ===
    JSON.stringify(["scheduled-backup.sql", "schema.sql"]),
  readdirSync(join(root, "supabase")).filter((f) => f.endsWith(".sql")).join(","));
ok("SQL එකේ පැරණි සමිති දත්ත නැත", !schema.toLowerCase().includes("samrudhi"));
ok("SQL එකේ image storage bucket", schema.includes("site-images") && schema.includes("storage.buckets"));
for (const t of ["profiles", "login_lookup", "business_units", "business_services", "business_contacts",
  "business_branches", "board_members", "news", "gallery_items", "gallery_comments", "messages",
  "membership_applications", "member_rows", "voter_rows", "data_files", "fuel_prices", "system_settings",
  "protect_role_change"]) {
  ok(`schema has ${t}`, schema.includes(t));
}
ok("seed.sql has superadmin user", seedSql.includes("superadmin@members.mpcs.lk"));
ok("seed.sql has fuel prices", seedSql.includes("('petrol92', 414)"));
ok("seed.sql has WhatsApp setting", seedSql.includes("'94742352670'"));
ok("seed.sql has hero_images JSON", seedSql.includes("hero_images") && seedSql.includes("/images/hero/hero-5.jpg"));

console.log("\n── 11) Baymax chatbot brain (src/lib/chatbot.ts) ──");
const bot = await import("../src/lib/chatbot.ts");
ok("bot: 'hi' → hi", bot.detectSmalltalk("hi")?.intent === "hi");
ok("bot: 'Hii Baymax' → hi", bot.detectSmalltalk("Hii Baymax")?.intent === "hi");
ok("bot: 'hellow' → hello", bot.detectSmalltalk("hellow")?.intent === "hello");
ok("bot: 'Hello!' → hello", bot.detectSmalltalk("Hello!")?.intent === "hello");
ok("bot: 'kohomada' → how_are_you", bot.detectSmalltalk("kohomada")?.intent === "how_are_you");
ok("bot: 'කොහොමද' → how_are_you", bot.detectSmalltalk("ඔයාට කොහොමද?")?.intent === "how_are_you");
ok("bot: 'how are you' → how_are_you", bot.detectSmalltalk("how are you")?.intent === "how_are_you");
ok("bot: 'මම හොඳින්' → wellbeing_good", bot.detectSmalltalk("මමත් හොඳින්")?.intent === "wellbeing_good");
ok("bot: 'hodin' → wellbeing_good", bot.detectSmalltalk("hodin")?.intent === "wellbeing_good");
ok("bot: 'not good' → wellbeing_bad", bot.detectSmalltalk("not good")?.intent === "wellbeing_bad");
ok("bot: 'ආයුබෝවන්' → ayubowan", bot.detectSmalltalk("ආයුබෝවන්")?.intent === "ayubowan");
ok("bot: 'good morning' → daypart/morning", bot.detectSmalltalk("good morning")?.part === "morning");
ok("bot: 'bohoma sthuthi' → thanks", bot.detectSmalltalk("bohoma sthuthi")?.intent === "thanks");
ok("bot: 'bye' → bye", bot.detectSmalltalk("bye")?.intent === "bye");
ok("bot: 'ඔයා කවුද' → who_are_you", bot.detectSmalltalk("ඔයා කවුද?")?.intent === "who_are_you");
ok("bot: bare 'නම මොකක්ද' → who_are_you (bot's name)", bot.detectSmalltalk("නම මොකක්ද?")?.intent === "who_are_you");
ok("bot: 'ඔයාගේ නම මොකක්ද' → who_are_you", bot.detectSmalltalk("ඔයාගේ නම මොකක්ද?")?.intent === "who_are_you");
ok("bot: chairman-name question is NOT smalltalk", bot.detectSmalltalk("සභාපතිගේ නම මොකක්ද?") === null);
ok("bot: society-name question is NOT smalltalk", bot.detectSmalltalk("සමිතියේ නම මොකක්ද?") === null);
ok("bot: Singlish society-name is NOT smalltalk", bot.detectSmalltalk("samithiye nama mokakda") === null);
ok("bot: 'how to join' කොහොමද is NOT how_are_you", bot.detectSmalltalk("සාමාජික වෙන්නේ කොහොමද?") === null);
ok("bot: 'help' → help", bot.detectSmalltalk("help")?.intent === "help");
ok("bot: random text → no smalltalk", bot.detectSmalltalk("xyzzy frobnicate") === null);
ok("bot: name intro (en)", bot.detectNameIntro("My name is Nimal Perera") === "Nimal Perera");
ok("bot: name intro (si)", bot.detectNameIntro("මගේ නම Nimal Perera") === "Nimal Perera");
ok("bot: 'I am fine' is NOT a name", bot.detectNameIntro("I am fine") === null);
ok("bot: 'fuel prices' → fuel picker", bot.detectFuel("fuel prices")?.type === null);
ok("bot: 'petrol price' → petrol92", bot.detectFuel("petrol price kiyada")?.type === "petrol92");
ok("bot: 'ඩීසල් මිල' → super_diesel", bot.detectFuel("ඩීසල් මිල කීයද")?.type === "super_diesel");
ok("bot: 'kerosene' → kerosene", bot.detectFuel("kerosene")?.type === "kerosene");
ok("bot: 'news' → news", bot.detectNews("latest news") !== null && bot.detectNews("latest news")?.category === null);
ok("bot: 'job vacancies' → vacancy", bot.detectNews("job vacancies")?.category === "vacancy");
ok("bot: 'ටෙන්ඩර්' → tender", bot.detectNews("අලුත් ටෙන්ඩර් තියෙනවද")?.category === "tender");
ok("bot: 'gallery' → gallery", bot.detectGallery("gallery photos") === true);
ok("bot: 'ඡායාරූප' → gallery", bot.detectGallery("ඡායාරූප බලන්න") === true);
ok("bot: si reply for Singlish", bot.replyIsSi("kohomada", false) === true);
ok("bot: en reply stays en", bot.replyIsSi("hello there friend", false) === false);
ok("bot: complaint → officer", bot.detectComplaint("මට පැමිණිල්ලක් තියෙනවා") === true);
ok("bot: loan → banking", bot.detectBanking("loan ekak ganna oni") === true);

// Screenshot case: English UI එකේ තිබියදී සිංහලෙන් “මට ඔෆිස් එකේ කෙනෙක්ව
// සම්බන්ද කරගන්න ඕන” කියූ විට officer flow එකට යා යුතුයි — සම්බන්ධ වචනය
// ලියන තුන් ආකාරයෙන්ම (න්ධ / න්ද / ඳ).
ok("bot: Sinhala spelling variants fold to සම්බන්ද", bot.normalizeSinhalaText("සම්බන්ධ / සම්බඳ / සබඳ") === "සම්බන්ද / සම්බන්ද / සම්බන්ද");
ok("bot: cleanText keeps හොඳ unchanged", bot.cleanText("හොඳින්") === "හොඳින්");
ok("bot: officer request — සම්බන්ධ spelling", bot.detectOfficerRequest("මට ඔෆිස් එකේ කෙනෙක්ව සම්බන්ධ කරගන්න ඕන") === true);
ok("bot: officer request — සම්බන්ද spelling", bot.detectOfficerRequest("මට ඔෆිස් එකේ කෙනෙක්ව සම්බන්ද කරගන්න ඕන") === true);
ok("bot: officer request — සම්බඳ spelling", bot.detectOfficerRequest("මට ඔෆිස් එකේ කෙනෙක්ව සම්බඳ කරගන්න ඕන") === true);
ok("bot: officer request — no spaces", bot.detectOfficerRequest("මටඔෆිස්එකේකෙනෙක්වසම්බන්දකරගන්නඕන") === true);
ok("bot: officer request — කාර්යාලයේ කෙනෙක්ට කතා", bot.detectOfficerRequest("කාර්යාලයේ කෙනෙක්ට කතා කරන්න ඕන") === true);
ok("bot: officer request — නිලදාරි misspelling", bot.detectOfficerRequest("නිලදාරියෙක්ට කතා කරන්න ඕන") === true);
ok("bot: officer request — callback", bot.detectOfficerRequest("මට ඇමතුමක් ඉල්ලන්න ඕන") === true);
ok("bot: officer request — Singlish", bot.detectOfficerRequest("mata office eke kenekwa sambanda karaganna ona") === true);
ok("bot: officer request — Singlish talk", bot.detectOfficerRequest("mata office eke kenekta katha karanna ona") === true);
ok("bot: officer request — English", bot.detectOfficerRequest("Please connect me to someone at the office") === true);
ok("bot: officer request — si reply language for Singlish", bot.replyIsSi("mata office eke kenekwa sambanda karaganna ona", false) === true);
ok("bot: office phone question is NOT officer request", bot.detectOfficerRequest("කාර්යාලයේ දුරකථන අංකය මොකක්ද?") === false);
ok("bot: officer name question is NOT officer request", bot.detectOfficerRequest("නිලධාරියාගේ නම මොකක්ද?") === false);
ok("bot: office-hours question is NOT officer request", bot.detectOfficerRequest("කාර්යාලය විවෘත වේලාවන් මොනවාද?") === false);
ok("bot: member search is NOT officer request", bot.detectOfficerRequest("සාමාජික කෙනෙක් සොයන්න ඕන") === false);
ok("bot: generic help is NOT officer request", bot.detectOfficerRequest("මට උදව්වක් ඕන") === false);
ok("bot: how-to question stays with site brain", bot.detectOfficerRequest("නිලධාරියෙක් සම්බන්ද කරගන්නෙ කොහොමද?") === false);
ok("chat: empty history → no Clear chat", bot.hasClearableHistory([]) === false);
ok("chat: system note only → no Clear chat", bot.hasClearableHistory([{ sender: "system" }]) === false);
ok("chat: visitor msg → Clear chat shows", bot.hasClearableHistory([{ sender: "system" }, { sender: "visitor" }]) === true);
ok("chat: officer msg → Clear chat shows", bot.hasClearableHistory([{ sender: "agent" }]) === true);
ok("chat: typing shows only when joined", bot.shouldShowTyping("joined", true) === true);
ok("chat: typing hidden when closed", bot.shouldShowTyping("closed", true) === false);
ok("chat: typing hidden when open/waiting", bot.shouldShowTyping("open", true) === false);
ok("chat: typing hidden when not typing", bot.shouldShowTyping("joined", false) === false);
ok("chat: live composer locked until officer joins (open)", bot.canUseLiveChat("open") === false);
ok("chat: live composer locked when closed", bot.canUseLiveChat("closed") === false);
ok("chat: live composer unlocks when joined", bot.canUseLiveChat("joined") === true);

// Live Chat office hours (Asia/Colombo). Oct 2026: 18=Sun, 19=Mon, 23=Fri, 24=Sat.
const lkTime = (day: number, h: number, m: number) => new Date(Date.UTC(2026, 9, day, h, m) - 330 * 60_000);
ok("hours: Mon 07:30 closed → opens today", bot.getLiveChatHoursStatus(lkTime(19, 7, 30)).open === false && bot.getLiveChatHoursStatus(lkTime(19, 7, 30)).nextOpenInDays === 0);
ok("hours: every weekday Mon–Fri 08:30 open + explicit wording",
  [19, 20, 21, 22, 23].every((d) => bot.isLiveChatOpen(lkTime(d, 8, 30)) === true) &&
  bot.liveChatHoursText(true).includes("සඳුදා සිට සිකුරාදා දක්වා ඕනෑම දිනක") &&
  bot.liveChatHoursText(false).includes("Monday to Friday (any weekday)"));
ok("hours: Mon 17:29 still open", bot.isLiveChatOpen(lkTime(19, 17, 29)) === true);
ok("hours: Mon 17:30 closed → tomorrow (Tue)", bot.getLiveChatHoursStatus(lkTime(19, 17, 30)).nextOpenWeekday === 2 && bot.nextLiveChatOpenPhrase(false, lkTime(19, 17, 30)).includes("Tuesday"));
ok("hours: Fri evening → Saturday", bot.nextLiveChatOpenPhrase(false, lkTime(23, 17, 45)).includes("Saturday"));
ok("hours: Sat 08:29 closed → today", bot.getLiveChatHoursStatus(lkTime(24, 8, 29)).nextOpenInDays === 0);
ok("hours: Sat 13:29 open", bot.isLiveChatOpen(lkTime(24, 13, 29)) === true);
ok("hours: Sat 13:30 closed → Monday (si)", bot.nextLiveChatOpenPhrase(true, lkTime(24, 13, 30)).includes("සඳුදා"));
ok("hours: Sunday → Monday (si)", bot.nextLiveChatOpenPhrase(true, lkTime(18, 10, 0)).includes("සඳුදා") && bot.isLiveChatOpen(lkTime(18, 10, 0)) === false);
ok(
  "chat: close/clear resets Baymax context",
  JSON.stringify(bot.resetBaymaxMemory({ lastIntent: "knowledge", lastTopic: "biz:rural-bank", name: "Nimal" })) === JSON.stringify({ name: "Nimal" }),
);
ok("chat: Baymax reset with no saved name is empty", Object.keys(bot.resetBaymaxMemory({ lastTopic: "biz:hemas" })).length === 0);

console.log("\n── 12) Baymax site brain (src/lib/knowledge.ts) ──");
const knowledge = await import("../src/lib/knowledge.ts");
const knowledgeData = {
  businesses: seed.BUSINESSES,
  board: seed.BOARD,
  ruralBranches: seed.RURAL_BANK_BRANCHES,
  news: seed.NEWS,
  gallery: seed.GALLERY,
  settings: seed.SETTINGS,
};
const knowledgeIndex = knowledge.buildKnowledgeIndex(knowledgeData);
const askSite = (q: string) => knowledge.searchKnowledge(q, knowledgeIndex);
ok("brain: builds a broad dynamic site index", knowledgeIndex.length > 100, `got ${knowledgeIndex.length}`);
ok("brain: Rural Bank services (English)", askSite("What services does the Rural Bank offer?")?.entry.id === "biz-services:rural-bank");
ok("brain: Rural Bank services (Sinhala)", askSite("ග්‍රාමීය බැංකුවේ සේවා මොනවාද?")?.entry.id === "biz-services:rural-bank");
ok("brain: Rural Bank (Singlish)", askSite("gramiya bankuwe sewa monawada")?.entry.topic === "biz:rural-bank");
ok("brain: children's savings service detail", askSite("Children's savings account details")?.entry.id === "service:rural-bank:5");
ok("brain: who is chairman (English)", askSite("Who is the chairman?")?.entry.title_en.includes("Chairman") === true);
ok("brain: who is chairman (Sinhala)", askSite("සභාපති කවුද?")?.entry.title_si.includes("සභාපති") === true);
ok("brain: how many members", askSite("How many members are there?")?.entry.id === "society-counts");
ok("brain: member count (Sinhala)", askSite("සාමාජිකයින් කීයක් ඉන්නවාද?")?.entry.id === "society-counts");
ok("brain: how to join + documents", askSite("How do I become a member and what documents do I need?")?.entry.id === "membership-apply");
ok("brain: membership documents (Sinhala)", askSite("සාමාජිකත්වයට අයදුම් කරන්න අවශ්‍ය ලේඛන මොනවාද?")?.entry.id === "membership-apply");
ok("brain: branch manager/phone", askSite("Mandapola branch manager phone")?.entry.topic === "branch:Mandapola Branch");
ok("brain: business contact by phone intent", askSite("Hemas agency phone number")?.entry.id === "biz-contact:hemas");
ok("brain: misspelled business brand", askSite("Tell me about Restbury")?.entry.topic === "biz:ristbury-tiara");
ok("brain: F28 explanation", askSite("What is F28?")?.entry.id === "f28-help");
ok("brain: forgot password", askSite("I forgot my password")?.entry.id === "account-help");
ok("brain: society vision", askSite("What is the society vision?")?.entry.id === "vision-mission");
ok("brain: society founded date", askSite("When was the society founded?")?.entry.id === "society-about");
ok("brain: number of rural branches", askSite("How many Rural Bank branches are there?")?.entry.id === "rural-bank-branches");
ok("brain: generic 'services' asks for clarification", askSite("services")?.ambiguous === true);
ok("brain: unrelated question returns no invented answer", askSite("What will the weather be tomorrow?") === null);
ok("brain: officer-contact process (Sinhala how-to)", askSite("නිලධාරියෙක් සම්බන්ද කරගන්නෙ කොහොමද?")?.entry.id === "officer-contact-process");
ok("brain: officer-contact process (screenshot wording)", askSite("ඔෆිස් එකේ කෙනෙක්ව සම්බන්ද කරගන්න ඕන")?.entry.id === "officer-contact-process");
ok("brain: officer-contact process (Singlish)", askSite("niladariyek sambanda karaganne kohomada")?.entry.id === "officer-contact-process");
ok("brain: officer-contact process mentions Live Chat hours", askSite("නිලධාරියෙක් සම්බන්ද කරගන්නෙ කොහොමද?")?.entry.body_si.includes("සඳුදා සිට සිකුරාදා දක්වා ඕනෑම දිනක") === true);

// Direct identity facts must answer immediately, not ask for clarification.
const chairman = seed.BOARD.find((p) => p.category === "chairman")!;
const viceChairman = seed.BOARD.find((p) => p.category === "vice-chairman")!;
const generalManager = seed.BOARD.find((p) => /general manager/i.test(p.position_en))!;
const societyNameAnswer = askSite("සමිතියේ නම මොකක්ද?");
ok("brain: society name (Sinhala) is direct", societyNameAnswer?.entry.id === "society-name" && societyNameAnswer.ambiguous === false);
ok("brain: society name returns full public names", societyNameAnswer?.entry.body_si.includes(seed.SITE.name_si) === true && societyNameAnswer.entry.body_en.includes(seed.SITE.name_en) === true);
ok("brain: society full name (English)", askSite("What is the society's full name?")?.entry.id === "society-name");
ok("brain: society name (Singlish)", askSite("samithiye nama mokakda")?.entry.id === "society-name");
ok("brain: chairman name (Sinhala) is direct", askSite("සභාපතිගේ නම මොකක්ද?")?.entry.title_en.includes(chairman.name_en) === true && askSite("සභාපතිගේ නම මොකක්ද?")?.ambiguous === false);
ok("brain: chairman name (misspelled Sinhala)", askSite("සබාපතිගේ නම මොකක්ද?")?.entry.title_en.includes(chairman.name_en) === true);
ok("brain: chairman name (misspelled English)", askSite("chaiman name")?.entry.title_en.includes(chairman.name_en) === true);
ok("brain: chairman name (Singlish)", askSite("sabapathige nama")?.entry.title_en.includes(chairman.name_en) === true);
ok("brain: vice chairman name (Sinhala variant)", askSite("උප සබාපතිගේ නම")?.entry.title_en.includes(viceChairman.name_en) === true);
ok("brain: general manager name", askSite("general manager name")?.entry.title_en.includes(generalManager.name_en) === true);
ok("brain: branch manager name wording", askSite("Mandapola branch manager name")?.entry.topic === "branch:Mandapola Branch");

// Every active division should be reachable from a natural keyword-only query.
const divisionKeywordCases: [string, string][] = [
  ["Ristbury Tiara", "biz:ristbury-tiara"],
  ["supermarket", "biz:coop-city"],
  ["transport", "biz:transport"],
  ["fertilizer", "biz:fertilizer"],
  ["insurance", "biz:insurance"],
  ["rural bank", "biz:rural-bank"],
  ["consumer", "biz:consumer"],
  ["Maliban", "biz:maliban-biscuits"],
  ["Maliban milk", "biz:maliban-kiri"],
  ["Nature's Secrets", "biz:natures-secrets"],
  ["Hemas", "biz:hemas"],
  ["fuel station", "biz:fuel-station"],
  ["funeral", "biz:funeral"],
  ["gold loan", "biz:gold-loan-service"],
];
for (const [query, expectedId] of divisionKeywordCases) {
  const result = askSite(query);
  ok(`brain: keyword '${query}' → ${expectedId}`, result?.entry.id === expectedId && result.ambiguous === false, `got ${result?.entry.id ?? "null"}`);
}
ok("brain: bare keyword score clears widget answer threshold", (askSite("රක්ෂණය")?.score ?? 0) >= 24 && (askSite("Hemas")?.score ?? 0) >= 24);
ok("brain: bare Maliban mentions separate Milk agency", askSite("Maliban")?.entry.body_en.includes("Maliban Milk Agency") === true && askSite("Maliban")?.entry.chips_en.includes("Maliban Milk") === true);
ok("brain: Maliban misspelling (Sinhala)", askSite("මැලිබන්")?.entry.id === "biz:maliban-biscuits");
ok("brain: supermarket (colloquial Sinhala)", askSite("සූපර් මාර්කට්")?.entry.id === "biz:coop-city");
ok("brain: gold pawning picks dedicated Gold Loan division", askSite("රන් උකස්")?.entry.id === "biz:gold-loan-service");
ok("brain: vehicle hire (Sinhala)", askSite("වාහනයක් කුලියට ගන්න")?.entry.topic === "biz:transport");
ok("brain: wholesale goods (Sinhala)", askSite("තොග බඩු")?.entry.topic === "biz:consumer");

const registeredSecret = String((seed as unknown as { REGISTERED_USERS?: { password_display?: string }[] }).REGISTERED_USERS?.[0]?.password_display ?? "");
ok(
  "brain: registered-user secrets are never indexed",
  !registeredSecret || !JSON.stringify(knowledgeIndex).includes(registeredSecret),
);

console.log("\n── 13) Website Message Box → admin inbox + email ──");
const mailRoutesSrc = readFileSync(join(root, "src/lib/mail-routes.ts"), "utf8");
const liveChatSrc = readFileSync(join(root, "src/components/live-chat.tsx"), "utf8");
const adminMessagesSrc = readFileSync(join(root, "src/app/admin/messages/page.tsx"), "utf8");
const adminEmailsSrc = readFileSync(join(root, "src/app/admin/emails/page.tsx"), "utf8");
ok("mail: dedicated 'message' route exists with livechat/contact fallback",
  mailRoutesSrc.includes('key: "message"') && mailRoutesSrc.includes('"mail_route_livechat_1", "live_chat_email", "contact_email_1"'));
ok("mail: SMTP recipient acceptance is checked before success",
  readFileSync(join(root, "src/lib/mail-server.ts"), "utf8").includes("info.accepted.length === 0"));
ok("mail: Message tab emails via 'message' route + visitor confirmation",
  liveChatSrc.includes('sendToRoute("message", payload)') && liveChatSrc.includes("_autoresponse") && liveChatSrc.includes("payload.email = visitorEmail"));
ok("mail: Message tab claims success only when saved or emailed",
  liveChatSrc.includes("if (saved || emailed)") && liveChatSrc.includes("saved = !error"));
ok("admin: Messages page loads real DB rows (no fake seed)",
  adminMessagesSrc.includes('.from("messages")') && adminMessagesSrc.includes('.select("*")') && !adminMessagesSrc.includes("INDUWARA"));
ok("admin: Emails page has the Message Box route card",
  adminEmailsSrc.includes("message: Inbox") && adminEmailsSrc.includes("fb.message"));
ok("bot UI: officer request is routed before the site-brain/fallback path",
  liveChatSrc.indexOf("if (detectOfficerRequest(q))") > -1 &&
  liveChatSrc.indexOf("askOfficer(rsi)") > -1 &&
  liveChatSrc.indexOf("askOfficer(rsi)") < liveChatSrc.indexOf("if (await answerFromKnowledge"));
ok("bot UI: asked language is kept through officer notice, Yes/No, form and reset",
  liveChatSrc.includes("const [officerReplySi, setOfficerReplySi]") &&
  liveChatSrc.includes("showLiveChatClosedNotice(responseSi)") &&
  liveChatSrc.includes('runAction("contact", contactReplySi)') &&
  liveChatSrc.includes('contactReplySi ? "ඔබේ නම *"') &&
  liveChatSrc.includes("setOfficerReplySi(null)"));

console.log("\n── 14) Backup completeness ──");
const backupSrc = readFileSync(join(root, "src/lib/backup.ts"), "utf8");
const schemaTables = Array.from(new Set([...schema.matchAll(/create table if not exists public\.([a-z0-9_]+)/gi)].map((m) => m[1])));
const backupTables = [...backupSrc.matchAll(/\{ name: "([a-z0-9_]+)"/g)].map((m) => m[1]);
ok("backup: covers EVERY table in schema.sql",
  schemaTables.every((t) => backupTables.includes(t)),
  `missing: ${schemaTables.filter((t) => !backupTables.includes(t)).join(", ") || "none"}`);
ok("backup: includes settings + messages + notify emails (new mail features)",
  ["system_settings", "messages", "notify_emails", "chat_sessions", "chat_messages"].every((t) => backupTables.includes(t)));
// මුලු site එකම: login passwords + schema + images + restore නිරවද්‍යතාව
const genSqlFn = backupSrc.slice(backupSrc.indexOf("export async function generateBackupSql"), backupSrc.indexOf("/* --------------------------------------------------------------- PARSE --- */"));
ok("backup: login accounts (auth.users+passwords) written BEFORE data rows (FK order)",
  genSqlFn.includes("buildLoginAccountsSql(profilesRows)") && genSqlFn.indexOf("buildLoginAccountsSql(profilesRows)") < genSqlFn.indexOf("Writing data rows"));
ok("backup: login SQL uses crypt(pgcrypto) and creates auth.identities",
  backupSrc.includes("crypt(${sqlVal(plain)}, gen_salt('bf'))") && backupSrc.includes("INSERT INTO auth.identities") && backupSrc.includes("set search_path = public, extensions;"));
ok("backup: ZIP embeds canonical schema.sql (live chat DB logic + RLS) — server route එකෙන්",
  backupSrc.includes('addFile("schema.sql"') &&
  backupSrc.includes("async function fetchSchemaSql") &&
  backupSrc.includes("/api/backup/schema") &&
  !backupSrc.includes('import("../../supabase/schema.sql")'));
ok("backup: image scan covers nested JSON (JSON.stringify) + recursive storage list",
  backupSrc.includes("scanImagePathsInRows") && backupSrc.includes("JSON.stringify(r)") && backupSrc.includes("listAllStorageFiles"));
ok("restore: wipe uses not(pk,is,null) in reverse order; profiles never fully wiped (no RLS lockout)",
  backupSrc.includes('.not(t.pk, "is", null)') && backupSrc.includes("[...ordered].reverse()") && backupSrc.includes('new Set(["profiles", "backup_secrets", "backup_history"])'));
ok("restore: URL rewrite handles nested JSON values",
  backupSrc.includes("rewriteStr") && backupSrc.includes("JSON.parse(out)"));

console.log("\n── 15) Backup extras: manifest · encryption · preview · safety · partial · scheduled ──");
const bu = await import("../src/lib/backup-utils.ts");
ok("utils: sha256Hex('abc') known vector", (await bu.sha256Hex("abc")) === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
const encSample = await bu.encryptBackupText("SELECT 'ආයුබෝවන්';", "Test@123");
const legacyV1Sample = "MPCS-ENCRYPTED-BACKUP v1\n9Mu1jsfD2vQZ2drxRl5RTQ==.XfEaDpQNQLtDBOZT.oicR4AofDOts8OFD/JRoCuzFVeeJ/e65wkQC5+2MKQkom08=";
ok("utils: encrypt → envelope detected", bu.isEncryptedBackupText(encSample) === true && encSample.startsWith(bu.ENCRYPTED_PREFIX_V2));
ok("utils: decrypt round-trips (Sinhala safe) + legacy v1 still opens",
  (await bu.decryptBackupText(encSample, "Test@123")) === "SELECT 'ආයුබෝවන්';" &&
  (await bu.decryptBackupText(legacyV1Sample, "Test@123")) === "SELECT 'legacy-v1';");
let wrongPwThrew = false;
try { await bu.decryptBackupText(encSample, "wrong-password"); } catch { wrongPwThrew = true; }
ok("utils: wrong encryption password rejected", wrongPwThrew);
const sampleSql = "INSERT INTO public.news (\"id\", \"t\") VALUES ('1', 'a''b');\nINSERT INTO public.news (\"id\", \"t\") VALUES ('2', NULL);\nINSERT INTO public.profiles (\"id\") VALUES ('9');\n";
const parsedSample = bu.parseBackupSql(sampleSql);
// 📋 BACKUP COVERAGE — site එකේ හැම table එකක්ම backup එකට එනවද (schema.sql ↔ BACKUP_TABLES)
const coverageLib = await import("../src/lib/backup-coverage.ts");
const backedUp = new Set(backupTables); // (source එකෙන් parse කරපු list — browser-free)
const coverageLibTables = coverageLib.tablesFromSchemaSql(readFileSync(join(root, "supabase/schema.sql"), "utf8"));
ok("backup coverage: helper schema.sql tables හඳුනාගන්නවා (coverage card + tests එකට)",
  coverageLibTables.length >= 25 && coverageLibTables.includes("profiles") && coverageLibTables.includes("member_rows"));

const coverageTableKeys = coverageLib.BACKUP_COVERAGE
  .flatMap((g) => g.items.filter((i) => i.kind === "table").map((i) => i.key));
ok("backup coverage: coverage card එකේ හැම table key එකක්ම ඇත්තටම backup වන table එකක්",
  coverageTableKeys.every((k) => backedUp.has(k)) &&
  // user/admin details, login accounts, images, excel registers, secrets — ඔක්කොම list එකේ තියේ
  ["profiles", "login_accounts", "site_images_backup", "Members-Register.xlsx", "Voters-Register.xlsx",
   "backup_secrets", "member_rows", "voter_rows", "admin_activity_logs", "system_settings"]
    .every((k) => coverageLib.BACKUP_COVERAGE.some((g) => g.items.some((i) => i.key === k))));

const covReport = coverageLib.buildCoverageReport({
  tables: Object.fromEntries(coverageTableKeys.map((k) => [k, k === "news" ? 0 : 3])),
  images: 12, siteAssets: 39, siteSource: 121, loginAccounts: 2, memberRows: 53222, voterRows: 41000,
});
ok("backup coverage: report builder (ok/empty/unknown + complete)",
  covReport.total >= 20 &&
  covReport.unknown === 0 &&
  covReport.complete === true &&
  covReport.groups.every((g) => g.rows.length > 0) &&
  covReport.groups.flatMap((g) => g.rows).some((r) => r.key === "news" && r.status === "empty") &&
  covReport.groups.flatMap((g) => g.rows).find((r) => r.key === "member_rows")?.count === 3 &&
  coverageLib.buildCoverageReport({}).complete === false);

// 🗂 Import path normalization — ZIP entry → storage path (double-prefix එකක් නෑ)
const normCases: [string, string][] = [
  ["site-assets/public/icons/a.png", "site-public/icons/a.png"],
  ["site-public/icons/a.png", "site-public/icons/a.png"],
  ["icons/a.png", "site-public/icons/a.png"],
  ["/site-assets/public/images/b.jpg", "site-public/images/b.jpg"],
];
ok("restore: ZIP path → site-public/… හරියට හැරවේ (double-prefix නෑ)",
  normCases.every(([inp, exp]) => bu.siteAssetArchivePath(inp) === exp));
ok("restore: site-source/ entries source ලෙස හඳුනාගනී (data rows නොවේ)",
  bu.isSiteSourceEntry("site-source/src/lib/x.ts") && !bu.isSiteSourceEntry("site-assets/public/icons/a.png"));

// 🔐 coverage route auth + manual/scheduled parity
const covRoute = readFileSync(join(root, "src/app/api/backup/coverage-check/route.ts"), "utf8");
ok("coverage route: admin Bearer හෝ cron secret නැත්නම් deny (401/403)",
  covRoute.includes("userIsAdmin") && covRoute.includes("secretOk") &&
  /return deny\(401\)|return deny\(\)|deny\(403\)/.test(covRoute) &&
  covRoute.includes("unauthorized") && covRoute.includes("forbidden"));
ok("coverage route: service role key එකෙන් tables/secrets ගණන් ගනී, browser එකට key එක යවන්නේ නෑ",
  covRoute.includes("SUPABASE_SERVICE_ROLE_KEY") && !/NEXT_PUBLIC_SUPABASE_SERVICE/.test(covRoute));

const schedSrc = readFileSync(join(root, "src/lib/scheduled-backup.ts"), "utf8");
const schedRoute = readFileSync(join(root, "src/app/api/scheduled-backup/route.ts"), "utf8");
ok("auto-backup: manual + scheduled දෙකම එකම generateBackupZip එකෙන් ZIP හදයි (site-source ඇතුළුව)",
  schedRoute.includes("generateBackupZip") && readFileSync(join(root, "src/app/admin/backup/page.tsx"), "utf8").includes("generateBackupZip") &&
  backupSrc.includes("await fetchSiteSourceSnapshot(") && backupSrc.includes("for (const f of siteSourceFiles) await addFile(`site-source/"));
ok("backup ZIP: manifest එකේ site-source + site-assets ගාණ සටහන් වේ",
  backupSrc.includes("siteSourceFileCount: siteSourceFiles.length") && backupSrc.includes("siteAssetCount: siteAssets.length"));

// 🆕 හැම අලුත් update එකක්ම backup එකට අපේම එකතු වෙනවද — src/ + public/ සම්පූර්ණ coverage test
{
  const { SITE_SOURCE_FILES } = await import("../src/lib/site-source.generated.ts");
  const { PUBLIC_ASSET_FILES } = await import("../src/lib/public-assets.generated.ts");
  const snapPaths = new Set(SITE_SOURCE_FILES.map((f: { path: string }) => f.path));
  const walk = (dir: string, out: string[]) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full, out);
      else out.push(relative(root, full).split("\\").join("/"));
    }
  };
  const srcAll: string[] = [];
  walk(join(root, "src"), srcAll);
  const srcExpected = srcAll.filter(
    (f) => /\.(tsx?|css|mjs)$/.test(f) && !/\.generated\.ts$/.test(f) && !/\.d\.ts$/.test(f)
  );
  const missingSrc = srcExpected.filter((f) => !snapPaths.has(f));
  ok(`site-source: src/ එකේ හැම source file එකක්ම snapshot එකේ (අලුත් update auto-include) — missing: ${missingSrc.length}`,
    missingSrc.length === 0);

  const pubAll: string[] = [];
  walk(join(root, "public"), pubAll);
  const pubExpected = pubAll.map((f) => f.replace(/^public\//, ""));
  const missingPub = pubExpected.filter((f) => !PUBLIC_ASSET_FILES.includes(f as never));
  ok(`public assets: public/ එකේ හැම file එකක්ම manifest එකේ — missing: ${missingPub.length}`,
    missingPub.length === 0);
  console.log(`     (src ${srcExpected.length} files · public ${pubExpected.length} files · snapshot ${snapPaths.size} · assets ${PUBLIC_ASSET_FILES.length})`);
}

ok("utils: parseBackupSql 3 inserts + escaped quote + NULL", parsedSample.length === 3 && parsedSample[0].values[1] === "a'b" && parsedSample[1].values[1] === null);
const sampleSummary = bu.summarizeInserts(parsedSample);
ok("utils: summarizeInserts per-table counts", sampleSummary.totalRows === 3 && sampleSummary.tables.find((t) => t.name === "news")?.rows === 2);
const sampleManifest = bu.buildManifest({ generatedAt: "2026-10-18T00:00:00Z", tableCounts: { a: 2, b: 3 }, imageCount: 4, encrypted: false, supabaseHost: "x.supabase.co", schemaSha256: "s", databasePlainSha256: "d", siteAssetCount: 37, siteSourceFileCount: 21, sitePackageVersion: "pkg-test", files: { "database.sql": { sha256: "h", size: 5 } } });
ok("utils: manifest = format v3 + totalRows summed + site package counts", sampleManifest.formatVersion === 3 && sampleManifest.totalRows === 5 && bu.BACKUP_FORMAT_VERSION === 3 && sampleManifest.siteAssetCount === 37 && sampleManifest.siteSourceFileCount === 21 && sampleManifest.sitePackageVersion === "pkg-test");
const recText = bu.buildRecoveryChecklist({ generatedAt: "2026-10-18T00:00:00Z", supabaseUrl: "https://x.supabase.co" });
ok("utils: recovery checklist (repo + env keys + service-role + Gemini + test-restore drill)",
  recText.includes("github.com/itk200712-prog/website") &&
  recText.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY") &&
  recText.includes("SUPABASE_SERVICE_ROLE_KEY") &&
  recText.includes("GEMINI_API_KEY") &&
  recText.includes("is_root_admin") &&
  recText.includes("Test Restore"));
ok("backup: ZIP writes manifest.json + RECOVERY.txt; encryption optional",
  backupSrc.includes('"manifest.json"') && backupSrc.includes('"RECOVERY.txt"') && backupSrc.includes("encryptBackupText(sql"));
ok("restore: partial restore (onlyTables) supported", backupSrc.includes("onlyTables") && backupSrc.includes("wantImages"));
const adminBackupSrc = readFileSync(join(root, "src/app/admin/backup/page.tsx"), "utf8");
ok("admin backup: preview + type-to-confirm RESTORE + safety backup + last-backup reminder",
  adminBackupSrc.includes("prepareImport") && adminBackupSrc.includes('confirmText !== "RESTORE"') && adminBackupSrc.includes("SAFETY-backup") && adminBackupSrc.includes("backup_interval_days"));
ok("scheduled backup: site API route + pg_cron SQL in repo (no Edge Function deploy needed)",
  readFileSync(join(root, "src/app/api/scheduled-backup/route.ts"), "utf8").includes("backupDueDecision") &&
  readFileSync(join(root, "supabase/scheduled-backup.sql"), "utf8").includes("cron.schedule") &&
  readFileSync(join(root, "supabase/scheduled-backup.sql"), "utf8").includes("mpcs-auto-backup-check"));

console.log("\n── 16) Baymax Gemini AI fallback (server-side only key) ──");
const baymaxAi = await import("../src/lib/baymax-ai.ts");
ok("ai: model id normalizes models/ prefix + case", baymaxAi.normalizeGeminiModel("models/Gemini-3.8-Flash") === "gemini-3.8-flash");
ok("ai: blank model falls back to default", baymaxAi.normalizeGeminiModel("  ") === baymaxAi.DEFAULT_GEMINI_MODEL);
const fallbackChain = baymaxAi.modelFallbackChain("gemini-3.5-flash-lite");
ok("ai: model fallback chain (selected first, unique, short/fast)", fallbackChain[0] === "gemini-3.5-flash-lite" && fallbackChain.includes("gemini-2.5-flash-lite") && fallbackChain.length === 3 && new Set(fallbackChain).size === fallbackChain.length);
ok("ai: speed routing (simple → Flash-Lite/no-search/small budget; current/link/detail → selected/search/full)",
  baymaxAi.preferredAiModel("What is photosynthesis?", "gemini-3.8-flash") === "gemini-3.5-flash-lite" &&
  baymaxAi.needsWebSearch("What is photosynthesis?") === false &&
  baymaxAi.aiMaxOutputTokens("What is photosynthesis?") === 1024 &&
  baymaxAi.needsWebSearch("අද කාලගුණය කොහොමද?") === true &&
  baymaxAi.preferredAiModel("අද කාලගුණය කොහොමද?", "gemini-3.8-flash") === "gemini-3.8-flash" &&
  baymaxAi.needsWebSearch("Gazette eke link eka denna") === true &&
  baymaxAi.aiMaxOutputTokens("විස්තර කියන්න") === 4096);
ok("ai: general-knowledge detector (general → AI, society facts → site brain)",
  baymaxAi.isGeneralKnowledgeQuestion("සමූපකාරයක් යනු කුමක්ද?") === true &&
  baymaxAi.isGeneralKnowledgeQuestion("What is a cooperative?") === true &&
  baymaxAi.isGeneralKnowledgeQuestion("ආලෝකයේ වේගය කීයද?") === true &&
  baymaxAi.isGeneralKnowledgeQuestion("සමිතියේ නම මොකක්ද?") === false &&
  baymaxAi.isGeneralKnowledgeQuestion("සභාපති කවුද?") === false &&
  baymaxAi.isGeneralKnowledgeQuestion("What is F28?") === false &&
  baymaxAi.isGeneralKnowledgeQuestion("How do I become a member?") === false);
ok("ai: normal-chat routing (free questions + follow-ups → AI, society keywords → site)",
  baymaxAi.shouldAskAiFirst("sigiriya koheda thiyenne") === true &&
  baymaxAi.shouldAskAiFirst("ඒක කොහෙද තියෙන්නේ?", true) === true &&
  baymaxAi.shouldAskAiFirst("එතකොට ඒක ලොකුද", true) === true &&
  baymaxAi.shouldAskAiFirst("එතකොට ඒක ලොකුද", false) === false &&
  baymaxAi.shouldAskAiFirst("Maliban") === false &&
  baymaxAi.shouldAskAiFirst("Maliban eka koheda thiyenne") === false &&
  baymaxAi.shouldAskAiFirst("සභාපතිගේ දුරකථන අංකය කීයද?") === false &&
  baymaxAi.shouldAskAiFirst("mata aluth deyak igena ganna asai kiyala hithuna") === true);
ok("ai: history is sanitized (roles mapped, prompt kept lean for speed)",
  JSON.stringify(baymaxAi.normalizeAiHistory([
    { role: "assistant", text: "  ආයුබෝවන්   ලෝකය " },
    { role: "weird", text: "කොහොමද" },
    { role: "user", text: "x" },
    { role: "model", text: "y".repeat(4500) },
  ])) === JSON.stringify([
    { role: "model", text: "ආයුබෝවන් ලෝකය" },
    { role: "user", text: "කොහොමද" },
    { role: "model", text: "y".repeat(2500) },
  ]));
ok("ai: enabled only for explicit on values", baymaxAi.isAiEnabledValue("1") === true && baymaxAi.isAiEnabledValue("true") === true && baymaxAi.isAiEnabledValue("0") === false && baymaxAi.isAiEnabledValue("") === false);
ok("ai: secret mask never reveals the full key", baymaxAi.maskSecret("prod-secret-123456abcd") === "prod…abcd" && baymaxAi.maskSecret("short") === "••••••••" && baymaxAi.maskSecret("") === "");
ok("ai: question is trimmed/collapsed and capped", baymaxAi.normalizeAiQuestion("  hello\n\n world  ") === "hello world" && baymaxAi.normalizeAiQuestion("x".repeat(2100)).length === 2000);
const siInstruction = baymaxAi.baymaxAiSystemInstruction("si");
ok("ai: Sinhala instruction (professional tone + current date) + no invented society facts",
  siInstruction.includes("Sinhala script") &&
  siInstruction.includes("respectful 'ඔබ' form") &&
  siInstruction.includes("Today in Sri Lanka is") &&
  siInstruction.includes("Never invent facts") &&
  siInstruction.includes("search the web first") &&
  siInstruction.includes("Do not add an unrelated society"));
const groundedReq = baymaxAi.buildGeminiRequest("සමූපකාරයක් යනු කුමක්ද?", "si", true) as { tools?: unknown; contents: { parts: { text: string }[] }[] };
ok("ai: Gemini request uses Google Search grounding", JSON.stringify(groundedReq.tools) === JSON.stringify([{ google_search: {} }]) && groundedReq.contents[0].parts[0].text.includes("සමූපකාරයක්"));
const historyReq = baymaxAi.buildGeminiRequest("ඒක කොහෙද තියෙන්නේ?", "si", true, [
  { role: "user", text: "සීගිරිය ගැන කියන්න" },
  { role: "model", text: "සීගිරිය යනු පැරණි බලකොටුවකි." },
]) as { contents: { role: string; parts: { text: string }[] }[] };
ok("ai: Gemini request carries conversation history for follow-ups",
  historyReq.contents.length === 3 &&
  historyReq.contents[0].role === "user" &&
  historyReq.contents[1].role === "model" &&
  historyReq.contents[2].parts[0].text.includes("කොහෙද"));
const plainReq = baymaxAi.buildGeminiRequest("hello", "en", false) as { tools?: unknown };
ok("ai: Gemini request can retry without search tool", plainReq.tools === undefined);
ok("ai: Gemini response text extraction", baymaxAi.extractGeminiText({ candidates: [{ content: { parts: [{ text: "ආයුබෝවන්" }, { text: "world" }] } }] }) === "ආයුබෝවන්\nworld" && baymaxAi.extractGeminiText({}) === "");
ok("ai: professional cleanup strips markdown, keeps clean bullets",
  baymaxAi.cleanAiAnswerText("## පිළිතුර\n**සීගිරිය** මාතලේ දිස්ත්‍රික්කයේ ඇත.\n- දඹුල්ලට ළඟයි\n\n\nස්තුතියි.") ===
    "පිළිතුර\nසීගිරිය මාතලේ දිස්ත්‍රික්කයේ ඇත.\n• දඹුල්ලට ළඟයි\n\nස්තුතියි.");
const adminLiveChatSrc = readFileSync(join(root, "src/app/admin/live-chat/page.tsx"), "utf8");
const baymaxAiRouteSrc = readFileSync(join(root, "src/app/api/baymax-ai/route.ts"), "utf8");
ok("ai: Admin saves key to private backup_secrets, enable/model to public settings",
  adminLiveChatSrc.includes('.from("backup_secrets")') &&
  adminLiveChatSrc.includes("GEMINI_API_KEY_SLOTS") &&
  adminLiveChatSrc.includes('key: "chat_ai_enabled"') &&
  adminLiveChatSrc.includes('key: "chat_ai_model"') &&
  adminLiveChatSrc.includes("SUPABASE_SERVICE_ROLE_KEY"));
ok("ai: browser widget never touches the API key or secrets table",
  liveChatSrc.includes('fetch("/api/baymax-ai"') &&
  liveChatSrc.includes('"chat_ai_enabled"') &&
  liveChatSrc.includes("setAiEnabled") &&
  !liveChatSrc.includes("gemini_api_key") &&
  !liveChatSrc.includes("backup_secrets") &&
  !liveChatSrc.includes("SUPABASE_SERVICE_ROLE_KEY"));
ok("ai: server route reads secret with service role + sends x-goog-api-key",
  baymaxAiRouteSrc.includes("process.env.SUPABASE_SERVICE_ROLE_KEY") &&
  baymaxAiRouteSrc.includes("backup_secrets?select=key,value&key=in.(") &&
  baymaxAiRouteSrc.includes('"x-goog-api-key"') &&
  baymaxAiRouteSrc.includes("sameOrigin") &&
  baymaxAiRouteSrc.includes("server_not_configured") &&
  baymaxAiRouteSrc.includes("modelFallbackChain") &&
  baymaxAiRouteSrc.includes("quota_exceeded") &&
  baymaxAiRouteSrc.includes("normalizeAiHistory") &&
  baymaxAiRouteSrc.includes("CONFIG_CACHE_TTL_MS") &&
  baymaxAiRouteSrc.includes("Promise.all") &&
  baymaxAiRouteSrc.includes("GEMINI_ATTEMPT_TIMEOUT_MS") &&
  baymaxAiRouteSrc.includes("AI_TOTAL_DEADLINE_MS") &&
  baymaxAiRouteSrc.includes("preferredAiModel") &&
  baymaxAiRouteSrc.includes("needsWebSearch") &&
  baymaxAiRouteSrc.includes("[400, 408, 429]"));
ok("ai: widget sends free questions to AI first (with history) + keeps final AI fallback",
  liveChatSrc.indexOf("shouldAskAiFirst(q") > -1 &&
  liveChatSrc.indexOf("shouldAskAiFirst(q") < liveChatSrc.indexOf("answerFromKnowledge(q, rsi)") &&
  liveChatSrc.lastIndexOf("answerFromAI(q, rsi)") > liveChatSrc.indexOf("answerFromKnowledge(q, rsi)") &&
  liveChatSrc.lastIndexOf("answerFromAI(q, rsi)") < liveChatSrc.indexOf('logEvent("unmatched"') &&
  liveChatSrc.includes('fetch("/api/baymax-ai", { cache: "no-store" })') &&
  liveChatSrc.includes("history: aiHistoryRef.current") &&
  liveChatSrc.includes("ai_quota"));
ok("ai: schema has private key slot + public defaults",
  schema.includes("('gemini_api_key','')") && schema.includes("('chat_ai_enabled', '0')") && schema.includes("('chat_ai_model', 'gemini-3.8-flash')"));

console.log("\n── 17) Original (root) Super Admin protection + admin password reset ──");
const rootAdmin = await import("../src/lib/root-admin.ts");
const rootAcct = { id: "root", role: "superadmin", nic: "SUPERADMIN", joined_date: "2020-01-01", is_root_admin: true };
const newSuper = { id: "s2", role: "superadmin", joined_date: "2024-01-01" };
const plainAdmin = { id: "a1", role: "admin", joined_date: "2023-01-01" };
const plainAdmin2 = { id: "a2", role: "admin", joined_date: "2023-06-01" };
const memberAcct = { id: "m1", role: "member", joined_date: "2022-01-01" };
const pickedRoot = rootAdmin.pickRootAdminId([newSuper, rootAcct, plainAdmin, memberAcct]);
ok("root: flagged account wins; seed/earliest superadmin fallback",
  pickedRoot === "root" &&
  rootAdmin.pickRootAdminId([
    { id: "old", role: "superadmin", joined_date: "2019-01-01" },
    { id: "seed", role: "superadmin", nic: "SUPERADMIN", joined_date: "2020-01-01" },
  ]) === "seed" &&
  rootAdmin.pickRootAdminId([
    { id: "late", role: "superadmin", joined_date: "2024-01-01" },
    { id: "early", role: "superadmin", joined_date: "2021-01-01" },
  ]) === "early");
ok("root: any admin can view/reset/delete ordinary members",
  rootAdmin.canViewPassword(plainAdmin, memberAcct, pickedRoot) === true &&
  rootAdmin.canResetPassword(newSuper, memberAcct, pickedRoot) === true &&
  rootAdmin.canDeleteAccount(plainAdmin, memberAcct, pickedRoot) === true &&
  rootAdmin.canEditAccount(plainAdmin, memberAcct, pickedRoot) === true);
ok("root: added superadmins/admins cannot touch other admin accounts",
  rootAdmin.canViewPassword(newSuper, plainAdmin, pickedRoot) === false &&
  rootAdmin.canResetPassword(plainAdmin, newSuper, pickedRoot) === false &&
  rootAdmin.canDeleteAccount(newSuper, plainAdmin, pickedRoot) === false &&
  rootAdmin.canEditAccount(plainAdmin, plainAdmin2, pickedRoot) === false &&
  rootAdmin.canChangeRole(newSuper, memberAcct, pickedRoot) === false);
ok("root: original superadmin manages admins; root/self accounts stay protected",
  rootAdmin.canViewPassword(rootAcct, plainAdmin, pickedRoot) === true &&
  rootAdmin.canResetPassword(rootAcct, newSuper, pickedRoot) === true &&
  rootAdmin.canDeleteAccount(rootAcct, plainAdmin, pickedRoot) === true &&
  rootAdmin.canChangeRole(rootAcct, memberAcct, pickedRoot) === true &&
  rootAdmin.canDeleteAccount(rootAcct, rootAcct, pickedRoot) === false &&
  rootAdmin.canResetPassword(rootAcct, rootAcct, pickedRoot) === false &&
  rootAdmin.canChangeRole(rootAcct, rootAcct, pickedRoot) === false);
ok("root: schema enforces root flag + delete policy + delete_admin RPC",
  schema.includes("is_root_admin") &&
  schema.includes("profiles_one_root_admin_idx") &&
  schema.includes("root_admin_id()") &&
  schema.includes("profiles_delete") &&
  schema.includes("delete_admin(uid uuid)") &&
  schema.includes("protect_profile_insert"));
const resetRouteSrc = readFileSync(join(root, "src/app/api/admin-reset-password/route.ts"), "utf8");
const membersSrc = readFileSync(join(root, "src/app/admin/members/page.tsx"), "utf8");
const administratorsSrc = readFileSync(join(root, "src/app/admin/administrators/page.tsx"), "utf8");
ok("root: password reset is server-only (service role + Auth Admin API + display sync)",
  resetRouteSrc.includes("SUPABASE_SERVICE_ROLE_KEY") &&
  resetRouteSrc.includes("/auth/v1/admin/users/") &&
  resetRouteSrc.includes("canResetPassword") &&
  resetRouteSrc.includes("protected_admin") &&
  resetRouteSrc.includes("password_display") &&
  resetRouteSrc.includes("self_reset_use_profile") &&
  membersSrc.includes('fetch("/api/admin-reset-password"'));
// ── Admin account guards (pure helpers — "add admin" එකෙන් පරණ ගිණුමක් වෙනස් නොවීම) ──
const adminAccount = await import("../src/lib/admin-account");
ok("admin-account: NIC variants + clash detection",
  adminAccount.nicVariants(" itk200712 ").join("|") === "itk200712|ITK200712" &&
  adminAccount.nicVariants("931234567v").join("|") === "931234567v|931234567V" &&
  adminAccount.nicVariants("   ").length === 0 &&
  adminAccount.accountClashMessage(null, "X") === null &&
  (adminAccount.accountClashMessage({ full_name: "ITK OFFICIAL", nic: "ITKOFFICIAL", role: "admin" }, "ITKOFFICIAL") || "").includes("ITK OFFICIAL") &&
  (adminAccount.accountClashMessage({ full_name: "ITK OFFICIAL", nic: "ITKOFFICIAL", role: "admin" }, "x") || "").includes("කිසි දෙයක් වෙනස් කළේ නෑ"));

ok("admin-account: signUp response never counts an existing account as new",
  adminAccount.signupAlreadyExists({ id: "u1", identities: [] }) === true &&            // ← obfuscated (පරණ ගිණුම)
  adminAccount.signupAlreadyExists({ id: "u1", identities: [{ id: "i" }] }) === false && // ← ඇත්තටම අලුත්
  adminAccount.signupAlreadyExists(null) === true &&
  adminAccount.signupAlreadyExists({ id: "u1", identities: [{ id: "i" }] }, "User already registered") === true);

ok("admin-account: existing profile rows are never overwritten, delete refusals never fall back",
  adminAccount.profileWriteBlocker(null) === null &&
  adminAccount.profileWriteBlocker({ nic: "", full_name: "" }) === null &&
  (adminAccount.profileWriteBlocker({ nic: "ITKOFFICIAL", full_name: "ITK OFFICIAL" }) || "").includes("දැනටමත් profile") &&
  adminAccount.isEmptyProfileStub({ nic: " ", full_name: "" }) === true &&
  adminAccount.isProtectedDeleteRefusal("Only the original superadmin can delete an administrator account") === true &&
  adminAccount.isProtectedDeleteRefusal("The original superadmin account cannot be deleted") === true &&
  adminAccount.isProtectedDeleteRefusal("You cannot delete your own account") === true &&
  adminAccount.isProtectedDeleteRefusal("relation does not exist") === false);

// ── Backup reliability + secret hardening (2026-11-07 full scan) ─────────────
const scheduledRouteSrc = readFileSync(join(root, "src/app/api/scheduled-backup/route.ts"), "utf8");
const schemaRouteSrc = readFileSync(join(root, "src/app/api/backup/schema/route.ts"), "utf8");
const seedSrc = readFileSync(join(root, "src/lib/seed.ts"), "utf8");

ok("backup: restore/import never deletes accounts (admin auto-delete bug)",
  backupSrc.includes("profiles NEVER deleted") &&
  !backupSrc.includes('from("profiles").delete()') &&
  backupSrc.includes("backup එකේ නොතිබුණු ගිණුම්"));

ok("backup: scheduled run is locked + uploads are verified before reporting success",
  scheduledRouteSrc.includes("backup_schedule_running_at") &&
  scheduledRouteSrc.includes("already_running") &&
  scheduledRouteSrc.includes("async function clearRunLock") &&
  scheduledRouteSrc.includes("MEGA verify failed") &&
  scheduledRouteSrc.includes("Supabase verify failed") &&
  scheduledRouteSrc.includes("async function megaChildren") &&
  scheduledRouteSrc.includes("files වැඩිම එක තෝරනවා"));

ok("security: schema.sql (default passwords) is server-only — not in the browser bundle",
  schemaRouteSrc.includes("auth/v1/user") &&
  schemaRouteSrc.includes('role !== "admin" && role !== "superadmin"') &&
  schemaRouteSrc.includes('"Cache-Control": "no-store, private"') &&
  !readFileSync(join(root, "src/lib/backup.ts"), "utf8").includes('import("../../supabase/schema.sql")') &&
  readFileSync(join(root, "src/lib/backup.ts"), "utf8").includes("async function fetchSchemaSql") &&
  !seedSrc.includes('btoa("Admin@123")') &&
  !seedSrc.includes('btoa("Kenula@123")') &&
  !adminBackupSrc.includes("MPCS@Backup#2026") &&
  !adminBackupSrc.includes("MPCS@Encrypt#2026"));

ok("backup: auto/scheduled ZIP still embeds schema.sql (server auth with x-backup-secret)",
  schemaRouteSrc.includes("async function cronSecretOk") &&
  schemaRouteSrc.includes("sameSecret") &&
  schemaRouteSrc.includes('req.headers.get("x-backup-secret")') &&
  scheduledRouteSrc.includes("secrets.cronSecret") &&
  scheduledRouteSrc.includes("cronSecret: cronSecret || undefined") &&
  backupSrc.includes("fetchSchemaSql(opts?.assetBaseUrl, opts?.cronSecret)"));

// ── Duplicate board/officers + seed re-run + live counts (2026-11-07) ────────
const adminBoardSrc = readFileSync(join(root, "src/app/admin/board/page.tsx"), "utf8");
const backupUtilsSrc = readFileSync(join(root, "src/lib/backup-utils.ts"), "utf8");

const dataLibSrc = readFileSync(join(root, "src/lib/data.ts"), "utf8");
const schemaSqlFile = readFileSync(join(root, "supabase/schema.sql"), "utf8");

ok("board: duplicates never reach the site (name-based dedupe shared with backup)",
  dataLibSrc.includes("export function dedupeBoard") &&
  dataLibSrc.includes("dedupeBoardRows(rows as unknown as Record<string, unknown>[])") &&
  dataLibSrc.includes("return dedupeBoard(data as unknown as BoardMember[])") &&
  backupUtilsSrc.includes("export function dedupeBoardRows") &&
  backupUtilsSrc.includes("nameKey.length >= 3") &&
  !dataLibSrc.includes('const k = (p.email || p.name_en || "").toLowerCase()'));

ok("gallery: same image never shows twice (shared helper)",
  dataLibSrc.includes("dedupeGalleryRows(data as unknown as Record<string, unknown>[])") &&
  backupUtilsSrc.includes("export function dedupeGalleryRows"));

ok("admin board: adding an existing person updates that row instead of duplicating",
  adminBoardSrc.includes("duplicate එකක් හැදෙන්නේ නැතුව ඒ row එක update කළා"));

ok("backup export/import: duplicate board & gallery rows are merged, never re-created",
  backupSrc.includes("g.rows = dedupeTableRows(g.name, g.rows)") &&
  backupSrc.includes("const clean = dedupeTableRows(name, rows)") &&
  backupSrc.includes('errors.push(`ℹ duplicate rows ${dedupedRows}ක් merge කළා') &&
  backupUtilsSrc.includes('if (table === "board_members") return dedupeBoardRows(rows)') &&
  backupUtilsSrc.includes('if (table === "gallery_items") return dedupeGalleryRows(rows)'));

ok("backup import: member/voter counters re-synced from the restored rows",
  backupSrc.includes('key: "members_total", value: String(m.count)') &&
  backupSrc.includes('key: "voters_total", value: String(v.count)') &&
  backupSrc.includes('sb.from("system_settings").upsert(patch, { onConflict: "key" })'));

ok("seed SQL is idempotent — re-running schema.sql never duplicates board/gallery/news/rows",
  schemaSqlFile.includes("if not exists (select 1 from public.board_members) then") &&
  schemaSqlFile.includes("if not exists (select 1 from public.gallery_items) then") &&
  // news seed එක සම්පූර්ණයෙන්ම ඉවත් කළා — පරණ demo news ආයේ කවදාවත් එන්නේ නෑ
  !schemaSqlFile.includes("insert into public.news") &&
  schemaSqlFile.includes("demo/seed news ඉවත් කළා") &&
  schemaSqlFile.includes("if not exists (select 1 from public.member_rows) then") &&
  schemaSqlFile.includes("if not exists (select 1 from public.voter_rows) then"));

ok("live counts: members/voters totals come from the DB, not a stale setting",
  dataLibSrc.includes("async function liveRegisterTotals") &&
  dataLibSrc.includes('sb.from("member_rows").select("id", { count: "exact", head: true })') &&
  dataLibSrc.includes("members_total: live.members ??") && dataLibSrc.includes("voters_total: live.voters ??"));

// ── Production security hardening (pentestnet report 2026-11-07) ────────────
const nextConfigSrc = readFileSync(join(root, "next.config.ts"), "utf8");
const robotsFileSrc = readFileSync(join(root, "src/app/robots.ts"), "utf8");
const sitemapFileSrc = readFileSync(join(root, "src/app/sitemap.ts"), "utf8");
const securityTxtSrc = readFileSync(join(root, "src/app/.well-known/security.txt/route.ts"), "utf8");

ok("security: all pentest-reported headers are sent (CSP, XFO, nosniff, referrer, permissions)",
  nextConfigSrc.includes('{ key: "X-Frame-Options", value: "SAMEORIGIN" }') &&
  nextConfigSrc.includes('{ key: "X-Content-Type-Options", value: "nosniff" }') &&
  nextConfigSrc.includes('{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }') &&
  // Permissions-Policy: middleware එකේ, හැම feature එකක්ම () — deny-all (scan warning #2)
  !nextConfigSrc.includes('key: "Permissions-Policy"') &&
  permissionsPolicySrc.includes("export function buildPermissionsPolicy") &&
  permissionsPolicySrc.includes('"geolocation=()"') &&
  permissionsPolicySrc.includes('"microphone=()"') &&
  permissionsPolicySrc.includes('"camera=()"') &&
  permissionsPolicySrc.includes('"payment=()"') &&
  middlewareSrc.includes('import { buildPermissionsPolicy } from "@/lib/permissions-policy"') &&
  middlewareSrc.includes('response.headers.set("Permissions-Policy", permissionsPolicy)') &&
  middlewareSrc.includes('res.headers.set("Permissions-Policy", permissionsPolicy)') &&
  // CSP එක දැන් middleware එකේ nonce සහිතව
  !nextConfigSrc.includes('key: "Content-Security-Policy"') &&
  middlewareSrc.includes("function makeNonce") &&
  middlewareSrc.includes('`script-src \'self\' \'nonce-${nonce}\' \'strict-dynamic\'') &&
  !middlewareSrc.includes("script-src 'self' 'unsafe-inline'") &&
  middlewareSrc.includes("requestHeaders.set(\"Content-Security-Policy\", csp)") &&
  middlewareSrc.includes('response.headers.set("Content-Security-Policy", csp)') &&
  middlewareSrc.includes("res.headers.set(\"Content-Security-Policy\", csp)") &&
  middlewareSrc.includes("object-src 'none'") &&
  middlewareSrc.includes("base-uri 'self'") &&
  middlewareSrc.includes("frame-ancestors 'self'") &&
  middlewareSrc.includes("connect-src 'self' ${SUPABASE_ORIGIN}"));

ok("security: permissions-policy denies every feature (scanner-proof + browser-valid)", (() => {
  try {
    const value = permissionsPolicyModule.buildPermissionsPolicy();
    const required = ["geolocation", "microphone", "camera", "payment", "usb"];
    return (
      required.every((f) => value.includes(`${f}=()`)) &&
      value.includes("interest-cohort=()") &&
      !value.includes("(self)") &&
      !value.includes("*") &&
      !value.includes('"http')
    );
  } catch {
    return false;
  }
})());

ok("security: framework fingerprint hidden + robots.txt + sitemap + security.txt present",
  nextConfigSrc.includes("poweredByHeader: false") &&
  robotsFileSrc.includes("MetadataRoute.Robots") &&
  robotsFileSrc.includes('"/admin"') && robotsFileSrc.includes('"/api/"') &&
  robotsFileSrc.includes("sitemap:") &&
  sitemapFileSrc.includes("MetadataRoute.Sitemap") &&
  securityTxtSrc.includes("Contact: mailto:") &&
  securityTxtSrc.includes("Expires:") &&
  // security files backup/restore එකටත් යනවා (ඉදිරි updates වලට රැඳේ)
  readFileSync(join(root, "scripts/gen-site-source.mjs"), "utf8").includes('"next.config.ts"') &&
  readFileSync(join(root, "scripts/gen-site-source.mjs"), "utf8").includes('"src/app/robots.ts"') &&
  readFileSync(join(root, "scripts/gen-site-source.mjs"), "utf8").includes('"src/app/.well-known/security.txt/route.ts"'));

ok("counts: site shows register_counts() real numbers (6 columns filled + de-duplicated)",
  dataLibSrc.includes('sb.rpc("register_counts")') &&
  readFileSync(join(root, "src/components/home-sections.tsx"), "utf8").includes('sb.rpc("register_counts")') &&
  readFileSync(join(root, "src/app/admin/data/page.tsx"), "utf8").includes('sb.rpc("register_counts")') &&
  schemaSqlFile.includes("create or replace function public.register_counts()") &&
  schemaSqlFile.includes("grant execute on function public.register_counts() to anon, authenticated"));

ok("excel import: strictly manual — runs only on the Upload button, destructive modes confirm",
  readFileSync(join(root, "src/app/admin/data/page.tsx"), "utf8").includes("async function upload()") &&
  readFileSync(join(root, "src/app/admin/data/page.tsx"), "utf8").includes("🛡 MANUAL ONLY") &&
  readFileSync(join(root, "src/app/admin/data/page.tsx"), "utf8").includes('if (mode !== "append")') &&
  readFileSync(join(root, "src/app/admin/data/page.tsx"), "utf8").includes("window.confirm(msg)"));

ok("backup auto-covers future updates: site-source + public assets are auto-discovered",
  readFileSync(join(root, "scripts/gen-site-source.mjs"), "utf8").includes("AUTO-DISCOVER") &&
  readFileSync(join(root, "scripts/gen-site-source.mjs"), "utf8").includes('const AUTO_ROOTS = ["src", "."]') &&
  readFileSync(join(root, "scripts/gen-site-source.mjs"), "utf8").includes("PUBLIC_ASSET_FILES") &&
  readFileSync(join(root, "src/lib/site-source.generated.ts"), "utf8").split('{ path: "').length - 1 >= 100 &&
  // API routes ද auto-add වේ (future updates) — ඒත් රහස් කිසිවක් snapshot එකේ නෑ
  readFileSync(join(root, "src/lib/site-source.generated.ts"), "utf8").includes('{ path: "src/app/api/scheduled-backup/route.ts"') &&
  !readFileSync(join(root, "src/lib/site-source.generated.ts"), "utf8").includes('{ path: ".env') &&
  !/eyJhbGciOi[A-Za-z0-9._-]{20,}/.test(readFileSync(join(root, "src/lib/site-source.generated.ts"), "utf8")) &&
  !/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(readFileSync(join(root, "src/lib/site-source.generated.ts"), "utf8")) &&
  readFileSync(join(root, "scripts/gen-site-source.mjs"), "utf8").includes("SECRET_PATTERNS") &&
  backupSrc.includes('import { PUBLIC_ASSET_FILES } from "@/lib/public-assets.generated"') &&
  backupSrc.includes("[...PUBLIC_ASSET_FILES]") &&
  readFileSync(join(root, "src/lib/public-assets.generated.ts"), "utf8").includes('"icons/phone-call.png"'));

ok("security: no plaintext default passwords left in client-side source",
  !readdirSync(join(root, "src/lib"), { recursive: true } as never)
    .filter((f) => String(f).endsWith(".ts") && !String(f).includes("generated"))
    .some((f) => /MPCS@Backup#2026|MPCS@Restore#2026|MPCS@Encrypt#2026/.test(readFileSync(join(root, "src/lib", String(f)), "utf8"))) &&
  !/MPCS@Backup#2026|MPCS@Restore#2026|MPCS@Encrypt#2026|Admin@123/.test(readFileSync(join(root, "src/app/admin/backup/page.tsx"), "utf8")));

ok("administrators: adding an admin can never overwrite/delete an existing account",
  readFileSync(join(root, "src/app/admin/administrators/page.tsx"), "utf8").includes("const clashQuery = await Promise.all([") &&
  readFileSync(join(root, "src/app/admin/administrators/page.tsx"), "utf8").includes("signupAlreadyExists(created, error?.message)") &&
  readFileSync(join(root, "src/app/admin/administrators/page.tsx"), "utf8").includes("profileWriteBlocker(existingProfile") &&
  readFileSync(join(root, "src/app/admin/administrators/page.tsx"), "utf8").includes("const clashMsg = accountClashMessage(clash, nicRaw)") &&
  // මකන්න බැරි වුණාම fallback delete එකක් යන්නේ නෑ (admin + members pages දෙකේම)
  readFileSync(join(root, "src/app/admin/administrators/page.tsx"), "utf8").includes("if (isProtectedDeleteRefusal(rpcMsg))") &&
  membersSrc.includes("if (isProtectedDeleteRefusal(msg))") &&
  membersSrc.includes("මේ row එකට id/NIC නෑ — මකන්න බෑ") &&
  // backup restore එකේ කිසිම ගිණුමක් මකන්නේ නෑ (2026-11-07 fix — stale cleanup එක සම්පූර්ණයෙන් ඉවත්)
  !backupSrc.includes('.from("profiles").delete()') &&
  backupSrc.includes("backup එකේ නොතිබුණු ගිණුම්"));

ok("login: NIC login retries the real auth email + admin reset creates a missing login account", 
  readFileSync(join(root, "src/lib/auth.ts"), "utf8").includes("login_email_for_nic") &&
  readFileSync(join(root, "src/lib/auth.ts"), "utf8").includes("const candidates: string[] = []") &&
  readFileSync(join(root, "src/lib/auth.ts"), "utf8").includes("return { error: null, role: uid ? await roleOf(sb, uid) : \"member\" }") &&
  resetRouteSrc.includes("createdLogin") &&
  resetRouteSrc.includes("auth_create_failed") &&
  resetRouteSrc.includes("email: nicEmail") &&
  resetRouteSrc.includes("profilePatch.auth_email = loginEmail") &&
  schema.includes("create or replace function public.login_email_for_nic(p_nic text)") &&
  schema.includes("grant execute on function public.login_email_for_nic(text) to anon, authenticated") &&
  schema.includes("ilike '%@members.mpcs.lk'"));

ok("root: admin UIs lock protected accounts (view/edit/delete/role)",
  membersSrc.includes("canViewPassword") &&
  membersSrc.includes("canDeleteAccount") &&
  membersSrc.includes("Protected") &&
  administratorsSrc.includes("canDeleteAccount") &&
  administratorsSrc.includes("canChangeRole") &&
  administratorsSrc.includes("Original") &&
  administratorsSrc.includes("setSession(savedSession)"));
ok("root: backup carries root flag + AI secret (profiles + backup_secrets + schema)",
  backupTables.includes("profiles") &&
  backupTables.includes("backup_secrets") &&
  schema.includes("is_root_admin boolean"));

console.log("\n── 18) Chat NIC/Phone validation + Activities log delete (superadmin only) ──");
ok("chat: callback + message + member search validate NIC/phone before sending/searching",
  liveChatSrc.includes("looksLikeNicAttempt(raw)") &&
  liveChatSrc.includes("search_invalid_nic") &&
  liveChatSrc.includes("validateNic(nic) || validatePhone(phone)") &&
  liveChatSrc.includes("validatePhone(phone)") &&
  liveChatSrc.includes("normalizeNic(cNic)") &&
  liveChatSrc.includes("normalizePhone(String(fd.get(\"phone\")") &&
  liveChatSrc.includes('logEvent("contact", ref') &&
  !liveChatSrc.includes('logEvent("contact", `${name}'));
const activitiesSrc = readFileSync(join(root, "src/app/admin/activities/page.tsx"), "utf8");
ok("activities: log delete is superadmin-only in UI + RLS (regular admins blocked)",
  activitiesSrc.includes('const canDeleteLogs = role === "superadmin"') &&
  activitiesSrc.includes("deleteLog") &&
  activitiesSrc.includes("deleteShown") &&
  activitiesSrc.includes("LOG_DELETE") &&
  schema.includes("create or replace function public.is_superadmin()") &&
  schema.includes("activity_superadmin_delete") &&
  !schema.includes("activity_admin_write on public.admin_activity_logs for all"));

console.log("\n── 19) Chat trainer credit + designer social menu ──");
ok("chat footer: AI Trained By Induwara Thathsara opens designer WhatsApp/Facebook choices",
  liveChatSrc.includes("AI Trained By") &&
  liveChatSrc.includes("setShowTrainerLinks((v) => !v)") &&
  liveChatSrc.includes("SITE.designer.whatsapp") &&
  liveChatSrc.includes("SITE.designer.facebook") &&
  liveChatSrc.includes("setShowTrainerLinks(false)") &&
  !liveChatSrc.includes("අඩවියේ තොරතුරු + AI සෙවුමෙන් උත්තර දෙයි · 24/7") &&
  !liveChatSrc.includes("Site answers + AI search · 24/7"));

console.log("\n── 20) Admin deletes + sidebar autofill fix + backup history/encryption ──");
ok("admin messages: delete option in Messages page + Live Chat contact requests",
  adminMessagesSrc.includes("deleteMessage") &&
  adminMessagesSrc.includes('dbDelete("messages", { id: m.id })') &&
  adminLiveChatSrc.includes("deleteRequest") &&
  adminLiveChatSrc.includes('dbDelete("messages", { id: m.id })'));
const adminShellSrc = readFileSync(join(root, "src/components/admin.tsx"), "utf8");
ok("admin sidebar: search cannot be credential-autofilled and clears on section change",
  adminShellSrc.includes('type="search"') &&
  adminShellSrc.includes('name="mpcs-panel-filter-7f3a"') &&
  adminShellSrc.includes('data-lpignore="true"') &&
  adminShellSrc.includes("navSearchArmed") &&
  adminShellSrc.includes("readOnly={!navSearchArmed}") &&
  adminShellSrc.includes('value.trim().toLowerCase() === "superadmin"') &&
  adminShellSrc.includes("setNavQ(\"\")") &&
  adminShellSrc.includes("[path]"));
ok("css: Tailwind opacity utilities use generated scale values (no dead /8 or /12 classes)",
  [adminShellSrc, readFileSync(join(root, "src/components/directory.tsx"), "utf8"), readFileSync(join(root, "src/components/home-sections.tsx"), "utf8")]
    .every((src) => !/(bg|border|divide)-white\/(8|12)\b/.test(src)) &&
  adminShellSrc.includes("bg-white/10") &&
  adminShellSrc.includes("focus:bg-white/15"));
const applicationsSrc = readFileSync(join(root, "src/app/admin/applications/page.tsx"), "utf8");
ok("applications: delete is superadmin-only in UI + RLS (section admins blocked)",
  applicationsSrc.includes('const canDeleteApplications = role === "superadmin"') &&
  applicationsSrc.includes("deleteApplication") &&
  applicationsSrc.includes('dbDelete("membership_applications"') &&
  schema.includes("apps_superadmin_delete") &&
  schema.includes("apps_admin_update") &&
  !schema.includes("create policy apps_admin on public.membership_applications for all"));
const dataSrc = readFileSync(join(root, "src/app/admin/data/page.tsx"), "utf8");
ok("data: uploaded sheets can be deleted one-by-one or all (members + voters, counters resync)",
  dataSrc.includes("deleteSheet") &&
  dataSrc.includes("deleteAllSheets") &&
  dataSrc.includes("Delete all sheets") &&
  dataSrc.includes("syncCounters") &&
  dataSrc.includes("DATA_DELETE") &&
  dataSrc.includes('<ImportPanel kind="member"') &&
  dataSrc.includes('<ImportPanel kind="voter"'));
const scheduledBackupSrc = readFileSync(join(root, "src/app/api/scheduled-backup/route.ts"), "utf8");
ok("backup: separate encryption password + saved download/import history (actor/date/time)",
  backupTables.includes("backup_history") &&
  backupSrc.includes("backup_encryption_password") &&
  backupSrc.includes("recordBackupHistory") &&
  backupSrc.includes("getBackupHistory") &&
  adminBackupSrc.includes("ENCRYPTION PASSWORD") &&
  adminBackupSrc.includes("Backup History") &&
  adminBackupSrc.includes('action: "download"') &&
  adminBackupSrc.includes('action: "safety_download"') &&
  adminBackupSrc.includes('action: "import"') &&
  schema.includes("create table if not exists public.backup_history") &&
  schema.includes("backup_history_super") &&
  backupSrc.includes('{ name: "backup_history", pk: "id" }') &&
  scheduledBackupSrc.includes('action: "scheduled"'));
ok("backup history: prune selector keeps only latest 5",
  bu.BACKUP_HISTORY_KEEP === 5 &&
  bu.backupHistoryIdsToPrune([
    { id: "1", created_at: "2026-10-01T00:00:00Z" },
    { id: "7", created_at: "2026-10-07T00:00:00Z" },
    { id: "3", created_at: "2026-10-03T00:00:00Z" },
    { id: "6", created_at: "2026-10-06T00:00:00Z" },
    { id: "2", created_at: "2026-10-02T00:00:00Z" },
    { id: "5", created_at: "2026-10-05T00:00:00Z" },
    { id: "4", created_at: "2026-10-04T00:00:00Z" },
  ]).join(",") === "2,1");
ok("backup history: auto-prune to 5 + manual delete controls + scheduled last-success memory",
  backupSrc.includes("export async function pruneBackupHistory") &&
  backupSrc.includes("export async function deleteBackupHistoryEntry") &&
  backupSrc.includes("await pruneBackupHistory(BACKUP_HISTORY_KEEP)") &&
  adminBackupSrc.includes("deleteHistoryEntry") &&
  adminBackupSrc.includes("pruneHistoryNow") &&
  adminBackupSrc.includes("Delete old (keep") &&
  adminBackupSrc.includes("BACKUP_HISTORY_KEEP") &&
  scheduledBackupSrc.includes("async function pruneBackupHistory") &&
  scheduledBackupSrc.includes("storeLastScheduledSuccessDate") &&
  scheduledBackupSrc.includes("SCHEDULE_LAST_SUCCESS_KEY"));
ok("backup: latest updates ride inside download/import (settings branches/photos + schedule memory + history prune)",
  backupTables.includes("system_settings") &&
  backupTables.includes("backup_history") &&
  backupTables.includes("backup_secrets") &&
  backupTables.includes("site_images_backup") &&
  branchSettings.BUSINESS_BRANCH_PHOTOS_KEY === "business_branch_photos" &&
  branchSettings.RURAL_BANK_BRANCHES_KEY === "rural_bank_branches" &&
  animSettings.BUSINESS_ANIMATION_KEY === "business_animation_settings" &&
  readFileSync(join(root, "src/lib/scheduled-backup.ts"), "utf8").includes("backup_schedule_last_success_date") &&
  backupSrc.includes("if (!opts?.client) await pruneBackupHistory(BACKUP_HISTORY_KEEP)") &&
  backupSrc.includes("Import එකෙන් පස්සේ Backup History එකත් අලුත්ම 5") &&
  backupSrc.includes("backup_history prune:") &&
  scheduledBackupSrc.includes("await pruneBackupHistory();\n  let built") &&
  backupSrc.includes("JSON.stringify"));

console.log("\n── 21) Baymax professional upgrade (greeting · identity · complete answers · links) ──");
ok("greeting name: guest → no name (Hi only); signed-in user/admin → own profile name",
  bot.greetingDisplayName(null) === "" &&
  bot.greetingDisplayName(undefined) === "" &&
  bot.greetingDisplayName({ full_name: "kasun bandara", role: "member" }) === "Kasun Bandara" &&
  bot.greetingDisplayName({ full_name: "Saman Kumara", role: "admin" }) === "Saman Kumara" &&
  bot.greetingDisplayName({ full_name: "Super Administrator", nic: "SUPERADMIN", role: "superadmin" }) === "Induwara Thathsara" &&
  bot.greetingDisplayName({ nic: "200123456781", role: "member" }) === "" &&
  bot.greetingDisplayName({ full_name: "", auth_email: "nimali.perera@example.com" }) === "Nimali Perera");
ok("identity intent: model / creator / website creator / website admin contact",
  bot.detectBotIdentityIntent("ඔයාගේ model එක මොකක්ද?") === "model" &&
  bot.detectBotIdentityIntent("what AI are you?") === "model" &&
  bot.detectBotIdentityIntent("ඔයාගේ AI එක මොකක්ද?") === "model" &&
  bot.detectBotIdentityIntent("ඔයාව හැදුවේ කවුද?") === "creator" &&
  bot.detectBotIdentityIntent("ඔයාව හදාගත්තේ කොහොමද?") === "creator" &&
  bot.detectBotIdentityIntent("who trained you?") === "creator" &&
  bot.detectBotIdentityIntent("මේ website එක හැදුවේ කවුද?") === "website_creator" &&
  bot.detectBotIdentityIntent("who made this website?") === "website_creator" &&
  bot.detectBotIdentityIntent("වෙබ් සයිට් එකේ ඇඩ්මින් ගේ නම්බර් එක මොකක්ද?") === "website_admin_contact" &&
  bot.detectBotIdentityIntent("website admin ge number eka denawada") === "website_admin_contact");
ok("identity intent: ordinary questions are NOT hijacked",
  bot.detectBotIdentityIntent("ගැසට් පත්‍ර ගන්න වෙබ් අඩවිය මොකක්ද?") === null &&
  bot.detectBotIdentityIntent("සභාපතිගේ දුරකථන අංකය කීයද?") === null &&
  bot.detectBotIdentityIntent("What is Google Gemini?") === null &&
  bot.detectBotIdentityIntent("කාර්යාලයේ ඇඩ්මින් ගේ අංකය මොකක්ද?") === null &&
  bot.detectBotIdentityIntent("සීගිරිය කොහෙද තියෙන්නේ?") === null &&
  bot.detectBotIdentityIntent("how do you make a cake?") === null &&
  bot.detectBotIdentityIntent("ඔයා කේක් හදන්නේ කොහොමද?") === null &&
  bot.detectBotIdentityIntent("can you search google for the gazette paper site and give me the link") === null &&
  bot.detectBotIdentityIntent("can you find the train schedule for me") === null);
ok("chat: greeting uses signed-in profile name only + identity handled before AI + links clickable",
  liveChatSrc.includes("signedInNameRef.current") &&
  liveChatSrc.includes("greetingDisplayName(") &&
  !liveChatSrc.includes("visitorName.trim() || convoRef.current.name") &&
  liveChatSrc.includes("detectBotIdentityIntent(q)") &&
  liveChatSrc.indexOf("detectBotIdentityIntent(q)") < liveChatSrc.indexOf("shouldAskAiFirst(q") &&
  liveChatSrc.includes("BAYMAX_CREATOR_PHONE") &&
  liveChatSrc.includes("<LinkedText") &&
  liveChatSrc.includes('target="_blank"') &&
  !liveChatSrc.includes(".slice(0, 600)"));
const completeReq = baymaxAi.buildGeminiRequest("විස්තර කියන්න", "si", true) as { generationConfig?: { maxOutputTokens?: number } };
const longAnswer = `${"වචනය ".repeat(800)}අවසානය.`;
ok("ai: complete answers (large token budget, no mid-answer cut, markdown links → plain URLs)",
  (completeReq.generationConfig?.maxOutputTokens ?? 0) >= 2048 &&
  baymaxAi.cleanAiAnswerText(longAnswer).endsWith("අවසානය.") &&
  baymaxAi.cleanAiAnswerText(longAnswer).length > 1800 &&
  baymaxAi.cleanAiAnswerText("මෙතැනින්: [Gazette](https://documents.gov.lk/gazette)").includes("Gazette — https://documents.gov.lk/gazette"));
const groundedPayload = {
  candidates: [{
    finishReason: "MAX_TOKENS",
    content: { parts: [{ text: "ගැසට් පත්‍ර ගැන විස්තරය." }] },
    groundingMetadata: {
      groundingChunks: [
        { web: { uri: "https://documents.gov.lk/gazette", title: "Sri Lanka Gazette" } },
        { web: { uri: "https://vertexaisearch.cloud.google.com/redirect", title: "redirect" } },
        { web: { uri: "https://documents.gov.lk/gazette", title: "duplicate" } },
      ],
    },
  }],
};
const groundedResult = baymaxAi.extractGeminiResult(groundedPayload);
ok("ai: finish reason + direct source links extracted, appended once (no redirects/dupes)",
  groundedResult.finishReason === "MAX_TOKENS" &&
  groundedResult.sources.length === 1 &&
  groundedResult.sources[0].uri === "https://documents.gov.lk/gazette" &&
  baymaxAi.withSourceLinks("පිළිතුර.", groundedResult.sources, "si").includes("අදාළ සබැඳි") &&
  baymaxAi.withSourceLinks("පිළිතුර.", groundedResult.sources, "si").includes("https://documents.gov.lk/gazette") &&
  baymaxAi.withSourceLinks("බලන්න https://documents.gov.lk/gazette", groundedResult.sources, "si") === "බලන්න https://documents.gov.lk/gazette");
ok("ai: server auto-continues MAX_TOKENS answers + identity/link/completeness instructions",
  baymaxAiRouteSrc.includes("extractGeminiResult") &&
  baymaxAiRouteSrc.includes('"MAX_TOKENS"') &&
  baymaxAiRouteSrc.includes("Continue exactly where the previous answer stopped") &&
  baymaxAiRouteSrc.includes("withSourceLinks") &&
  siInstruction.includes("trained and prepared for this website by Induwara Thathsara") &&
  siInstruction.includes("Never reveal") &&
  siInstruction.includes("full direct URL") &&
  siInstruction.includes("Never stop in the middle") &&
  siInstruction.includes("silently proofread"));

console.log("\n── 22) Multi API keys (auto rotation) + correct Sinhala creator name ──");
ok("keys: 5 slots, first keeps legacy name; collect trims/dedupes in order",
  baymaxAi.GEMINI_API_KEY_SLOTS.length === 5 &&
  baymaxAi.GEMINI_API_KEY_SLOTS[0] === "gemini_api_key" &&
  baymaxAi.GEMINI_API_KEY_SLOTS[4] === "gemini_api_key_5" &&
  JSON.stringify(baymaxAi.collectApiKeys([" k1 ", "", "k2", "k1", null, undefined, " k3 "])) === JSON.stringify(["k1", "k2", "k3"]) &&
  JSON.stringify(baymaxAi.collectApiKeys(["", "  "])) === JSON.stringify([]));
ok("keys: server rotates Key1→Key2→… on quota/invalid and reports key count only",
  baymaxAiRouteSrc.includes("for (const apiKey of apiKeys)") &&
  baymaxAiRouteSrc.includes("[0, 400, 401, 403, 404, 408, 429].includes(lastStatus)") &&
  baymaxAiRouteSrc.includes("tryWithKey(apiKey") &&
  baymaxAiRouteSrc.includes("collectApiKeys([envKey, ...storedKeys])") &&
  baymaxAiRouteSrc.includes("keys: c.apiKeys.length") &&
  !baymaxAiRouteSrc.includes("!c.apiKey)"));
ok("keys: Admin UI has 5 key slots with per-key remove (superadmin only inputs)",
  adminLiveChatSrc.includes("aiKeyInputs") &&
  adminLiveChatSrc.includes("aiKeyMasks") &&
  adminLiveChatSrc.includes("GEMINI_API_KEY_SLOTS.map((slot, i)") &&
  adminLiveChatSrc.includes("clearAiKey(i)") &&
  adminLiveChatSrc.includes("Key {i + 1}") &&
  adminLiveChatSrc.includes("auto Key 2"));
ok("name: Sinhala creator name is ඉඳුවර තත්සර everywhere (canned + AI instruction)",
  bot.BAYMAX_CREATOR_NAME_SI === "ඉඳුවර තත්සර" &&
  liveChatSrc.includes("BAYMAX_CREATOR_NAME_SI") &&
  siInstruction.includes("ඉඳුවර තත්සර") &&
  !liveChatSrc.includes("ඉන්ඳුවර") &&
  !siInstruction.includes("ඉන්ඳුවර"));
ok("identity: 'you said google/gemini before' is answered by fixed identity, not AI",
  bot.detectBotIdentityIntent("ඔයා කලින් කීවෙ google කියා gemini කියා") === "model" &&
  bot.detectBotIdentityIntent("oya kalin kiwwe google kiyala") === "model" &&
  bot.detectBotIdentityIntent("you said you are gemini") === "model");

console.log("\n── 23) Scheduled auto-backup (දවසට පැය කීයකට වරක්ද → Save වේලාවෙන් ඊළඟ පැය → Supabase/MEGA) ──");
const sched = await import("../src/lib/scheduled-backup.ts");
const schSettings = sched.parseScheduleSettings((k) => ({
  backup_schedule_enabled: "1",
  backup_schedule_interval_hours: "4",
  backup_schedule_anchor: "2026-10-16",
  backup_schedule_saved_at: "2026-10-18T15:40:00.000Z", // 18 රාත්‍රී 21:10 (LK)
  backup_schedule_to_supabase: "1",
  backup_schedule_to_mega: "1",
  backup_schedule_keep: "8",
  backup_schedule_mega_folder: "MPCS Backups",
  backup_schedule_encrypt: "0",
}[k]));
ok("schedule: settings parse (පැය ගාණ) + normalize + rows roundtrip",
  schSettings.enabled === true && schSettings.intervalHours === 4 &&
  schSettings.toMega === true && schSettings.keepCount === 8 && schSettings.encrypt === false &&
  sched.parseScheduleSettings(() => undefined).encrypt === true &&
  sched.parseScheduleSettings(() => undefined).intervalHours === 24 &&
  sched.scheduleSettingsRows(schSettings).length === 9 &&
  sched.parseScheduleSettings((k) => Object.fromEntries(sched.scheduleSettingsRows(schSettings).map((r) => [r.key, r.value]))[k]).intervalHours === 4 &&
  sched.parseScheduleSettings(() => undefined).enabled === false &&
  // 24න් බෙදෙන්නේ නැති ගාණක් → ළඟම valid එකට (5 → 4, 7 → 6, 11 → 12)
  sched.normalizeScheduleHours(5) === 4 &&
  sched.normalizeScheduleHours(7) === 6 &&
  sched.normalizeScheduleHours(11) === 12 &&
  sched.normalizeScheduleHours(99) === 24 &&
  sched.normalizeScheduleHours(0) === 1 &&
  // පරණ "දවස්" setting එකක් තිබ්බොත් migrate වේ (3 දවස් → 24 පැය = දවසකට එකයි)
  sched.parseScheduleSettings((k) => k === "backup_schedule_interval_days" ? "1" : undefined).intervalHours === 24);

ok("schedule: පැය 1/4/6/12/24 වලට දවසේ වේලාවන් ගණන (04 → 6, 24 → 1)", 
  sched.scheduleTimesOfDay(4).length === 6 &&
  JSON.stringify(sched.scheduleTimesOfDay(6)) === JSON.stringify(["00:00", "06:00", "12:00", "18:00"]) &&
  JSON.stringify(sched.scheduleTimesOfDay(12)) === JSON.stringify(["00:00", "12:00"]) &&
  JSON.stringify(sched.scheduleTimesOfDay(24)) === JSON.stringify(["00:00"]) &&
  sched.scheduleTimesOfDay(1).length === 24);

const lkAt = (day: number, h: number, m: number) => new Date(Date.UTC(2026, 9, day, h, m) - 330 * 60_000);
// schSettings: 18 රාත්‍රී 21:10ට save කළා → පළවෙනි slot 22:00, ඊට පස්සේ පැය 4කට වරක් (02:00, 06:00 …)
ok("schedule: due logic (save 21:10 → 22:00, 02:00, 06:00 … slot එකකට එක වරක්)",
  sched.backupDueDecision(schSettings, null, lkAt(18, 21, 20)).due === false &&
  sched.backupDueDecision(schSettings, null, lkAt(18, 21, 20)).nextAt === lkAt(18, 22, 0).toISOString() &&
  sched.backupDueDecision(schSettings, null, lkAt(18, 22, 0)).due === true &&   // හරියටම slot වේලාවේ
  sched.backupDueDecision(schSettings, lkAt(18, 22, 0).toISOString(), lkAt(19, 1, 59)).reason === "already_done" &&
  sched.backupDueDecision(schSettings, lkAt(18, 22, 0).toISOString(), lkAt(19, 2, 1)).due === true &&
  sched.backupDueDecision(schSettings, lkAt(19, 2, 0).toISOString(), lkAt(19, 5, 59)).reason === "already_done" &&
  sched.backupDueDecision(schSettings, lkAt(19, 2, 0).toISOString(), lkAt(19, 6, 0)).due === true &&
  sched.backupDueDecision(schSettings, lkAt(19, 18, 0).toISOString(), lkAt(19, 19, 30)).reason === "already_done" &&
  sched.backupDueDecision(schSettings, lkAt(19, 18, 0).toISOString(), lkAt(19, 19, 30)).nextAt === lkAt(19, 22, 0).toISOString() &&
  // disabled / destination නැති
  sched.backupDueDecision({ ...schSettings, enabled: false }, null, lkAt(19, 10, 0)).reason === "disabled" &&
  sched.backupDueDecision({ ...schSettings, toSupabase: false, toMega: false }, null, lkAt(19, 10, 0)).reason === "no_destination" &&
  // පැය 24කට වරක් → දවසකට වරක් (එකම වේලාවට)
  sched.backupDueDecision({ ...schSettings, intervalHours: 24 }, lkAt(19, 22, 0).toISOString(), lkAt(20, 21, 0)).reason === "already_done" &&
  sched.backupDueDecision({ ...schSettings, intervalHours: 24 }, lkAt(19, 22, 0).toISOString(), lkAt(20, 22, 1)).due === true &&
  // LK වේලාව + ගොනු නම
  sched.lkDateParts(new Date(Date.UTC(2026, 9, 19, 3, 0))).dateStr === "2026-10-19" &&
  sched.autoBackupFileName(lkAt(19, 10, 0)) === "mpcs-full-backup-2026-10-19_1000.zip" &&
  sched.autoBackupFileName(lkAt(19, 0, 0)) === "mpcs-full-backup-2026-10-19_0000.zip" &&
  // දවසට කිහිප වරක් යන නිසා එකම දවසේ නම් දෙකක් overwrite වෙන්නේ නෑ
  sched.autoBackupFileName(lkAt(19, 4, 0)) !== sched.autoBackupFileName(lkAt(19, 20, 0)) &&
  sched.nextRunLabel(schSettings, lkAt(19, 5, 0)) === "2026-10-19 06:00");

ok("schedule: copies ගාණ 2–350 (30 නොවේ) + දවසට කිහිප වරක් යන නිසා නමට වේලාවත්",
  sched.MAX_KEEP_COPIES === 350 &&
  sched.MIN_KEEP_COPIES === 2 &&
  sched.parseScheduleSettings((k) => (k === "backup_schedule_keep" ? "350" : undefined)).keepCount === 350 &&
  sched.parseScheduleSettings((k) => (k === "backup_schedule_keep" ? "999" : undefined)).keepCount === 350 &&
  sched.parseScheduleSettings((k) => (k === "backup_schedule_keep" ? "1" : undefined)).keepCount === 2 &&
  readFileSync(join(root, "src/app/admin/backup/page.tsx"), "utf8").includes("max={MAX_KEEP_COPIES}") &&
  !readFileSync(join(root, "src/lib/scheduled-backup.ts"), "utf8").includes("Math.min(30, Math.max(2, keep))"));

ok("schedule: පළවෙනි backup = **Save කරපු වේලාවෙන් ඊළඟ පැයේ මුල** (රෑ 12 බලා ඉන්නේ නෑ)", 
  (() => {
    const oneHour = { ...schSettings, intervalHours: 1, savedAt: lkAt(18, 21, 10).toISOString() };
    const fourHour = { ...schSettings, intervalHours: 4, savedAt: lkAt(18, 21, 10).toISOString() };
    // 21:10 save → 22:00 (එදාම), ඊට පස්සේ ෆැයකට වරක්
    const before = sched.backupDueDecision(oneHour, null, lkAt(18, 21, 20));
    return (
      sched.nextRunLabel(oneHour, lkAt(18, 21, 20)) === "2026-10-18 22:00" &&
      before.due === false && before.reason === "not_started" &&
      sched.backupDueDecision(oneHour, null, lkAt(18, 22, 1)).due === true &&
      sched.nextRunLabel(oneHour, lkAt(18, 22, 1)) === "2026-10-18 23:00" &&
      // පැය 4කට වරක් වුණත් පටන් ගැන්ම ඊළඟ පැයේ මුලින්ම — රෑ 12 නොවේ
      sched.nextRunLabel(fourHour, lkAt(18, 21, 20)) === "2026-10-18 22:00" &&
      JSON.stringify(sched.upcomingRunTimes(fourHour, lkAt(18, 21, 20), 4)) ===
        JSON.stringify(["22:00", "02:00", "06:00", "10:00"]) &&
      // හරියටම පැය මායිමේ (21:00:00) save කළත් ඊළඟ පැයෙන් විතරයි
      sched.nextRunLabel({ ...oneHour, savedAt: lkAt(18, 21, 0).toISOString() }, lkAt(18, 21, 0)) === "2026-10-18 22:00" &&
      // savedAt නැති පරණ settings → දැන් වේලාවෙන් ඊළඟ පැය (පරණ slot එකක් ඉබේම දිව යන්නේ නෑ)
      sched.nextRunLabel({ ...oneHour, savedAt: "" }, lkAt(19, 10, 10)) === "2026-10-19 11:00" &&
      sched.backupDueDecision({ ...oneHour, savedAt: "" }, null, lkAt(19, 10, 10)).due === false &&
      // Admin එකේ පෙන්වන ලැයිස්තුව = ඇත්තටම යන වේලාවන්
      sched.upcomingRunTimes(oneHour, lkAt(18, 21, 20), 3).join(",") === "22:00,23:00,00:00"
    );
  })());

const cronSqlSample = sched.buildCronSql("https://example.vercel.app/", "s3cr3t");
ok("schedule: cron SQL = every 15 min to site route with secret header + bucket",
  cronSqlSample.includes("*/15 * * * *") &&
  cronSqlSample.includes("https://example.vercel.app/api/scheduled-backup") &&
  cronSqlSample.includes("'x-backup-secret', 's3cr3t'") &&
  cronSqlSample.includes("storage.buckets") &&
  readFileSync(join(root, "supabase/scheduled-backup.sql"), "utf8").includes("mpcs-auto-backup-check"));
ok("schedule: route is secret-gated, builds the SAME full ZIP as manual (Encryption Password encrypt option), uploads Supabase+MEGA, records history",
  scheduledBackupSrc.includes('req.headers.get("x-backup-secret")') &&
  scheduledBackupSrc.includes("unauthorized") &&
  scheduledBackupSrc.includes("generateBackupZip") &&
  scheduledBackupSrc.includes("buildFullBackupZip") &&
  scheduledBackupSrc.includes("createClient(SUPA_BASE, SERVICE_KEY") &&
  scheduledBackupSrc.includes('"backup_encryption_password"') &&
  scheduledBackupSrc.includes("settings.encrypt") &&
  scheduledBackupSrc.includes("encryptPassword: encryptPassword || undefined") &&
  scheduledBackupSrc.includes("encryptionConfigured") &&
  scheduledBackupSrc.includes("export const maxDuration = 300") &&
  backupSrc.includes("gatherWorker") &&
  backupSrc.includes('compression: "STORE"') &&
  scheduledBackupSrc.includes('"application/zip"') &&
  scheduledBackupSrc.includes('await import("megajs")') &&
  scheduledBackupSrc.includes("uploadToMega") &&
  scheduledBackupSrc.includes("uploadToSupabase") &&
  scheduledBackupSrc.includes("force") &&
  scheduledBackupSrc.includes("backup_history") &&
  backupSrc.includes("client?: BackupClient") &&
  backupSrc.includes("opts?.client ?? (await authedClient())"));
ok("schedule: Admin card (interval/time/destinations/encrypt/MEGA/cron SQL/test run) + secrets in backup_secrets",
  adminBackupSrc.includes("Scheduled Auto-Backup") &&
  adminBackupSrc.includes("sch.encrypt") &&
  adminBackupSrc.includes("Encryption Password එකෙන් encrypt කරන්න") &&
  adminBackupSrc.includes("saveSchedule") &&
  adminBackupSrc.includes("testScheduleRun") &&
  adminBackupSrc.includes("buildCronSql") &&
  adminBackupSrc.includes("generateCronSecret") &&
  adminBackupSrc.includes("megaEmail") &&
  backupSrc.includes('"mega_password"') &&
  backupSrc.includes('"backup_cron_secret"') &&
  backupTables.includes("backup_secrets"));

// ⚡ Performance: parallel data fetching + request dedupe + instant loading UIs
const slugPageSrc = readFileSync(join(root, "src/app/businesses/[slug]/page.tsx"), "utf8");
const rootLoadingSrc = readFileSync(join(root, "src/app/loading.tsx"), "utf8");
const slugLoadingSrc = readFileSync(join(root, "src/app/businesses/[slug]/loading.tsx"), "utf8");
const adminLoadingSrc = readFileSync(join(root, "src/app/admin/loading.tsx"), "utf8");
ok("perf: businesses ၅ම එකවර + cache() dedupe + targeted detail + settings keys + loading UIs",
  siteDataSrc.includes('import { cache } from "react"') &&
  siteDataSrc.includes("export const getBusinesses = cache(") &&
  siteDataSrc.includes("const [units, svcs, contacts, branches, settingsRes] = await Promise.all([") &&
  siteDataSrc.includes("export const getBusiness = cache(") &&
  siteDataSrc.includes('.eq("slug", slug)') &&
  siteDataSrc.includes("export const getGallery = cache(") &&
  siteDataSrc.includes("export const getSettings = cache(") &&
  siteDataSrc.includes("SITE_SETTING_KEYS") &&
  slugPageSrc.includes("Promise.all([getBusiness(slug), getFuelPrices()])") &&
  rootLoadingSrc.includes("animate-pulse") &&
  slugLoadingSrc.includes("animate-pulse") &&
  adminLoadingSrc.includes("animate-spin") &&
  nextConfigSrc.includes("optimizePackageImports"));

// 🌐 Backup Format v3: site design/update package (CSS + cursor + icons) in Download AND Import
const genSiteSourceSrc = readFileSync(join(root, "scripts/gen-site-source.mjs"), "utf8");
const packageJsonSrc = readFileSync(join(root, "package.json"), "utf8");
ok("backup v3: public icons/images + CSS/cursor source in ZIP, manifest-hashed, import-verified, restored to storage, scheduled = manual",
  bu.BACKUP_FORMAT_VERSION === 3 &&
  backupSrc.includes("PUBLIC_ASSET_PATHS") &&
  backupSrc.includes("[...PUBLIC_ASSET_FILES]") &&
  readFileSync(join(root, "src/lib/public-assets.generated.ts"), "utf8").includes('"icons/phone-call.png"') &&
  readFileSync(join(root, "src/lib/public-assets.generated.ts"), "utf8").includes('"icons/location.png"') &&
  backupSrc.includes("fetchPublicAssets(assetBaseUrl)") &&
  backupSrc.includes("site-public/") &&
  backupSrc.includes("site-assets/public/") &&
  backupSrc.includes("site-source/") &&
  backupSrc.includes("siteAssetCount: siteAssets.length") &&
  backupSrc.includes("siteSourceFileCount: siteSourceFiles.length") &&
  backupSrc.includes("siteAssets: siteAssetCount") &&
  backupSrc.includes('byTable.get("site_images_backup")!.push(row)') &&
  backupSrc.includes("/api/backup/site-source") &&
  genSiteSourceSrc.includes('"src/app/globals.css"') &&
  genSiteSourceSrc.includes('"src/components/cursor-follower.tsx"') &&
  genSiteSourceSrc.includes('"src/components/site-icons.tsx"') &&
  genSiteSourceSrc.includes('"src/components/site-header.tsx"') &&
  genSiteSourceSrc.includes('"src/components/business-detail.tsx"') &&
  genSiteSourceSrc.includes('"src/app/layout.tsx"') &&
  genSiteSourceSrc.includes('"src/app/admin/businesses/page.tsx"') &&
  packageJsonSrc.includes('"prebuild": "node scripts/gen-site-source.mjs"') &&
  packageJsonSrc.includes('"predev": "node scripts/gen-site-source.mjs"') &&
  scheduledBackupSrc.includes("buildFullBackupZip(encPw, req.nextUrl.origin, secrets.cronSecret)") &&
  scheduledBackupSrc.includes("assetBaseUrl,") &&
  adminBackupSrc.includes("site-assets/public/") &&
  adminBackupSrc.includes("siteSourceCount") &&
  adminBackupSrc.includes("sitePublicSqlCount") &&
  adminBackupSrc.includes('sha256Hex(bytes)') &&
  adminBackupSrc.includes("siteAssets: preview.siteAssets") &&
  adminBackupSrc.includes("Site update package") &&
  recText.includes("site-assets/public/"));

// 🖼 Gallery social: replies + comment/reply likes + photo views + superadmin boost
const gallerySocial = await import("../src/lib/gallery-social.ts");
const gsTree = gallerySocial.buildGalleryCommentTree([
  { id: "c1", author: "A", text: "top", created_at: "2026-01-01", parent_id: null, likes: 2 },
  { id: "r1", author: "B", text: "reply", created_at: "2026-01-02", parent_id: "c1", likes: 3 },
  { id: "r2", author: "C", text: "reply to reply", created_at: "2026-01-03", parent_id: "r1", likes: 4 },
  { id: "orphan", author: "D", text: "orphan", created_at: "2026-01-04", parent_id: "missing", likes: 0 },
]);
ok("gallery social: one-level reply tree + counts + boost clamps + random views bounds",
  gsTree.length === 2 &&
  gsTree[0].id === "c1" &&
  gsTree[0].replies.map((r) => r.id).join(",") === "r1,r2" &&
  gallerySocial.countGalleryComments(gsTree.flatMap((n) => [n, ...n.replies])) === 4 &&
  gallerySocial.normalizeGalleryCount(-5) === 0 &&
  gallerySocial.normalizeGalleryCount("42.9") === 42 &&
  gallerySocial.clampBoostAmount("") === 0 &&
  gallerySocial.clampBoostAmount("250000") === 100000 &&
  gallerySocial.randomGalleryViews(() => 0) === 25 &&
  gallerySocial.randomGalleryViews(() => 0.999999) === 250 &&
  gallerySocial.updateGalleryCommentLikes([{ id: "x", author: "", text: "", created_at: "", likes: 1 }], "x", 9)[0].likes === 9);
const gsAlbums = gallerySocial.groupGalleryItems([
  { id: "gal-100-2", title: "PIRITH", description: "Night", aspect: "4:3", image: "2.jpg", likes: 2, views: 20, comments: [{ id: "a", author: "", text: "", created_at: "" }] },
  { id: "gal-100-1", title: "PIRITH", description: "Night", aspect: "4:3", image: "1.jpg", likes: 1, views: 10, comments: [] },
  { id: "x1", title: "AGM", description: "Meeting", aspect: "16:9", image: "3.jpg", likes: 3, views: 30, comments: [] },
  { id: "x2", title: "agm", description: "Meeting", aspect: "16:9", image: "4.jpg", likes: 4, views: 40, comments: [] },
] as never);
ok("gallery albums: batch + same title/description photos become ONE album (ordered photos + totals)",
  gsAlbums.length === 2 &&
  gsAlbums[0].photos.map((p) => p.id).join(",") === "gal-100-1,gal-100-2" &&
  gsAlbums[0].cover.id === "gal-100-1" &&
  gsAlbums[0].totalLikes === 3 &&
  gsAlbums[0].totalViews === 30 &&
  gsAlbums[0].totalComments === 1 &&
  gsAlbums[1].photos.length === 2);
const galleryGridSrc = readFileSync(join(root, "src/components/gallery-grid.tsx"), "utf8");
ok("gallery social: everyone like/view + signed-in replies + superadmin-only boost (UI + RPC + schema + admin + backup snapshot)",
  galleryGridSrc.includes("buildGalleryCommentTree") &&
  galleryGridSrc.includes('me?.role === "superadmin"') &&
  galleryGridSrc.includes("gallery_bump_photo") &&
  galleryGridSrc.includes("gallery_bump_comment_likes") &&
  galleryGridSrc.includes("Random Views (25–250)") &&
  galleryGridSrc.includes("trackView") &&
  galleryGridSrc.includes("parent_id: parentId") &&
  siteDataSrc.includes("parent_id: c.parent_id") &&
  siteDataSrc.includes("views: normalizeGalleryCount(g.views)") &&
  adminGallerySrc.includes("buildGalleryCommentTree") &&
  adminGallerySrc.includes("normalizeGalleryCount(g.views)") &&
  schema.includes("views int not null default 0") &&
  schema.includes("parent_id uuid references public.gallery_comments") &&
  schema.includes("gallery_comment_parent_guard") &&
  schema.includes("public.is_superadmin()") &&
  schema.includes("only superadmins can add custom like/view amounts") &&
  schema.includes("grant execute on function public.gallery_bump_photo(text, int, int) to anon, authenticated") &&
  schema.includes("grant execute on function public.gallery_bump_comment_likes(uuid, int) to anon, authenticated") &&
  genSiteSourceSrc.includes('"src/components/gallery-grid.tsx"') &&
  genSiteSourceSrc.includes('"src/lib/gallery-social.ts"') &&
  genSiteSourceSrc.includes('"src/app/admin/gallery/page.tsx"') &&
  genSiteSourceSrc.includes('"src/lib/supabase/storage.ts"') &&
  genSiteSourceSrc.includes("2026-11-07-full-coverage-v28"));
const homeSectionsSrc = readFileSync(join(root, "src/components/home-sections.tsx"), "utf8");
ok("gallery albums UI: one cover card + View More + album-only popup swipe/arrows/thumbs with per-photo social (gallery page + home + admin)",
  galleryGridSrc.includes("groupGalleryItems(items)") &&
  galleryGridSrc.includes("albums.map") &&
  galleryGridSrc.includes("View More") &&
  galleryGridSrc.includes("onTouchEnd") &&
  galleryGridSrc.includes("albumPhotos") &&
  galleryGridSrc.includes("key={current.id}") &&
  homeSectionsSrc.includes("groupGalleryItems(galItems)") &&
  homeSectionsSrc.includes("galAlbums.slice(0, 4)") &&
  homeSectionsSrc.includes("View More") &&
  homeSectionsSrc.includes("galGo") &&
  adminGallerySrc.includes("groupGalleryItems(items)") &&
  adminGallerySrc.includes("Open Album"));
ok("admin gallery albums: collapsed professional album cards -> open inside to edit/delete each photo + edit album tagline/description for all",
  adminGallerySrc.includes("openAlbumKey") &&
  adminGallerySrc.includes("Photo Album") &&
  adminGallerySrc.includes("Album Content · Manage Photos") &&
  adminGallerySrc.includes("Edit Photo") &&
  adminGallerySrc.includes("Delete Photo") &&
  adminGallerySrc.includes("editAlbumFor") &&
  adminGallerySrc.includes("Edit Album Details") &&
  adminGallerySrc.includes("Save Album Details") &&
  adminGallerySrc.includes("Album Title / Tagline") &&
  adminGallerySrc.includes("Album Description") &&
  adminGallerySrc.includes("for (const p of editAlbumFor.photos)") &&
  adminGallerySrc.includes("setQuery(e.target.value)"));
const publicGalleryPageSrc = readFileSync(join(root, "src/app/gallery/page.tsx"), "utf8");
const i18nSrc = readFileSync(join(root, "src/lib/i18n.tsx"), "utf8");
ok("public gallery: page header follows selected language (Sinhala / English)",
  galleryGridSrc.includes("export function GalleryHero()") &&
  galleryGridSrc.includes("t.galleryPage.title") &&
  galleryGridSrc.includes("t.galleryPage.sub") &&
  i18nSrc.includes('title: "ඡායාරූප ගැලරිය"') &&
  i18nSrc.includes('title: "Photo Gallery"') &&
  publicGalleryPageSrc.includes("<GalleryHero />") &&
  !publicGalleryPageSrc.includes(">ඡායාරූප ගැලරිය</h1>") &&
  genSiteSourceSrc.includes('"src/app/gallery/page.tsx"'));
const ubuntuDesktopEnv = {
  userAgent: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
  anyFinePointer: true,
  anyHover: true,
  finePointer: false,
  coarsePointer: true,
  width: 1366,
};
ok("Ubuntu/Linux desktop motion: animations + cursor work on laptops/PCs even when GNOME reports reduced motion/coarse primary pointer",
  motionCompat.isLinuxDesktopUserAgent(ubuntuDesktopEnv.userAgent) &&
  motionCompat.isLinuxDesktopMotionEnv(ubuntuDesktopEnv) &&
  motionCompat.shouldReduceMotionForEnv(true, ubuntuDesktopEnv) === false &&
  motionCompat.shouldReduceMotionForEnv(true, { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", anyFinePointer: true, width: 1366 }) === true &&
  motionCompat.isLinuxDesktopMotionEnv({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile", width: 390 }) === false &&
  motionCompat.hasDesktopPointerEnv({ sawMouseOrPen: true }) &&
  rootLayoutSrc.includes("isLinuxDesktopUserAgent") &&
  rootLayoutSrc.includes('linuxDesktopMotion ? "motion-compat"') &&
  globalsCssSrc.includes("html:not(.motion-compat) .hero-slide") &&
  globalsCssSrc.includes("html:not(.motion-compat) .biz-products-track") &&
  globalsCssSrc.includes("html:not(.motion-compat):not(.cursor-motion) .cursor-fx") &&
  !globalsCssSrc.includes("@media (pointer: coarse), (prefers-reduced-motion: reduce)") &&
  cursorFollowerSrc.includes('"(any-pointer: fine)"') &&
  cursorFollowerSrc.includes('window.addEventListener("mousemove", onMove') &&
  cursorFollowerSrc.includes('window.addEventListener("touchstart", markTouch') &&
  cursorFollowerSrc.includes("readMotionEnvironment(window, sawMouseOrPen)") &&
  siteSectionsSrc.includes("shouldReduceMotion(window)") &&
  homeSectionsSrc.includes("shouldReduceMotion(window)") &&
  genSiteSourceSrc.includes('"src/lib/motion-compat.ts"') &&
  genSiteSourceSrc.includes('"src/components/hero-slideshow.tsx"') &&
  genSiteSourceSrc.includes("2026-11-07-full-coverage-v28"));
const generatedSiteSource = await import("../src/lib/site-source.generated.ts");
const generatedSiteSourceByPath = new Map(
  generatedSiteSource.SITE_SOURCE_FILES.map((f) => [f.path, f.content])
);
const latestBackupUpdateFiles = [
  "src/app/admin/data/page.tsx",
  "src/app/admin/gallery/page.tsx",
  "src/app/admin/news/page.tsx",
  "src/app/gallery/page.tsx",
  "src/app/admin/settings/page.tsx",
  "src/app/membership/members/page.tsx",
  "src/app/membership/voters/page.tsx",
  "src/app/signin/page.tsx",
  "src/app/register/page.tsx",
  "src/app/globals.css",
  "src/app/layout.tsx",
  "src/middleware.ts",
  "src/components/cursor-follower.tsx",
  "src/components/directory.tsx",
  "src/components/auth-shell.tsx",
  "src/components/register-notice.tsx",
  "src/components/floating-lang.tsx",
  "src/components/gallery-grid.tsx",
  "src/components/hero-slideshow.tsx",
  "src/components/home-sections.tsx",
  "src/components/lang-switcher.tsx",
  "src/components/media-info.tsx",
  "src/components/news-client.tsx",
  "src/components/site-sections.tsx",
  "src/lib/i18n.tsx",
  "src/lib/media-info.ts",
  "src/lib/pdf-register.ts",
  "src/lib/register-notice.ts",
  "src/lib/motion-compat.ts",
];
ok("backup latest updates: generated site-source snapshot is current and includes Gallery language + Ubuntu animation/cursor files + professional glass auth pages",
  generatedSiteSource.SITE_PACKAGE_VERSION === "2026-11-07-full-coverage-v28" &&
  generatedSiteSource.SITE_SOURCE_FILES.length >= 48 &&
  generatedSiteSource.SITE_SOURCE_FILES.every(
    (f) => readFileSync(join(root, f.path), "utf8") === f.content
  ) &&
  latestBackupUpdateFiles.every((p) => generatedSiteSourceByPath.has(p)) &&
  // Source snapshot දැන් server route එකකින් (client bundle එකට MB එකතු නොවේ)
  backupSrc.includes("fetchSiteSourceSnapshot(") &&
  backupSrc.includes("/api/backup/site-source") &&
  !backupSrc.includes('await import("./site-source-assets")'));
const windowsCursorEnv = {
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
  platform: "Win32",
  anyFinePointer: false,
  anyHover: false,
  finePointer: false,
  hover: false,
  coarsePointer: true,
  width: 1366,
  sawMouseOrPen: true,
};
ok("Windows cursor: mouse ring works on Windows laptops even with Animation effects off/reduced motion + coarse primary pointer",
  motionCompat.shouldShowDesktopCursorEnv(windowsCursorEnv) &&
  motionCompat.shouldReduceMotionForEnv(true, windowsCursorEnv) === true &&
  !motionCompat.shouldShowDesktopCursorEnv({ ...windowsCursorEnv, sawMouseOrPen: false }) &&
  cursorFollowerSrc.includes("shouldShowDesktopCursorEnv(env)") &&
  cursorFollowerSrc.includes('document.documentElement.classList.toggle("cursor-motion", ok)') &&
  !cursorFollowerSrc.includes("shouldReduceMotionForEnv(reducedQuery") &&
  globalsCssSrc.includes("html:not(.motion-compat):not(.cursor-motion) .cursor-fx") &&
  genSiteSourceSrc.includes("2026-11-07-full-coverage-v28"));
const newsClientSrc = readFileSync(join(root, "src/components/news-client.tsx"), "utf8");
ok("News + Gallery professional open/view animations: staggered cards + animated reader/lightboxes + directional photo transitions + close/progress polish",
  globalsCssSrc.includes("@keyframes mediaCardIn") &&
  globalsCssSrc.includes("@keyframes viewerPanelIn") &&
  globalsCssSrc.includes("@keyframes viewerImageNext") &&
  globalsCssSrc.includes("@keyframes viewerImagePrev") &&
  globalsCssSrc.includes(".gallery-progress") &&
  globalsCssSrc.includes(".media-shine") &&
  newsClientSrc.includes("useState<NewsItem | null>") &&
  newsClientSrc.includes("function openNews") &&
  newsClientSrc.includes("function closeNews") &&
  newsClientSrc.includes("viewer-backdrop") &&
  newsClientSrc.includes("viewer-panel") &&
  newsClientSrc.includes("viewer-image") &&
  newsClientSrc.includes('URLSearchParams(window.location.search).get("item")') &&
  newsClientSrc.includes("media-card-in") &&
  galleryGridSrc.includes("function openViewer") &&
  galleryGridSrc.includes("function closeViewer") &&
  galleryGridSrc.includes("slideDir") &&
  galleryGridSrc.includes("viewer-image-next") &&
  galleryGridSrc.includes("gallery-progress") &&
  galleryGridSrc.includes("viewer-thumb") &&
  homeSectionsSrc.includes("function openGal") &&
  homeSectionsSrc.includes("function closeGal") &&
  homeSectionsSrc.includes("galDir") &&
  homeSectionsSrc.includes("?item=${encodeURIComponent") &&
  homeSectionsSrc.includes("gallery-progress") &&
  genSiteSourceSrc.includes('"src/components/news-client.tsx"') &&
  genSiteSourceSrc.includes("2026-11-07-full-coverage-v28"));
const mediaInfo = await import("../src/lib/media-info.ts");
ok("media size helpers: actual dimensions → clean ratio/orientation/MP/format/file-size labels",
  mediaInfo.parseAspectRatio("16 / 9")?.label === "16:9" &&
  mediaInfo.aspectFromDimensions(1920, 1080) === "16:9" &&
  mediaInfo.aspectFromDimensions(1366, 768) === "16:9" &&
  mediaInfo.aspectFromDimensions(1080, 1350) === "4:5" &&
  mediaInfo.formatDimensions(1920, 1080) === "1,920 × 1,080 px" &&
  mediaInfo.formatMegapixels(1920, 1080) === "2.07 MP" &&
  mediaInfo.imageFormatFromUrl("https://example.com/photo.jpeg?x=1") === "JPG" &&
  mediaInfo.formatFileSize(1536) === "1.5 KB" &&
  mediaInfo.buildImageMetaSummary({ width: 1920, height: 1080, format: "JPG", lang: "en" }).includes("Widescreen"));
const mediaInfoComponentSrc = readFileSync(join(root, "src/components/media-info.tsx"), "utf8");
const adminNewsSrc = readFileSync(join(root, "src/app/admin/news/page.tsx"), "utf8");
ok("professional image size display: shared actual-size badge/details in Gallery + Home + News + Admin previews/aspect picker",
  mediaInfoComponentSrc.includes("export function useImageMeta") &&
  mediaInfoComponentSrc.includes('method: "HEAD"') &&
  mediaInfoComponentSrc.includes("export function MediaSizeBadge") &&
  mediaInfoComponentSrc.includes("export function MediaDetailsStrip") &&
  mediaInfoComponentSrc.includes("export function AspectShape") &&
  galleryGridSrc.includes("MediaSizeBadge") &&
  galleryGridSrc.includes("MediaDetailsStrip") &&
  homeSectionsSrc.includes("MediaSizeBadge") &&
  homeSectionsSrc.includes("MediaDetailsStrip") &&
  newsClientSrc.includes("MediaSizeBadge") &&
  newsClientSrc.includes("MediaDetailsStrip") &&
  adminGallerySrc.includes("GALLERY_ASPECT_OPTIONS") &&
  adminGallerySrc.includes("AspectShape") &&
  adminGallerySrc.includes("MediaSizeBadge") &&
  adminNewsSrc.includes("MediaSizeBadge") &&
  adminNewsSrc.includes("MediaDetailsStrip") &&
  genSiteSourceSrc.includes('"src/components/media-info.tsx"') &&
  genSiteSourceSrc.includes('"src/lib/media-info.ts"') &&
  genSiteSourceSrc.includes('"src/app/admin/news/page.tsx"'));
const pdfRegisterSrc = readFileSync(join(root, "src/lib/pdf-register.ts"), "utf8");
const registerRowsSrc = readFileSync(join(root, "src/lib/register-rows.ts"), "utf8");
const adminDataSrc = readFileSync(join(root, "src/app/admin/data/page.tsx"), "utf8");
const directorySrc = readFileSync(join(root, "src/components/directory.tsx"), "utf8");
const searchFontBytes = readFileSync(join(root, "public/fonts/AbhayaLibre-Regular.ttf"));
ok("member/voter register PDF: visual page keeps a real invisible Unicode text layer so NIC/name/address are searchable",
  pdfRegisterSrc.includes("html2canvas") &&
  pdfRegisterSrc.includes("doc.addImage") &&
  pdfRegisterSrc.includes("data-pdf-text") &&
  pdfRegisterSrc.includes("collectSearchTextBoxes") &&
  pdfRegisterSrc.includes("addInvisibleTextLayer") &&
  pdfRegisterSrc.includes('renderingMode: "invisible"') &&
  pdfRegisterSrc.includes("doc.addFileToVFS") &&
  pdfRegisterSrc.includes("doc.addFont") &&
  pdfRegisterSrc.includes('"/fonts/AbhayaLibre-Regular.ttf"') &&
  pdfRegisterSrc.includes('escapeHtml(r.nic || "")') &&
  directorySrc.includes('await import("@/lib/pdf-register")') &&
  adminDataSrc.includes('await import("@/lib/pdf-register")') &&
  searchFontBytes.length > 500_000 &&
  searchFontBytes.subarray(0, 4).equals(Buffer.from([0, 1, 0, 0])) &&
  readFileSync(join(root, "src/lib/public-assets.generated.ts"), "utf8").includes('"fonts/AbhayaLibre-Regular.ttf"') &&
  genSiteSourceSrc.includes('"src/lib/pdf-register.ts"') &&
  genSiteSourceSrc.includes('"src/components/directory.tsx"') &&
  genSiteSourceSrc.includes('"src/app/admin/data/page.tsx"') &&
  genSiteSourceSrc.includes("2026-11-07-full-coverage-v28"));
const signinPageSrc = readFileSync(join(root, "src/app/signin/page.tsx"), "utf8");
const registerPageSrc = readFileSync(join(root, "src/app/register/page.tsx"), "utf8");
const authShellSrc = readFileSync(join(root, "src/components/auth-shell.tsx"), "utf8");
const authArtworkRemoved = !existsSync(join(root, "public/images/auth")) &&
  !signinPageSrc.includes("artworkSrc") &&
  !registerPageSrc.includes("artworkSrc") &&
  !authShellSrc.includes("auth-artwork-tile") &&
  !globalsCssSrc.includes(".auth-artwork-tile") &&
  !backupSrc.includes("images/auth/");
ok("Sign In + Register professional glass experience: gradient glass shell (no photo background, no heading artwork tile) + animated password eyes + successful-login check animation + backup coverage",
  authArtworkRemoved &&
  signinPageSrc.includes("AuthSuccessOverlay") &&
  signinPageSrc.includes("setSuccess(true)") &&
  signinPageSrc.includes("window.setTimeout") &&
  registerPageSrc.includes("password !== confirm") &&
  registerPageSrc.includes("AuthSuccessMark") &&
  authShellSrc.includes("export function PasswordVisibilityButton") &&
  authShellSrc.includes("auth-eye-slash") &&
  !authShellSrc.includes("/images/gallery/headquarters.jpg") &&
  !authShellSrc.includes("auth-bg-photo") &&
  !authShellSrc.includes("auth-brand-photo") &&
  globalsCssSrc.includes(".auth-brand-aura") &&
  !globalsCssSrc.includes(".auth-bg-photo {") &&
  globalsCssSrc.includes(".auth-glass-shell") &&
  globalsCssSrc.includes("backdrop-filter: blur(22px) saturate(1.28)") &&
  globalsCssSrc.includes("@keyframes authCircleDraw") &&
  globalsCssSrc.includes("@keyframes authCheckDraw") &&
  globalsCssSrc.includes(".auth-eye-toggle") &&
  genSiteSourceSrc.includes('"src/app/signin/page.tsx"') &&
  genSiteSourceSrc.includes('"src/app/register/page.tsx"') &&
  genSiteSourceSrc.includes('"src/components/auth-shell.tsx"') &&
  genSiteSourceSrc.includes("2026-11-07-full-coverage-v28"));

const registerNoticeLib = await import("../src/lib/register-notice.ts");
const noticeDefaults = registerNoticeLib.defaultRegisterNotice();
const noticeAdminSrc = readFileSync(join(root, "src/app/admin/settings/page.tsx"), "utf8");
const noticeComponentSrc = readFileSync(join(root, "src/components/register-notice.tsx"), "utf8");
const membersPageSrc = readFileSync(join(root, "src/app/membership/members/page.tsx"), "utf8");
const votersPageSrc = readFileSync(join(root, "src/app/membership/voters/page.tsx"), "utf8");
const noticeDataSrc = readFileSync(join(root, "src/lib/data.ts"), "utf8");
const noticeTypesSrc = readFileSync(join(root, "src/lib/types.ts"), "utf8");
ok("member/voter register update notice: default text + phone, admin show/hide per page, live on both pages, inside backup export/import",
  registerNoticeLib.REGISTER_NOTICE_KEY === "register_update_notice" &&
  noticeDefaults.phone === "+94 77 945 3982" &&
  noticeDefaults.phoneDial === "+94779453982" &&
  noticeDefaults.message_si.includes("යාවත්කාලීන වෙමින් පවතින") &&
  registerNoticeLib.noticeDialFromPhone("0779453982") === "+94779453982" &&
  registerNoticeLib.noticeDialFromPhone("+94 77 945 3982") === "+94779453982" &&
  registerNoticeLib.shouldShowRegisterNotice(noticeDefaults, "member") === true &&
  registerNoticeLib.shouldShowRegisterNotice(noticeDefaults, "voter") === true &&
  registerNoticeLib.shouldShowRegisterNotice({ ...noticeDefaults, enabled: false }, "member") === false &&
  registerNoticeLib.shouldShowRegisterNotice({ ...noticeDefaults, showMembers: false }, "member") === false &&
  registerNoticeLib.shouldShowRegisterNotice({ ...noticeDefaults, showMembers: false }, "voter") === true &&
  registerNoticeLib.parseRegisterNotice(registerNoticeLib.serializeRegisterNotice({ ...noticeDefaults, showVoters: false })).showVoters === false &&
  registerNoticeLib.parseRegisterNotice("not-json").enabled === true &&
  registerNoticeLib.registerNoticeText(noticeDefaults, "si").title.startsWith("සියලුම") &&
  registerNoticeLib.registerNoticeText(noticeDefaults, "en").title.includes("Being Updated") &&
  membersPageSrc.includes("notice={settings.register_notice}") &&
  votersPageSrc.includes("notice={settings.register_notice}") &&
  noticeDataSrc.includes('"register_update_notice"') &&
  noticeDataSrc.includes("parseRegisterNotice(map.get(\"register_update_notice\"))") &&
  noticeTypesSrc.includes("interface RegisterNoticeSetting") &&
  noticeComponentSrc.includes("shouldShowRegisterNotice(notice, kind)") &&
  noticeComponentSrc.includes("tel:${dial}") &&
  noticeAdminSrc.includes("REGISTER_NOTICE_KEY") &&
  noticeAdminSrc.includes("Save Notice") &&
  noticeAdminSrc.includes("showMembers") &&
  noticeAdminSrc.includes("showVoters") &&
  noticeAdminSrc.includes("serializeRegisterNotice(notice)") &&
  globalsCssSrc.includes(".reg-notice-phone") &&
  globalsCssSrc.includes("@keyframes regNoticePing") &&
  genSiteSourceSrc.includes('"src/components/register-notice.tsx"') &&
  genSiteSourceSrc.includes('"src/lib/register-notice.ts"') &&
  genSiteSourceSrc.includes('"src/app/admin/settings/page.tsx"') &&
  genSiteSourceSrc.includes('"src/app/membership/members/page.tsx"') &&
  genSiteSourceSrc.includes('"src/app/membership/voters/page.tsx"') &&
  genSiteSourceSrc.includes("2026-11-07-full-coverage-v28"));

// ── Download With Special (admin-granted access + search-only PDF) ──────────
const specialLibSrc = readFileSync(join(root, "src/lib/special-access.ts"), "utf8");
const specialPanelSrc = readFileSync(join(root, "src/components/admin-special-access.tsx"), "utf8");
const schemaSqlSrc = readFileSync(join(root, "supabase/schema.sql"), "utf8");

ok("Download With Special: only signed-in users granted access in the admin panel see the button (F28-style)",
  specialLibSrc.includes('export const SPECIAL_ACCESS_TABLE = "special_download_access"') &&
  specialLibSrc.includes("export function canUseSpecialDownload") &&
  specialAccess.canUseSpecialDownload("active") &&
  !specialAccess.canUseSpecialDownload("none") &&
  !specialAccess.canUseSpecialDownload("disabled") &&
  !specialAccess.canUseSpecialDownload("unknown") &&
  !specialAccess.canUseSpecialDownload("error") &&
  specialAccess.accessStateFromRow({ status: "active" }) === "active" &&
  specialAccess.accessStateFromRow({ status: "disabled" }) === "disabled" &&
  specialAccess.accessStateFromRow(null) === "none" &&
  // site page: access load + button hidden unless active
  directorySrc.includes("SPECIAL_ACCESS_TABLE, SPECIAL_ACCESS_LABEL, accessStateFromRow, canUseSpecialDownload, specialFileLabel,") &&
  directorySrc.includes('.from(SPECIAL_ACCESS_TABLE)') &&
  directorySrc.includes('.eq("user_id", u.user.id)') &&
  directorySrc.includes("const { data: u } = await sb.auth.getUser();") &&
  directorySrc.includes("{canUseSpecialDownload(special) && (") &&
  directorySrc.includes("SPECIAL_ACCESS_LABEL") &&
  !directorySrc.includes("specialAccess={true}") &&
  // admin panel wiring (Data & Live Metrics)
  adminDataSrc.includes('import { AdminSpecialAccessPanel } from "@/components/admin-special-access";') &&
  adminDataSrc.includes("<AdminSpecialAccessPanel />") &&
  specialPanelSrc.includes('title="Do You Want to Authenticate?"') &&
  specialPanelSrc.includes("Add User") &&
  specialPanelSrc.includes("dbUpsert(") &&
  specialPanelSrc.includes("SPECIAL_ACCESS_TABLE,") &&
  specialPanelSrc.includes("Enable") &&
  specialPanelSrc.includes("Disable") &&
  genSiteSourceSrc.includes('"src/lib/special-access.ts"') &&
  genSiteSourceSrc.includes('"src/components/admin-special-access.tsx"'));

ok("Download With Special: button exports ONLY the current search results in the same register PDF format",
  directorySrc.includes("async function downloadPdf(specialMode = false)") &&
  directorySrc.includes("const label = specialMode ? specialFileLabel(base, q) : base;") &&
  directorySrc.includes("rows: filtered.map((r) => ({ ...r })),") &&
  directorySrc.includes('const SEARCH_FIELDS = ["full_name", "nic", "address", "postal_address", "member_no", "voter_no", "file_name"];') &&
  specialAccess.specialFileLabel("All-Files-Members", "දොරටියාගෙදර") === "All-Files-Members-දොරටියාගෙදර" &&
  specialAccess.specialFileLabel("All-Files-Voters", "  ") === "All-Files-Voters-Special" &&
  specialAccess.specialFileLabel("All-Files-Members", 'a/b:c*"d') === "All-Files-Members-a-b-c-d" &&
  specialAccess.specialPdfFileName("All-Files-Members-දොරටියාගෙදර", "member") === "All-Files-Members-දොරටියාගෙදර-members-register.pdf" &&
  specialAccess.filterAccessUsers([{ full_name: "මුදිත ලියනආරච්චි", nic: "123456789V" }], "මුදිත").length === 1 &&
  specialAccess.filterAccessUsers([{ full_name: "මුදිත", nic: "123456789V" }], "999").length === 0 &&
  specialAccess.dedupeAccessRows([
    { id: "a", user_id: "u1", status: "disabled" },
    { id: "b", user_id: "u1", status: "active" },
    { id: "c", user_id: "u2", status: "active" },
  ]).length === 2);

ok("Download With Special: SQL table with own-row read + admin-only writes, and it rides inside backup export/import",
  schemaSqlSrc.includes("create table if not exists public.special_download_access") &&
  schemaSqlSrc.includes("alter table public.special_download_access enable row level security") &&
  schemaSqlSrc.includes("using (user_id = auth.uid() or public.is_admin())") &&
  schemaSqlSrc.includes("using (public.is_admin()) with check (public.is_admin())") &&
  schemaSqlSrc.includes("create index if not exists special_dl_user_idx") &&
  backupSrc.includes('{ name: "special_download_access", pk: "id" }') &&
  !existsSync(join(root, "special-download-access.sql")) // helper SQL workspace එකේ විතරයි — repo එකට යන්නේ නෑ
);

// ── PDF "time remaining" (ETA) overlay ──────────────────────────────────────
const pdfProgressSrc = readFileSync(join(root, "src/components/pdf-progress.tsx"), "utf8");
const globalsCssAll = readFileSync(join(root, "src/app/globals.css"), "utf8");
const directorySrcAll = readFileSync(join(root, "src/components/directory.tsx"), "utf8");

ok("PDF overlay: members + voters show a live time-remaining (ETA) countdown with a strong animation",
  pdfRegisterSrc.includes("export type RegisterPdfProgress") &&
  pdfRegisterSrc.includes("etaMs: number | null") &&
  pdfRegisterSrc.includes("const cumAvg = elapsedTotal / renderedPages") &&
  pdfRegisterSrc.includes("etaMs = Math.max(400, Math.round(perPage * (totalPages - renderedPages)))") &&
  pdfRegisterSrc.includes("emaPageMs = emaPageMs === 0 ? thisPageMs : emaPageMs * 0.45 + thisPageMs * 0.55") &&
  pdfRegisterSrc.includes("report(4 + Math.round(((i + 1) / pageSplits.length) * 96))") &&
  pdfProgressSrc.includes('si ? "ඉතිරි වෙලාව" : "TIME REMAINING"') &&
  pdfProgressSrc.includes("export function formatClock") &&
  pdfProgressSrc.includes("strokeDashoffset={dash}") &&
  pdfProgressSrc.includes("pdf-aurora") &&
  pdfProgressSrc.includes("pdf-orbit") &&
  pdfProgressSrc.includes("pdf-shimmer") &&
  pdfProgressSrc.includes("pdf-tick") &&
  pdfProgressSrc.includes("pdf-burst") &&
  // smooth + human-like countdown: report අතරේත් ETA එක තත්පරයේ කොටසකින් අඩු වේ (පනින්නේ නෑ)
  pdfProgressSrc.includes("const etaTarget = r.eta === null ? null : Math.max(0, r.eta - since)") &&
  pdfProgressSrc.includes("d.eta += (etaTarget - d.eta) * (1 - Math.exp(-dt / 900))") &&
  pdfProgressSrc.includes("d.pct += (pctTarget - d.pct) * (1 - Math.exp(-dt / 520))") &&
  pdfProgressSrc.includes("window.setInterval(() => {") &&
  pdfProgressSrc.includes("stroke-dashoffset 200ms linear") &&
  pdfProgressSrc.includes("formatClock(Math.max(eta, 900))") &&
  pdfProgressSrc.includes("shouldReduceMotion") &&
  globalsCssAll.includes("@keyframes pdfAuroraSpin") &&
  globalsCssAll.includes("@keyframes pdfOrbitSpin") &&
  globalsCssAll.includes("@keyframes pdfShimmerSweep") &&
  globalsCssAll.includes("@keyframes pdfTickIn") &&
  globalsCssAll.includes("@keyframes pdfBurstRing") &&
  globalsCssAll.includes("@media (prefers-reduced-motion: reduce)") &&
  // members + voters page (directory) සහ admin data page — දෙකම overlay එක පාවිච්චි කරයි
  directorySrcAll.includes('import { PdfProgressOverlay, type PdfProgressState } from "@/components/pdf-progress";') &&
  directorySrcAll.includes("<PdfProgressOverlay state={pdfAnim} kind={kind}") &&
  directorySrcAll.includes("onProgress: (info) => setPdfAnim({ label, ...info, done: false })") &&
  adminDataSrc.includes('import { PdfProgressOverlay, type PdfProgressState } from "@/components/pdf-progress";') &&
  adminDataSrc.includes("<PdfProgressOverlay state={anim} kind={kind}") &&
  adminDataSrc.includes("onProgress: (pct: number) => void") === false &&
  adminDataSrc.includes("(info) => setAnim({ label, ...info, done: false })") &&
  genSiteSourceSrc.includes('"src/components/pdf-progress.tsx"'));

// ── Member Update (admin edit, no delete) ───────────────────────────────────
const muSrc = readFileSync(join(root, "src/app/admin/member-update/page.tsx"), "utf8");

ok("Member Update admin section exists in the sidebar with its own permission key",
  adminShellSrc.includes('href: "/admin/member-update"') &&
  adminShellSrc.includes('key: "memberupdate"') &&
  adminShellSrc.includes("PencilLine") &&
  readFileSync(join(root, "src/app/admin/administrators/page.tsx"), "utf8").includes('memberupdate: "Member Update"') &&
  genSiteSourceSrc.includes('"src/app/admin/member-update/page.tsx"') &&
  genSiteSourceSrc.includes('"src/lib/member-update.ts"'));

ok("Member Update: server-side search by name / NIC / address / member number + edit, no delete control at all",
  muSrc.includes("නම, NIC, ලිපිනය, සාමාජික අංකය හෝ file නමින් සොයන්න") &&
  muSrc.includes("c}.ilike.${like}") &&
  muSrc.includes("const cols = [NO_COL[k], \"nic\", \"full_name\", \"address\", \"postal_address\", \"file_name\"]") &&
  muSrc.includes('select(FIELDS[k], { count: "exact" })') &&
  muSrc.includes(".update(patch).eq(\"id\", editFor.id)") &&
  muSrc.includes('FIELDS: Record<Kind, string>') &&
  muSrc.includes("voter: \"id,voter_no,nic,full_name,address,postal_address,gender,file_name\"") &&
  !muSrc.includes("dbDelete") &&
  !muSrc.includes(".delete(") &&
  !muSrc.includes("Trash2"));

ok("Member Update: editing a member auto-updates the matching voter row (NIC first, then name + address)",
  muSrc.includes("findMatchingVoters") &&
  muSrc.includes('eq("voter_no", no)') &&
  muSrc.includes(".filter(isRealNic)") &&
  muSrc.includes('from("voter_rows").update(voterSyncPatch(candidate))') &&
  memberUpdate.voterMatchesMember({ nic: "123456789V" }, { nic: "123456789v" }) &&
  memberUpdate.voterMatchesMember({ voter_no: "62/01", nic: "550660636v" }, { member_no: "62/01", nic: "550660636v" }) &&
  !memberUpdate.voterMatchesMember({ voter_no: "62/02", nic: "0000000000" }, { member_no: "62/01", nic: "0000000000" }) &&
  !memberUpdate.voterMatchesMember({ nic: "0000000000", full_name: "වෙන නම", address: "x" }, { nic: "0000000000", full_name: "නම", address: "y" }) &&
  !memberUpdate.isRealNic("0000000000") &&
  !memberUpdate.isRealNic("") &&
  memberUpdate.isRealNic("550660636v") &&
  memberUpdate.voterMatchesMember({ nic: "", full_name: "කේ. එම්. පෙරේරා", address: "හෙට්ටිපොල" }, { full_name: "කේ. එම්. පෙරේරා", address: "හෙට්ටිපොල" }) &&
  !memberUpdate.voterMatchesMember({ nic: "111111111V" }, { nic: "222222222V" }) &&
  !memberUpdate.voterMatchesMember({ nic: "", full_name: "අමුතු නම", address: "කුරුණෑගල" }, { full_name: "වෙන නම", address: "හෙට්ටිපොල" }) &&
  !memberUpdate.voterMatchesMember({ nic: "", full_name: "", address: "" }, { full_name: "", address: "" }));

ok("Member Update: NIC / gender validation + incomplete-column badge + backup carries the edited tables",
  memberUpdate.validateRegisterEdit({ member_no: "62/01", full_name: "මුදිත", nic: "123456789V" }).length === 0 &&
  memberUpdate.validateRegisterEdit({ member_no: "62/01", full_name: "මුදිත", nic: "12345" }).length === 1 &&
  // පරණ ලේඛනවල තියෙන 10/11 අංක NIC සහ 0000000000 placeholder save වෙන්න ඕනෑ
  memberUpdate.validateRegisterEdit({ member_no: "62/01", full_name: "මුදිත", nic: "19601870067" }).length === 0 &&
  memberUpdate.validateRegisterEdit({ member_no: "62/01", full_name: "මුදිත", nic: "0000000000" }).length === 0 &&
  memberUpdate.validateRegisterEdit({ member_no: "62/01", full_name: "මුදිත", nic: "893570683v" }).length === 0 &&
  memberUpdate.validateRegisterEdit({ member_no: "", full_name: "මුදිත" }).length === 1 &&
  memberUpdate.validateRegisterEdit({ member_no: "62/01", full_name: "මුදිත", gender: "වෙන" }).length === 1 &&
  memberUpdate.missingColumns({ member_no: "62/01", full_name: "නම", nic: "", address: "x", postal_address: "y", gender: "පුරුෂ" }).join(",") === "NIC" &&
  memberUpdate.sanitizeNic(" 123456789 v ") === "123456789V" &&
  memberUpdate.voterSyncPatch({ nic: "123456789v", full_name: " නම  ", address: "ලිපිනය", postal_address: "තැපැල්", gender: "පුරුෂ" }).nic === "123456789V" &&
  backupSrc.includes('{ name: "member_rows", pk: "id" }') &&
  backupSrc.includes('{ name: "voter_rows", pk: "id" }'));

ok("member/voter register PDF: letterhead only on page 1 + 14px readable type + automatic fit-to-page so wrapped rows never squash the page",
  pdfRegisterSrc.includes("const FIRST_PAGE_ROWS = 20;") &&
  pdfRegisterSrc.includes("const CONTINUATION_ROWS = 26;") &&
  pdfRegisterSrc.includes("const isFirstPage = idx === 0;") &&
  pdfRegisterSrc.includes("font-size:14px") &&
  pdfRegisterSrc.includes("font-size:12.5px") &&
  pdfRegisterSrc.includes("const pageSplits: { start: number; count: number }[] = [];") &&
  pdfRegisterSrc.includes("probe.scrollHeight <= HTML_PAGE_HEIGHT") &&
  pdfRegisterSrc.includes("const letterheadHtml = isFirstPage") &&
  pdfRegisterSrc.includes("${letterheadHtml}") &&
  pdfRegisterSrc.includes("(පළවෙනි පිටුව පමණයි)") &&
  !pdfRegisterSrc.includes("PER_PAGE") &&
  pdfRegisterSrc.includes("data-pdf-text") &&
  pdfRegisterSrc.includes('renderingMode: "invisible"'));

ok("register rows: only Excel rows where ALL 6 columns are filled reach the site, the admin import and the generated PDF",
  registerRowsSrc.includes("export function isCompleteRegisterRow") &&
  registerRowsSrc.includes("export function filterCompleteRegisterRows") &&
  registerRowsSrc.includes('String(r.member_no ?? r.voter_no ?? "")') &&
  adminDataSrc.includes('import { isCompleteRegisterRow } from "@/lib/register-rows";') &&
  adminDataSrc.includes("return isCompleteRegisterRow(r);") &&
  directorySrc.includes('import { displayRegisterRows, filterCompleteRegisterRows, isCompleteRegisterRow } from "@/lib/register-rows";') &&
  directorySrc.includes("out.push(...displayRegisterRows(got));") &&
  directorySrc.includes("acc.push(...got.filter(isCompleteRegisterRow));") &&
  // ලැයිස්තුවේ ගණන = ඇත්තටම පෙන්වන (තීරු 6 පිරුණු + duplicate රහිත) පේළි ගණන
  directorySrc.includes("const displayTotal = allRows.length > 0 ? allRows.length : totalRows || filesTotal;") &&
  pdfRegisterSrc.includes('import { displayRegisterRows } from "@/lib/register-rows";') &&
  pdfRegisterSrc.includes("const rows = displayRegisterRows(opts.rows);"));

ok("register rows: duplicates (same person uploaded twice) never counted twice",
  registerRowsSrc.includes("export function registerRowKey") &&
  registerRowsSrc.includes("export function dedupeRegisterRows") &&
  registerRowsSrc.includes("export function displayRegisterRows") &&
  registerRowsSrc.includes("return dedupeRegisterRows(filterCompleteRegisterRows(rows));"));

console.log("\n── 25) Sinhala-tolerant register search (දොරටියගෙදර = දොරටියාගෙදර) + stable paging ──");
{
  const search = await import("../src/lib/search.ts");
  ok("search: සිංහල matra ඉවත් කරන foldSinhala() — ා ි ී ු ෙ ේ …",
    search.foldSinhala("දොරටියාගෙදර") === search.foldSinhala("දොරටියගෙදර") &&
    search.foldSinhala("දොරටියාගෙදර") === "දරටයගදර" &&
    search.foldSinhala("කාන්තා") === search.foldSinhala("කානතා"));

  // ⭐ ප්‍රධාන bug එක: "දොරටියගෙදර" (ා නැතුව) සෙව්වම "දොරටියාගෙදර" පේළිත් එයි
  const rows = [
    { address: "දොරටියාගෙදර", postal_address: "මූණමල්දෙනිය", full_name: "එක් අයෙක්" },
    { address: "298 / 1 දොරටියාගෙදර", postal_address: "මගුලාගම", full_name: "දෙවැන්නා" },
    { address: "දොරටියගෙදර", postal_address: "මූණමල්දෙනිය", full_name: "තුන්වැන්නා" },
    { address: "මල්වාන", postal_address: "දොරටියාගෙදර", full_name: "හතරවැන්නා" },
    { address: "කොළඹ", postal_address: "කුරුණෑගල", full_name: "අදාළ නැති අයෙක්" },
  ];
  const fields = ["full_name", "address", "postal_address"];
  const looseHits = rows.filter((r) => search.rowMatchKind(r, "දොරටියගෙදර", fields) !== null);
  const exactHits = rows.filter((r) => search.rowMatchKind(r, "දොරටියගෙදර", fields) === "exact");
  ok("search: 'දොරටියගෙදර' (ා නැතුව) → 'දොරටියාගෙදර' පේළි 4ම හමුවේ (exact 1 + loose 3)",
    looseHits.length === 4 && exactHits.length === 1);
  ok("search: හරියටම ගැළපෙන එක 'exact', අකුරු වෙනස්කම් නිසා ගැළපෙන එක 'loose'",
    search.rowMatchKind(rows[0], "දොරටියගෙදර", fields) === "loose" &&
    search.rowMatchKind(rows[2], "දොරටියගෙදර", fields) === "exact" &&
    search.rowMatchKind(rows[4], "දොරටියගෙදර", fields) === null);
  ok("search: කෙටි සිංහල වචන (අකුරු 3ට අඩු) → ලිහිල් සෙවුම නෑ (වැරදි ප්‍රතිඵල වැළැක්වීම)",
    search.rowMatchKind({ address: "ගාම" }, "ගම", ["address"]) === null &&
    search.rowMatchKind({ address: "කාන්තා" }, "කාන්තාව", ["address"]) === null &&
    search.rowMatchKind({ address: "දොරටියාගෙදර" }, "දොරටියගෙදර", ["address"]) === "loose");
  ok("search: ඉංග්‍රීසි / NIC / අංක සෙවුම් කලින් වගේම (regression නෑ)",
    search.rowMatch({ nic: "642553520V" }, "642553520v", ["nic"]) &&
    search.rowMatch({ full_name: "Nimal Perera" }, "perera nimal", ["full_name"]) &&
    !search.rowMatch({ full_name: "Nimal Perera" }, "kamal", ["full_name"]));

  // ⚠️ PostgREST range() පිටු — order("id") නැත්නම් පේළි මගහැරෙන්න/දෙපාරක් එන්න පුළුවන්
  const dir = readFileSync(join(root, "src/components/directory.tsx"), "utf8");
  ok("directory: 53,000+ පේළි stable විදිහට ගන්නවා (order id → range) — සෙවුම් ගණන් අඩු වෙන්නේ නෑ",
    dir.includes(".order(\"id\", { ascending: true })") && dir.includes(".range(from, from + BATCH - 1)"));
  ok("directory: තෝරාගත් file එක ඇතුළෙම සොයයි + exact/loose ගණන් පෙන්වයි",
    dir.includes("const scope = file === \"all\" ? allRows : allRows.filter((r) => r.file_name === file);") &&
    dir.includes("searchStats.loose > 0") && dir.includes("rowMatchKind"));
}

console.log("\n── 26) Auto-backup වාර්තා email (file name · type · size · status · time · දවස) ──");
{
  const rep = await import("../src/lib/backup-report.ts");
  ok("backup report: file size human-readable + bytes",
    rep.formatFileSize(1884417) === "1.9 MB (1,884,417 bytes)" && rep.formatFileSize(0).startsWith("0 B"));
  ok("backup report: ගත වූ වේලාව (මිනිත්තු/තත්පර)",
    rep.formatDuration(134_000) === "2 මිනිත්තු 14 තත්පර (134s)" &&
    rep.formatDuration(7_000) === "7 තත්පර (7s)" &&
    rep.formatDuration(3_725_000) === "1 පැය 2 මිනිත්තු 5 තත්පර (3725s)");

  // 2026-11-07 10:30 UTC = 16:00 LK (සෙනසුරාදා)
  const parts = rep.lkDateParts(new Date("2026-11-07T10:30:00Z"));
  ok("backup report: දිනය + දවස + වේලාව (ශ්‍රී ලංකා) — 2026-11-07 සෙනසුරාදා 16:00",
    parts.iso === "2026-11-07" && parts.weekdaySi === "සෙනසුරාදා" && parts.weekdayEn === "Saturday" &&
    parts.time === "16:00" && parts.label.includes("2026-11-07") && parts.label.includes("ශ්‍රී ලංකා"));

  const email = rep.buildBackupReportEmail({
    status: "success",
    source: "auto",
    fileName: "mpcs-full-backup-2026-11-07_1600.zip",
    fileSize: 1884417,
    durationMs: 134_000,
    destinations: ["Supabase", "MEGA (MPCS Backups)"],
    rows: 53210,
    tables: 29,
    images: 24,
    encrypted: true,
    at: new Date("2026-11-07T10:30:00Z"),
    schedule: "Every 4h from 00:00 (LK)",
  });
  ok("backup report: subject එකේ තත්ත්වය + file නම",
    email.subject.includes("mpcs-full-backup-2026-11-07_1600.zip") && email.subject.includes("සාර්ථක"));
  ok("backup report: email එකේ file name · file type · file size · status · time spent · දවස ඔක්කොම තියේ",
    email.body.includes("File name") && email.body.includes("mpcs-full-backup-2026-11-07_1600.zip") &&
    email.body.includes("File type") && email.body.includes("Full backup") &&
    email.body.includes("1.9 MB (1,884,417 bytes)") &&
    email.body.includes("සාර්ථක") && email.body.includes("successful") &&
    email.body.includes("2 මිනිත්තු 14 තත්පර") &&
    email.body.includes("සෙනසුරාදා") && email.body.includes("2026-11-07") &&
    email.fields["File size"].includes("1.9 MB") && email.fields["Day"].includes("Saturday"));

  const failed = rep.buildBackupReportEmail({
    status: "failed",
    fileName: "mpcs-full-backup-2026-11-08_0000.zip",
    fileSize: 0,
    durationMs: 9_000,
    failures: ["MEGA: login failed"],
  });
  ok("backup report: fail වුණත් වාර්තාව එයි (status failed + හේතුව)",
    failed.subject.includes("අසාර්ථක") && failed.body.includes("MEGA: login failed") && failed.body.includes("failed"));

  // route wiring
  const schedRouteSrc = readFileSync(join(root, "src/app/api/scheduled-backup/route.ts"), "utf8");
  ok("scheduled backup: සාර්ථක වුණත් අසාර්ථක වුණත් email report යවයි",
    schedRouteSrc.includes("sendBackupReport(") &&
    (schedRouteSrc.match(/sendBackupReport\(/g) ?? []).length >= 2 &&
    schedRouteSrc.includes("loadBackupReportEmails"));

  const mailSrc = readFileSync(join(root, "src/lib/mail-routes.ts"), "utf8");
  const mailPage = readFileSync(join(root, "src/app/admin/emails/page.tsx"), "utf8");
  ok("admin → Emails: අලුත් “Auto Backup Reports” card එක (mail_route_backup_1..4)",
    mailSrc.includes('key: "backup"') && mailSrc.includes("Auto Backup Reports") &&
    mailPage.includes("backup: HardDriveDownload") &&
    mailSrc.includes("return `mail_route_${route}_${n}`;"));
}

console.log("\n── 27) SMTP-only mail delivery ──");
{
  const ms = readFileSync(join(root, "src/lib/mail-server.ts"), "utf8");
  const mrs = readFileSync(join(root, "src/lib/mail-routes-server.ts"), "utf8");
  const sendRoute = readFileSync(join(root, "src/app/api/mail/send/route.ts"), "utf8");
  const settings = readFileSync(join(root, "src/app/api/mail/settings/route.ts"), "utf8");
  const routes = readFileSync(join(root, "src/lib/mail-routes.ts"), "utf8");
  const page = readFileSync(join(root, "src/app/admin/emails/page.tsx"), "utf8");
  const backup = readFileSync(join(root, "src/lib/backup-report.ts"), "utf8");
  const cron = readFileSync(join(root, "src/app/api/scheduled-backup/route.ts"), "utf8");
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  ok("SMTP: nodemailer dependency, server transport and TLS/STARTTLS", !!pkg.dependencies.nodemailer && ms.includes("nodemailer.createTransport") && ms.includes("requireTLS: !cfg.secure") && ms.includes("smtp.gmail.com"));
  ok("SMTP secrets: backup_secrets + service role, no password in settings GET", ms.includes("SUPABASE_SERVICE_ROLE_KEY") && ms.includes('smtp_pass') && settings.includes("hasPassword: Boolean(smtp?.pass)") && !settings.slice(settings.indexOf("export async function GET"), settings.indexOf("export async function POST")).includes("pass:"));
  ok("SMTP save: schema columns key/value only, detailed error", ms.includes("rows.map((r) => ({ key: r.key, value: r.value }))") && !/updated_at\s*:/.test(ms) && ms.includes("save failed (${res.status})"));
  ok("Mail send: recipient dedupe, explicit missing SMTP error and bounded batches", ms.includes("Array.from(new Set") && ms.includes("if (!smtp)") && ms.includes("i += 3") && ms.includes("sendViaSmtp(smtp, to"));
  ok("Mail send: only SMTP method, no provider loop or fallback sender", !ms.includes("MailProvider") && !ms.includes("sendViaSilentForms") && !ms.includes("loadMailSettings") && !ms.includes("for (const step"));
  ok("Mail send: rejects recipient nonacceptance and closes transporter", ms.includes("info.accepted.length === 0") && ms.includes("transporter?.close()"));
  ok("Mail send: admin Bearer or cron auth retained", sendRoute.includes("userIsAdmin") && sendRoute.includes("cronSecretOk") && sendRoute.includes('if (!authed) return json({ ok: false, reason: "unauthorized" }, 401)'));
  ok("Public forms: server recipient resolution and rate limiting retained", sendRoute.includes("SERVER_MAIL_ROUTES.includes(wanted)") && sendRoute.includes("routeEmailsServer(wanted)") && sendRoute.includes("rateLimit(ip, wanted)") && mrs.includes("MAX_PER_WINDOW"));
  ok("Settings API: admin-only SMTP save/test and rejects unknown provider/key payloads", settings.includes("userIsAdmin") && settings.includes("unsupported_fields") && settings.includes("saveSmtp(") && settings.includes("body.testTo") && settings.includes('provider: "smtp"'));
  ok("Settings API: validates port and preserves blank App Password", settings.includes("invalid_port") && settings.includes("if (!pass) pass = undefined") && settings.includes("port === 587 ? false"));
  ok("Admin UI: only SMTP card + setup instructions + recipients", page.includes("SMTP ONLY") && page.includes("Mail Server (SMTP)") && page.includes("myaccount.google.com/apppasswords") && page.includes("SMTP test recipient") && !/silentforms|RecipientMailKey|Save key/i.test(page));
  ok("Retired client/server integration modules deleted", !existsSync(join(root, "src/lib/silentforms.ts")) && !existsSync(join(root, "src/components/recipient-mail-key.tsx")));
  ok("No retired provider endpoints/client imports in live mail paths", !/silentforms\.com|formsubmit\.co|lib\/silentforms/i.test(ms + sendRoute + settings + routes + page + backup));
  ok("Forms and browser backup reports use server route, no stored client keys", routes.includes('fetch("/api/mail/send"') && backup.includes('fetch("/api/mail/send"') && !backup.includes("localStorage"));
  ok("Backup reports use same server SMTP sender for success/failure", cron.includes("await sendMail({ to, subject, text })") && backup.includes("sender?: (to: string[], subject: string, text: string) => Promise<number>"));
  ok("Backup reports retain exact final ZIP size", cron.includes("fileSize: built.zip.length") && cron.includes("size: built.zip.length"));
  ok("Retired settings cleanup is service-role scoped and only follows SMTP Save", ms.includes("export async function cleanupRetiredMailSettings") && ms.includes('method: "DELETE"') && settings.includes("await cleanupRetiredMailSettings()"));
  const rep = await import("../src/lib/backup-report");
  ok("Backup size formatting remains correct", rep.formatFileSize(36700000) === "36.7 MB (36,700,000 bytes)");
}

{
  const config = await import("../src/lib/mail-config");
  const routes = readFileSync(join(root, "src/lib/mail-routes-server.ts"), "utf8");
  const clientRoutes = readFileSync(join(root, "src/lib/mail-routes.ts"), "utf8");
  const page = readFileSync(join(root, "src/app/admin/emails/page.tsx"), "utf8");
  const settings = readFileSync(join(root, "src/app/api/mail/settings/route.ts"), "utf8");
  const cron = readFileSync(join(root, "src/app/api/scheduled-backup/route.ts"), "utf8");
  ok("Mail recipients: shared limit 10 covers seven emails in UI, public routes and backup reports", config.MAIL_SLOTS === 10 && routes.includes("length: MAIL_SLOTS") && clientRoutes.includes('import { MAIL_SLOTS }') && page.includes("values.length < MAIL_SLOTS") && cron.includes('return routeEmailsServer("backup")'));
  ok("SMTP: known provider mismatch caught, custom Workspace domains allowed", !!config.smtpConfigurationIssue({ host: "smtp.gmail.com", user: "test@mail.com" }) && config.smtpConfigurationIssue({ host: "smtp.gmail.com", user: "test@company.example" }) === null);
  ok("SMTP: identity change requires fresh credentials and errors persist visibly", settings.includes("identityChanged && !pass") && page.includes("setSmtpResult") && page.includes('role="alert"') && page.includes("Object.entries(SMTP_PRESETS)"));
}

console.log(`\n══════════════════════════════════════`);
console.log(`  RESULT: ${pass} passed, ${fail} failed`);
console.log(`══════════════════════════════════════\n`);
process.exit(fail > 0 ? 1 : 0);
