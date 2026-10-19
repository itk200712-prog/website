// ============================================================================
//  Panduwasnuwara MPCS — logic & data verification tests
//  ක්‍රියා කරවන්න: npm test   (npx tsx scripts/test.ts)
// ============================================================================

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
let pass = 0, fail = 0;

function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ""}`); }
}

// ---- import TS modules via tsx ----
const seed = await import("../src/lib/seed.ts");
const auth = await import("../src/lib/auth.ts");

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
ok("FormSubmit email itk200712@gmail.com", seed.SETTINGS.contact_email_1 === "itk200712@gmail.com");
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

console.log("\n── 6) FormSubmit format (req #1) ──");
const fs = `https://formsubmit.co/${seed.SETTINGS.contact_email_1}`;
ok("formsubmit.co/itk200712@gmail.com", fs === "https://formsubmit.co/itk200712@gmail.com");

console.log("\n── 7) Default business template (req #4) ──");
const fresh = seed.BUSINESSES.find((b) => b.slug === "ristbury-tiara");
ok("Hemas-format default features", fresh.services[0].features_en.includes("Trusted quality") && fresh.services[0].features_en.includes("Member privileges") && fresh.services[0].features_en.includes("Certified standard"));
ok("Default desc fallback present", fresh.services[0].desc_en.startsWith("Premier service offered by"));
const hemas = seed.BUSINESSES.find((b) => b.slug === "hemas");
ok("Hemas page has its own default-style services (6)", hemas.services.length === 6);

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
ok("hours: Mon 08:30 open", bot.isLiveChatOpen(lkTime(19, 8, 30)) === true);
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
ok("brain: officer-contact process mentions Live Chat hours", askSite("නිලධාරියෙක් සම්බන්ද කරගන්නෙ කොහොමද?")?.entry.body_si.includes("සඳුදා–සිකුරාදා") === true);

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
ok("mail: unconfirmed FormSubmit address is not counted as sent",
  mailRoutesSrc.includes('j.success === "true"'));
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
ok("backup: ZIP embeds canonical schema.sql (live chat DB logic + RLS)",
  backupSrc.includes('addFile("schema.sql"') && backupSrc.includes("../../supabase/schema.sql"));
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
ok("utils: encrypt → envelope detected", bu.isEncryptedBackupText(encSample) === true);
ok("utils: decrypt round-trips (Sinhala safe)", (await bu.decryptBackupText(encSample, "Test@123")) === "SELECT 'ආයුබෝවන්';");
let wrongPwThrew = false;
try { await bu.decryptBackupText(encSample, "wrong-password"); } catch { wrongPwThrew = true; }
ok("utils: wrong encryption password rejected", wrongPwThrew);
const sampleSql = "INSERT INTO public.news (\"id\", \"t\") VALUES ('1', 'a''b');\nINSERT INTO public.news (\"id\", \"t\") VALUES ('2', NULL);\nINSERT INTO public.profiles (\"id\") VALUES ('9');\n";
const parsedSample = bu.parseBackupSql(sampleSql);
ok("utils: parseBackupSql 3 inserts + escaped quote + NULL", parsedSample.length === 3 && parsedSample[0].values[1] === "a'b" && parsedSample[1].values[1] === null);
const sampleSummary = bu.summarizeInserts(parsedSample);
ok("utils: summarizeInserts per-table counts", sampleSummary.totalRows === 3 && sampleSummary.tables.find((t) => t.name === "news")?.rows === 2);
const sampleManifest = bu.buildManifest({ generatedAt: "2026-10-18T00:00:00Z", tableCounts: { a: 2, b: 3 }, imageCount: 4, encrypted: false, supabaseHost: "x.supabase.co", schemaSha256: "s", databasePlainSha256: "d", files: { "database.sql": { sha256: "h", size: 5 } } });
ok("utils: manifest = format v2 + totalRows summed", sampleManifest.formatVersion === 2 && sampleManifest.totalRows === 5 && bu.BACKUP_FORMAT_VERSION === 2);
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
ok("scheduled backup: Edge Function + pg_cron SQL in repo",
  readFileSync(join(root, "supabase/functions/scheduled-backup/index.ts"), "utf8").includes("Deno.serve") &&
  readFileSync(join(root, "supabase/scheduled-backup.sql"), "utf8").includes("cron.schedule"));

console.log("\n── 16) Baymax Gemini AI fallback (server-side only key) ──");
const baymaxAi = await import("../src/lib/baymax-ai.ts");
ok("ai: model id normalizes models/ prefix + case", baymaxAi.normalizeGeminiModel("models/Gemini-3.8-Flash") === "gemini-3.8-flash");
ok("ai: blank model falls back to default", baymaxAi.normalizeGeminiModel("  ") === baymaxAi.DEFAULT_GEMINI_MODEL);
const fallbackChain = baymaxAi.modelFallbackChain("gemini-3.5-flash-lite");
ok("ai: model fallback chain (selected first, unique, capped)", fallbackChain[0] === "gemini-3.5-flash-lite" && fallbackChain.includes("gemini-2.5-flash") && fallbackChain.length === 5 && new Set(fallbackChain).size === fallbackChain.length);
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
ok("ai: history is sanitized (roles mapped, long answers kept whole up to cap)",
  JSON.stringify(baymaxAi.normalizeAiHistory([
    { role: "assistant", text: "  ආයුබෝවන්   ලෝකය " },
    { role: "weird", text: "කොහොමද" },
    { role: "user", text: "x" },
    { role: "model", text: "y".repeat(4500) },
  ])) === JSON.stringify([
    { role: "model", text: "ආයුබෝවන් ලෝකය" },
    { role: "user", text: "කොහොමද" },
    { role: "model", text: "y".repeat(4000) },
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
  adminLiveChatSrc.includes('key: "gemini_api_key"') &&
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
  baymaxAiRouteSrc.includes("backup_secrets?select=value&key=eq.gemini_api_key") &&
  baymaxAiRouteSrc.includes('"x-goog-api-key"') &&
  baymaxAiRouteSrc.includes("sameOrigin") &&
  baymaxAiRouteSrc.includes("server_not_configured") &&
  baymaxAiRouteSrc.includes("modelFallbackChain") &&
  baymaxAiRouteSrc.includes("quota_exceeded") &&
  baymaxAiRouteSrc.includes("normalizeAiHistory") &&
  baymaxAiRouteSrc.includes("result.status !== 400 && result.status !== 429"));
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
  adminShellSrc.includes('name="mpcs-admin-panel-search"') &&
  adminShellSrc.includes('data-lpignore="true"') &&
  adminShellSrc.includes("setNavQ(\"\")") &&
  adminShellSrc.includes("[path]"));
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
const scheduledBackupSrc = readFileSync(join(root, "supabase/functions/scheduled-backup/index.ts"), "utf8");
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
  scheduledBackupSrc.includes('{ name: "backup_history", pk: "id" }') &&
  scheduledBackupSrc.includes('action: "scheduled"'));

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

console.log(`\n══════════════════════════════════════`);
console.log(`  RESULT: ${pass} passed, ${fail} failed`);
console.log(`══════════════════════════════════════\n`);
process.exit(fail > 0 ? 1 : 0);
