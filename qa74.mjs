import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();

// visitor
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
await p.goto(SITE, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
await p.locator('button[aria-label="Live chat"]').click();
await p.waitForTimeout(900);
const strip = await p.getByRole("button", { name: /Chat live with an officer/ }).count();
console.log("green 'Chat live with an officer' strip:", strip ? "✅" : "❌");
console.log("Live Chat tab:", await p.getByRole("button", { name: /Live Chat/, exact: false }).count() ? "✅" : "❌");
await p.getByRole("button", { name: /Chat live with an officer/ }).click();
await p.waitForTimeout(1800);
console.log("live tab opened:", await p.locator('input[placeholder="Write your message…"]').count() ? "✅" : "❌");
await p.screenshot({ path: "/home/user/view-entry.png" });
console.log("JS errors:", errs.length ? errs[0] : "none ✅");
await p.close();

// admin overview banner
const a = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await a.goto(`${SITE}/signin`, { waitUntil: "domcontentloaded" });
await a.waitForTimeout(1500);
await a.fill('input[name="nic"]', "superadmin@members.mpcs.lk");
await a.fill('input[name="password"]', "Admin@123");
await a.locator('form button[type="submit"]').first().click();
await a.waitForTimeout(5000);
await a.goto(`${SITE}/admin/live-chat`, { waitUntil: "domcontentloaded" });
await a.waitForTimeout(3500);
const t = await a.evaluate(() => document.body.innerText);
console.log("\nadmin banner:", /Live Chats — visitor ලා සමඟ/.test(t) ? "✅" : "❌");
console.log("unread badge on tab:", /Live Chats\s*\d/.test(t) ? "✅" : "—");
await a.screenshot({ path: "/home/user/view-admin-banner.png" });
await browser.close();
