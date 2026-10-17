import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
await page.goto(SITE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
await page.locator('button[aria-label="Live chat"]').click();
await page.waitForTimeout(800);

// 1) Business Managers → button panel
await page.getByRole("button", { name: "Business Managers", exact: true }).first().click();
await page.waitForTimeout(4000);
let t = await page.evaluate(() => [...document.querySelectorAll(".overflow-y-auto")].map(e => e.innerText).join("\n"));
console.log("1) business panel:", /Tap your business below/.test(t) ? "✅" : "❌");
const bizBtns = await page.locator("button").filter({ hasText: /Rural Bank|Consumer|Transport|Insurance/ }).count();
console.log("   business buttons:", bizBtns);
if (bizBtns) {
  await page.locator("button").filter({ hasText: /Rural Bank/ }).first().click();
  await page.waitForTimeout(3000);
  t = await page.evaluate(() => [...document.querySelectorAll(".overflow-y-auto")].map(e => e.innerText).join("\n"));
  console.log("   business phone shown:", /📞/.test(t) ? "✅" : "❌");
}

// 2) Office Phones → name buttons
await page.getByRole("button", { name: "Office Phones", exact: true }).first().click();
await page.waitForTimeout(3000);
const officeBtns = await page.locator("button").filter({ hasText: /Chairman|Director|Hearth|Herath/ }).count();
console.log("2) office name buttons:", officeBtns);
if (officeBtns) {
  await page.locator("button").filter({ hasText: /Herath|Chairman/ }).first().click();
  await page.waitForTimeout(2500);
  t = await page.evaluate(() => [...document.querySelectorAll(".overflow-y-auto")].map(e => e.innerText).join("\n"));
  console.log("   office phone shown:", /📞/.test(t) ? "✅" : "❌");
}

// 3) multi-token search
await page.getByRole("button", { name: "Find Member", exact: true }).first().click();
await page.waitForTimeout(700);
await page.locator('input[placeholder*="Muditha"]').fill("දික්වැල්ල වික්‍රමරත්න");
await page.getByRole("button", { name: "Search", exact: true }).click();
await page.waitForTimeout(4000);
t = await page.evaluate(() => [...document.querySelectorAll(".overflow-y-auto")].map(e => e.innerText).join("\n"));
console.log("3) multi-token search:", /result/.test(t) ? "✅" : "❌", "| names:", (t.match(/දික්වැල්ල/g) || []).length);
const clickable = await page.locator("button").filter({ hasText: /View full details/ }).count();
console.log("   clickable results:", clickable);
if (clickable) {
  await page.locator("button").filter({ hasText: /View full details/ }).first().click();
  await page.waitForTimeout(1200);
  t = await page.evaluate(() => [...document.querySelectorAll(".overflow-y-auto")].map(e => e.innerText).join("\n"));
  console.log("   full details:", /Full details/.test(t) ? "✅" : "❌");
}
console.log("JS errors:", errs.length ? errs[0] : "none ✅");
await page.screenshot({ path: "/home/user/view-panels.png" });
await browser.close();
