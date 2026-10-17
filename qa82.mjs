import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
page.on("dialog", (d) => d.accept());
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
await page.goto(SITE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.locator('button[aria-label="Live chat"]').click();
await page.waitForTimeout(700);
await page.getByRole("button", { name: /Chat live with an officer/ }).first().click().catch(async () => {
  await page.getByRole("button", { name: /Live Chat/ }).first().click();
});
await page.waitForTimeout(1500);
const box = page.locator('input[placeholder="Write your message…"]');
await box.fill("BEFORE CLOSE message");
await box.press("Enter");
await page.waitForTimeout(2500);
let t = await page.evaluate(() => document.body.innerText);
console.log("1) message sent visible:", /BEFORE CLOSE message/.test(t) ? "✅" : "❌");

// End & clear
const endBtn = page.getByRole("button", { name: /End & clear/ });
console.log("2) End & clear button:", (await endBtn.count()) ? "✅" : "❌");
if (await endBtn.count()) {
  await endBtn.first().click({ force: true });
  await page.waitForTimeout(2000);
}
console.log("3) widget closed:", (await page.locator('button[aria-label="Live chat"]').count()) ? "✅" : "❌");

// reopen live tab → old message should NOT appear
await page.locator('button[aria-label="Live chat"]').click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /Live Chat/ }).first().click({ force: true });
await page.waitForTimeout(3500);
t = await page.evaluate(() => document.body.innerText);
console.log("4) old message hidden after reopen:", /BEFORE CLOSE message/.test(t) ? "❌ STILL THERE" : "✅ cleared");
console.log("5) can write again:", (await page.locator('input[placeholder="Write your message…"]').count()) ? "✅" : "❌");
console.log("JS errors:", errs.length ? errs[0] : "none ✅");
await browser.close();
