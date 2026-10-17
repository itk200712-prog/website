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
await page.goto(`${SITE}/si`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
const chip = await page.evaluate(() => {
  const b = [...document.querySelectorAll("header button")].find((x) => x.innerText && x.innerText.trim().length > 1 && x.querySelector("img, span.rounded-full"));
  return b ? { text: b.innerText.replace(/\n/g, " | "), hasMember: /MEMBER|සාමාජික/.test(b.innerText) } : null;
});
console.log("user chip:", JSON.stringify(chip), chip && !chip.hasMember ? "✅ MEMBER label removed" : "❌");
await page.screenshot({ path: "qa46-chip.png", clip: { x: 900, y: 0, width: 540, height: 90 } });
await browser.close();
