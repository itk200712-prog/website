import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
await page.goto(SITE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.locator('button[aria-label="Live chat"]').click();
await page.waitForTimeout(700);
await page.getByRole("button", { name: "Find Member", exact: true }).first().click({ force: true });
await page.waitForTimeout(700);
await page.locator('input[placeholder*="Muditha"]').fill("දික්වැල්ල වික්‍රමරත්න");
await page.getByRole("button", { name: "Search", exact: true }).click({ force: true });
await page.waitForTimeout(4500);
let t = await page.evaluate(() => [...document.querySelectorAll(".overflow-y-auto")].map(e => e.innerText).join("\n"));
console.log("multi-token:", /result/.test(t) ? "✅" : "❌");
console.log("names found:", (t.match(/දික්වැල්ල/g) || []).length);
const clickable = await page.locator("button").filter({ hasText: /View full details/ }).count();
console.log("clickable results:", clickable);
if (clickable) {
  await page.locator("button").filter({ hasText: /View full details/ }).first().click({ force: true });
  await page.waitForTimeout(1500);
  t = await page.evaluate(() => [...document.querySelectorAll(".overflow-y-auto")].map(e => e.innerText).join("\n"));
  console.log("full details:", /Full details/.test(t) ? "✅" : "❌");
}
// single token "කසුන්"
await page.locator('input[placeholder*="Muditha"]').fill("කසුන්").catch(()=>{});
await page.getByRole("button", { name: "Search", exact: true }).click({ force: true }).catch(()=>{});
await page.waitForTimeout(4000);
t = await page.evaluate(() => [...document.querySelectorAll(".overflow-y-auto")].map(e => e.innerText).join("\n"));
console.log("single token කසුන්:", /result/.test(t) ? "✅" : "❌");
console.log("JS errors:", errs.length ? errs[0] : "none ✅");
await page.screenshot({ path: "/home/user/view-search.png" });
await browser.close();
