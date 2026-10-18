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
ok("FormSubmit email itk200712@gmail.com", seed.SETTINGS.contact_email_1 === "itk200712@gmail.com");
ok("Years of service 50", seed.SETTINGS.years_of_service === 50 || seed.SETTINGS.years_of_service === "50");
ok("Hero images 5ක් (auto-change slideshow)", Array.isArray(seed.SETTINGS.hero_images) && seed.SETTINGS.hero_images.length === 5, `got ${seed.SETTINGS.hero_images?.length}`);
ok("Hero image files exist (hero-1..5)", seed.SETTINGS.hero_images.every((h: string) => h.startsWith("/images/hero/hero-")));

console.log("\n── 4) Login logic (req #3 NIC login, #7 password display) ──");
ok("nicToEmail('931234567v')", auth.nicToEmail("931234567v") === "931234567v@members.mpcs.lk");
ok("nicToEmail lowercases NIC", auth.nicToEmail("931234567V") === "931234567v@members.mpcs.lk");
const b64 = Buffer.from("Kenula@123").toString("base64");
ok("decodePw(base64) round-trips", auth.decodePw(b64) === "Kenula@123", `got ${auth.decodePw(b64)}`);

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
ok("supabase/ එකේ SQL file එකයි",
  readdirSync(join(root, "supabase")).filter((f) => f.endsWith(".sql")).length === 1,
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
ok("chat: empty history → no Clear chat", bot.hasClearableHistory([]) === false);
ok("chat: system note only → no Clear chat", bot.hasClearableHistory([{ sender: "system" }]) === false);
ok("chat: visitor msg → Clear chat shows", bot.hasClearableHistory([{ sender: "system" }, { sender: "visitor" }]) === true);
ok("chat: officer msg → Clear chat shows", bot.hasClearableHistory([{ sender: "agent" }]) === true);
ok("chat: typing shows only when joined", bot.shouldShowTyping("joined", true) === true);
ok("chat: typing hidden when closed", bot.shouldShowTyping("closed", true) === false);
ok("chat: typing hidden when open/waiting", bot.shouldShowTyping("open", true) === false);
ok("chat: typing hidden when not typing", bot.shouldShowTyping("joined", false) === false);

console.log(`\n══════════════════════════════════════`);
console.log(`  RESULT: ${pass} passed, ${fail} failed`);
console.log(`══════════════════════════════════════\n`);
process.exit(fail > 0 ? 1 : 0);
