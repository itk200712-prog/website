import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
page.on("console", (m) => { if (m.type() === "error" && !/favicon|404|Failed to load resource/.test(m.text())) errs.push("C:" + m.text().slice(0, 120)); });

await page.goto(`${SITE}/signin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.fill('input[name="nic"]', "superadmin@members.mpcs.lk");
await page.fill('input[name="password"]', "Admin@123");
await page.locator('form button[type="submit"]').first().click();
await page.waitForTimeout(5000);
await page.goto(`${SITE}/admin/live-chat`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
console.log("FAB visible:", await page.evaluate(() => !!document.querySelector('a[href="/admin/live-chat"]')));
await page.getByRole("button", { name: /Live Chats/ }).first().click();
await page.waitForTimeout(3000);
const sessions = await page.evaluate(() => document.body.innerText);
console.log("chat rows:", /Guest visitor|QA visitor|induwara|Hi|QA visitor message/.test(sessions) ? "✅ found" : "❌ none");
console.log("page text sample:", sessions.split("\n").filter(Boolean).slice(0, 14).join(" | "));
// click first session
const row = page.locator("button").filter({ hasText: /WAITING|JOINED|CLOSED/ }).first();
console.log("session button count:", await page.locator("button").filter({ hasText: /WAITING|JOINED|CLOSED/ }).count());
if (await row.count()) { await row.click(); await page.waitForTimeout(2500); }
const replyBox = page.locator('input[placeholder="Reply to the visitor…"]');
console.log("reply composer:", await replyBox.count() ? "✅" : "❌");
if (await replyBox.count()) {
  await replyBox.fill("Admin reply test");
  await replyBox.press("Enter");
  await page.waitForTimeout(3000);
  const t = await page.evaluate(() => document.body.innerText);
  console.log("reply visible:", /Admin reply test/.test(t) ? "✅" : "❌");
}
await page.screenshot({ path: "/home/user/view-admin-chat.png" });
console.log("JS errors:", errs.length ? errs[0] : "none ✅");
await browser.close();
