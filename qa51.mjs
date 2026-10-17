import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();
// guest header
const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(`${SITE}/en`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3500);
await p.screenshot({ path: "qa51-guest.png", clip: { x: 0, y: 0, width: 1440, height: 76 } });
// superadmin header
const a = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await a.goto(`${SITE}/signin`, { waitUntil: "domcontentloaded" });
await a.waitForTimeout(1500);
await a.fill('input[name="nic"]', "superadmin@members.mpcs.lk");
await a.fill('input[name="password"]', "Admin@123");
await a.locator('form button[type="submit"]').first().click();
await a.waitForTimeout(5500);
await a.goto(`${SITE}/en`, { waitUntil: "domcontentloaded" });
await a.waitForTimeout(3500);
await a.screenshot({ path: "qa51-admin.png", clip: { x: 0, y: 0, width: 1440, height: 76 } });
const m = await a.evaluate(() => ({
  h: Math.round(document.querySelector("header").getBoundingClientRect().height),
}));
console.log("superadmin header height:", m.h, m.h <= 74 ? "✅" : "❌");
await browser.close();
