import { chromium } from "playwright-core";
const BASE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
await page.goto(BASE + "/signin", { waitUntil: "networkidle" });
await page.fill('input[name="nic"], input[type="text"]', "SUPERADMIN");
await page.fill('input[type="password"]', "Admin@123");
await page.click('button[type="submit"]');
await page.waitForTimeout(4000);
await page.goto(BASE + "/en/admin/members", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const body = await page.textContent("body");
console.log("MILIYA before:", body.includes("MILIYA"), "| kasun before:", body.includes("kasun"));
// delete MILIYA: find the row with MILIYA and click its trash
const rows = await page.locator("tr").all();
for (const tr of rows) {
  const t = await tr.textContent();
  if (t && t.includes("MILIYA")) {
    const btn = tr.locator("button").last();
    await btn.click();
    break;
  }
}
await page.waitForTimeout(3000);
const body2 = await page.textContent("body");
const m = body2.match(/(✅|⚠)[^\n]{0,100}/g);
console.log("toasts:", m ? m.slice(0, 2) : "none");
console.log("MILIYA after:", body2.includes("MILIYA"), "| kasun still:", body2.includes("kasun"));
await page.screenshot({ path: "/home/user/qa/members-delete.png" });
await browser.close();
