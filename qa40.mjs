import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

// 1) Sinhala homepage — ඉවත් කළ යුතු texts
await page.goto(`${SITE}/si`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
const si = await page.evaluate(() => document.body.innerText);
const gone = [
  "පාලනය සහ නායකත්වය", "නිල සාමාජිකයින් · පරිපාලන නිලධාරීන්", "අපගේ ව්‍යාපාර අංශ",
  "මතකයන් සහ ප්‍රජාව", "නිල නිවේදන සහ යාවත්කාලීන", "අප අමතන්න",
  "අපගේ ප්‍රධාන කාර්යාල කළමනාකරණය", "සමිතියේ නවතම රැකියා අවස්ථා",
  "අපගේ ශාඛා, ප්‍රජා සේවා", "පවත්වාගෙන යනු ලබන ප්‍රධාන ව්‍යාපාරික",
  "උපායමාර්ගික පාලනය සහ පරිපාලන", "සමූපකාර ශක්තියෙන් ප්‍රජාව සවිබල",
  "සාමාජික ජනතාවට විශ්වාසනීය",
];
for (const g of gone) console.log((si.includes(g) ? "❌ still there: " : "✅ gone: ") + g.slice(0, 26));

// 2) Business page — Payment & Valuation
await page.goto(`${SITE}/si/businesses`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
const links = await page.evaluate(() => [...document.querySelectorAll('a[href*="/businesses/"]')].map((a) => a.href).slice(0, 3));
let payFound = false, checked = 0;
for (const href of links) {
  await page.goto(href, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const t = await page.evaluate(() => document.body.innerText);
  checked++;
  if (/Payment & Valuation|ගෙවීම් ක්‍රම පිළිබඳ/.test(t)) { payFound = true; console.log("❌ Payment card on", href); }
}
console.log(`Payment & Valuation: ${payFound ? "❌" : "✅ gone"} (${checked} business pages checked)`);

// 3) Directory — subtitle + RFC line + icon
await page.goto(`${SITE}/en/membership/members`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);
const dir = await page.evaluate(() => document.body.innerText);
console.log("RFC line:", dir.includes("RFC-4180") ? "❌" : "✅ removed");
console.log("dir subtitle:", dir.includes("Official registered member directory") ? "❌" : "✅ removed");
const iconBox = await page.evaluate(() => !!document.querySelector(".w-14.h-14.rounded-2xl.bg-white\\/12"));
console.log("header icon box:", iconBox ? "❌ still" : "✅ removed");
await page.screenshot({ path: "qa40-dir.png", clip: { x: 0, y: 0, width: 1440, height: 520 } });
await browser.close();
