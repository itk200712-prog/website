import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
page.on("console", (m) => { if (m.type() === "error" && !/favicon|404/.test(m.text())) errs.push("C:" + m.text().slice(0, 120)); });

await page.goto(SITE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
await page.locator('button[aria-label="Live chat"]').click();
await page.waitForTimeout(1200);

// action bar
for (const t of ["Find Member", "Business Managers", "Office Phones", "Managers Phones", "Contact Live Chat"]) {
  const n = await page.getByRole("button", { name: t, exact: true }).count();
  console.log(`${n ? "✅" : "❌"} button: ${t} (${n})`);
}

// ── FIND MEMBER ──
await page.getByRole("button", { name: "Find Member", exact: true }).first().click();
await page.waitForTimeout(700);
const ph = await page.locator('input[placeholder*="Muditha"]').count();
console.log(`✅ "Enter Your Name or NIC" panel: ${ph ? "yes" : "NO"}`);
await page.locator('input[placeholder*="Muditha"]').fill("ලියනආරච්චි");
await page.getByRole("button", { name: /Search/ }).click();
await page.waitForTimeout(4000);
let body = await page.evaluate(() => document.querySelector(".overflow-y-auto")?.innerText || "");
const resMatch = /result/i.test(body);
const hasMemberNo = /\/\d{2,4}/.test(body);
console.log(`✅ search results: ${resMatch ? "yes" : "NO"} · member numbers: ${hasMemberNo ? "yes" : "NO"}`);
const applyBtn = await page.getByRole("button", { name: /Apply Membership/ }).count();
console.log(`✅ Apply Membership button in list: ${applyBtn ? "yes" : "NO"}`);
if (applyBtn) {
  await page.getByRole("button", { name: /Apply Membership/ }).first().click();
  await page.waitForTimeout(900);
  const link = await page.locator('a[href="/membership/apply"]').count();
  console.log(`✅ application page button: ${link ? "yes" : "NO"}`);
}

// ── BUSINESS MANAGERS ──
await page.getByRole("button", { name: "Business Managers", exact: true }).first().click();
await page.waitForTimeout(6000);
body = await page.evaluate(() => document.querySelector(".overflow-y-auto")?.innerText || "");
const divCount = (body.match(/🏢/g) || []).length;
const mgrCount = (body.match(/Manager:/g) || []).length;
console.log(`✅ business managers: ${divCount} divisions / ${mgrCount} manager lines`);

// ── OFFICE PHONES ──
await page.getByRole("button", { name: "Office Phones", exact: true }).first().click();
await page.waitForTimeout(2500);
body = await page.evaluate(() => document.querySelector(".overflow-y-auto")?.innerText || "");
console.log(`✅ office phones: ${/Board of Directors/.test(body) ? "header yes" : "NO"} · phones ${(body.match(/📞/g)||[]).length}`);

// ── MANAGERS PHONES ──
await page.getByRole("button", { name: "Managers Phones", exact: true }).first().click();
await page.waitForTimeout(4500);
body = await page.evaluate(() => document.querySelector(".overflow-y-auto")?.innerText || "");
console.log(`✅ managers phones: ${/Managers’ Phone Numbers/.test(body) ? "yes" : "NO"} · blocks ${(body.match(/📞/g)||[]).length}`);

// ── CONTACT LIVE CHAT ──
await page.getByRole("button", { name: "Contact Live Chat", exact: true }).first().click();
await page.waitForTimeout(900);
await page.locator('input[placeholder="Your Name *"]').fill("QA Livechat");
await page.locator('input[placeholder="NIC Number *"]').fill("199912345678");
await page.locator('input[placeholder="Phone Number *"]').fill("0771234567");
await page.getByRole("button", { name: "Submit", exact: true }).click();
await page.waitForTimeout(5000);
body = await page.evaluate(() => document.querySelector(".overflow-y-auto")?.innerText || "");
console.log(`✅ waiting card: ${/Waiting for an officer/i.test(body) ? "yes" : "NO"} · ref ${/LC-[A-Z0-9]+/.test(body) ? "yes" : "NO"}`);

console.log("JS errors:", errs.length ? errs.slice(0, 2) : "none ✅");
await page.screenshot({ path: "/home/user/view-chat.png" });
await browser.close();
