import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();

// ── 1) GUEST presence: page 1 (guest) ──
const p1 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs1 = [];
p1.on("pageerror", (e) => errs1.push(String(e).slice(0, 120)));
await p1.goto(`${SITE}/en`, { waitUntil: "domcontentloaded" });
await p1.waitForTimeout(6000);
const si = await p1.evaluate(() => document.body.innerText);
const goneList = [
  "Strategic governance and administrative leadership",
  "Key business and community service divisions",
  "Capturing our branches, community services",
  "Stay informed with the latest cooperative recruitment",
  "Reach out to our headquarters management",
];
goneList.forEach((g) => console.log((si.includes(g) ? "❌ still: " : "✅ gone: ") + g.slice(0, 34)));

// ── 2) header wrapping check ──
const hdr = await p1.evaluate(() => {
  const nav = document.querySelector("header nav");
  const brand = document.querySelector("header a[href$='/en'], header a[href='/en'] , header a");
  const brandEl = [...document.querySelectorAll("header div")].find((d) => /Panduwaswara|Panduwasnuwara New MPCS LTD/i.test(d.textContent || "") && d.children.length === 0);
  const h1 = document.querySelector("header");
  return {
    headerH: h1 ? Math.round(h1.getBoundingClientRect().height) : 0,
    brandWrap: brandEl ? Math.round(brandEl.getBoundingClientRect().height) : 0,
    navLeft: nav ? Math.round(nav.getBoundingClientRect().left) : 0,
    brandRight: brandEl ? Math.round(brandEl.getBoundingClientRect().right) : 0,
  };
});
console.log("header:", JSON.stringify(hdr), hdr.headerH <= 74 ? "✅ no wrap" : "❌ wrapped");

// ── 3) ADMIN: guest counter ──
const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await p2.goto(`${SITE}/signin`, { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(1500);
await p2.fill('input[name="nic"]', "superadmin@members.mpcs.lk");
await p2.fill('input[name="password"]', "Admin@123");
await p2.locator('form button[type="submit"]').first().click();
await p2.waitForTimeout(5000);
await p2.goto(`${SITE}/admin`, { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(6000);
const card = await p2.evaluate(() => {
  const all = [...document.querySelectorAll("div")];
  const el = all.find((d) => /Users Online Now \(Guests\)/.test(d.textContent || "") && d.className.includes("card"));
  return el ? el.innerText.replace(/\n/g, " | ") : "none";
});
console.log("guest card:", JSON.stringify(card));
const hasNumber = card !== "none" && !/\|\s*—\s*\|/.test(card);
console.log("guest count REAL:", hasNumber ? "✅ " + card.split("|")[1]?.trim() : "❌ still dash");

// ── 4) admin profile photo UI ──
await p2.goto(`${SITE}/admin/profile`, { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(3500);
const prof = await p2.evaluate(() => document.body.innerText);
console.log("admin photo upload UI:", /Profile Photo එකක් දාන්න|Photo වෙනස් කරන්න/.test(prof) ? "✅" : "❌");
const fileInputs = await p2.evaluate(() => document.querySelectorAll('input[type="file"][accept="image/*"]').length);
console.log("image inputs:", fileInputs, fileInputs >= 1 ? "✅" : "❌");

// ── 5) full-site console error scan ──
const pages = ["/en", "/si", "/en/businesses", "/en/gallery", "/en/news", "/en/board", "/en/contact", "/en/membership/members", "/en/membership/voters", "/en/membership/apply", "/en/signin", "/en/register", "/en/dashboard"];
const bad = [];
for (const path of pages) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 90)));
  p.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource|401|403/.test(m.text())) errs.push("console:" + m.text().slice(0, 80)); });
  await p.goto(SITE + path, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  if (errs.length) bad.push({ path, errs: errs.slice(0, 2) });
  await p.close();
}
console.log("pages with JS errors:", bad.length === 0 ? "✅ none" : JSON.stringify(bad, null, 1));
await browser.close();
