import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.goto(`${SITE}/membership/members`, { waitUntil: "domcontentloaded" });
// තත්පර 6කින් — progressive rows පේනවද (පළමු batch)
await page.waitForTimeout(6000);
let body = await page.evaluate(() => document.body.innerText);
const early = body.includes("Members") && /[\d,]+ Members/.test(body);
console.log("instant total badge:", (body.match(/[\d,]+ Members/) || ["?"])[0], early ? "✅" : "❌");
console.log("early rows visible (6s):", /\d+\/\d+/.test(body) && !body.includes("Loading data…") ? "✅ progressive" : "⏳ " + (body.includes("Loading data") ? "still loading" : "no rows"));
console.log("progress chip:", body.includes("52,965") ? "✅ total shown" : "❌");
// full load එකට ඉඩ දෙන්න
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(4000);
  body = await page.evaluate(() => document.body.innerText);
  if (!body.includes("⏳")) break;
}
const badge = (body.match(/[\d,]+ Members/) || ["?"])[0];
const meta = (body.match(/Showing [\d,]+–[\d,]+ of [\d,]+ entries/) || ["?"])[0];
console.log("FULL LOAD badge:", badge, badge.includes("52,965") ? "✅✅" : "❌");
console.log("meta:", meta, meta.includes("52,965") ? "✅" : "❌");
console.log("rows sample:", body.includes("01/01") || body.includes("1/") ? "✅ rows shown" : "❌");
console.log("chip done:", body.includes("✓ 52,965") ? "✅" : "—");
await page.screenshot({ path: "qa34-top.png", clip: { x: 0, y: 0, width: 1440, height: 700 } });
await page.screenshot({ path: "qa34-bottom.png", clip: { x: 0, y: 640, width: 1440, height: 460 } });
// popup
await page.locator("tr.group").nth(2).click();
await page.waitForTimeout(800);
const pop = (await page.evaluate(() => document.body.innerText)).includes("POSTAL ADDRESS");
console.log("details popup:", pop ? "✅" : "❌");
await page.screenshot({ path: "qa34-popup.png" });
await browser.close();
console.log("RESULT:", badge.includes("52,965") && pop ? "PRO DESIGN + REAL DATA OK" : "CHECK");
