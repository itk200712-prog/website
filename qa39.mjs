import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${SITE}/signin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.fill('input[name="nic"]', "superadmin@members.mpcs.lk");
await page.fill('input[name="password"]', "Admin@123");
await page.locator('form button[type="submit"]').first().click();
await page.waitForTimeout(5500);
await page.goto(`${SITE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
const body = await page.evaluate(() => document.body.innerText);
console.log("dashboard avatar button:", body.includes("Photo එකක් දාන්න") ? "✅" : "❌");
console.log("profile card name:", body.includes("My Profile") ? "✅" : "❌");
const hasFileInput = await page.evaluate(() => document.querySelectorAll('input[type="file"][accept="image/*"]').length);
console.log("image file inputs:", hasFileInput, hasFileInput >= 1 ? "✅" : "❌");
// header name still correct (fallback)
const hdr = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent && /Member|සාමාජික/.test(x.textContent) && x.querySelector("span"));
  return b ? b.innerText.replace(/\n/g, "|") : "none";
});
console.log("header user chip:", JSON.stringify(hdr), hdr !== "none" && !hdr.includes("@") ? "✅ name OK (fallback)" : "⚠");
await page.screenshot({ path: "qa39-dash.png", clip: { x: 0, y: 0, width: 1440, height: 900 } });
await browser.close();
