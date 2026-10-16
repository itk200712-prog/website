import { chromium } from "playwright-core";
const BASE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
// login
await page.goto(BASE + "/signin", { waitUntil: "networkidle" });
await page.fill('input[name="nic"], input[type="text"]', "SUPERADMIN");
await page.fill('input[type="password"]', "Admin@123");
await page.click('button[type="submit"]');
await page.waitForTimeout(3500);
console.log("after login URL:", page.url());
// administrators
await page.goto(BASE + "/en/admin/administrators", { waitUntil: "networkidle" }).catch(async () => {
  await page.goto(BASE + "/admin/administrators", { waitUntil: "networkidle" });
});
await page.waitForTimeout(1500);
await page.screenshot({ path: "/home/user/qa/admin-list.png" });
// click first delete (trash) button
const dels = page.locator('button:has(svg)').filter({ has: page.locator('[class*="red"], .lucide-trash, .lucide-trash2') });
const btns = await page.locator('button').all();
let clicked = false;
for (const b of btns) {
  const cls = await b.getAttribute("class");
  if (cls && cls.includes("hover:text-red-600")) {
    await b.click(); clicked = true; break;
  }
}
console.log("delete clicked:", clicked);
await page.waitForTimeout(2500);
await page.screenshot({ path: "/home/user/qa/admin-delete.png" });
const body = await page.textContent("body");
const m = body.match(/(✅|⚠)[^\n]{0,120}/g);
console.log("toasts:", m ? m.slice(0, 3) : "none");
await browser.close();
