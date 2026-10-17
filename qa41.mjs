import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(`${SITE}/signin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.fill('input[name="nic"]', "superadmin@members.mpcs.lk");
await page.fill('input[name="password"]', "Admin@123");
await page.locator('form button[type="submit"]').first().click();
await page.waitForTimeout(5000);
await page.goto(`${SITE}/admin/settings`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
const body = await page.evaluate(() => document.body.innerText);
console.log("Site Logo section:", body.includes("Site Logo (Header / Footer") ? "✅" : "❌");
console.log("logo upload button:", body.includes("Logo Upload කරන්න") ? "✅" : "❌");
console.log("logo tip:", body.includes("500×500") ? "✅" : "❌");
const fi = await page.evaluate(() => document.querySelectorAll('input[type="file"][accept="image/*"]').length);
console.log("image file inputs:", fi, fi >= 2 ? "✅ (logo + hero)" : "❌");
await page.screenshot({ path: "qa41-logo.png", clip: { x: 0, y: 0, width: 1440, height: 1000 } });
// header logo ball — let's check it renders coop fallback properly
const ball = await page.evaluate(() => {
  const el = document.querySelector("header .rounded-full");
  return el ? el.innerText.trim() : "none";
});
console.log("header ball content:", JSON.stringify(ball), ball === "coop" || ball === "" ? "✅ (fallback/img)" : "⚠");
await browser.close();
