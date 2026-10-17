import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();

// visitor
const p = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
p.on("console", (m) => { if (m.type() === "error" && !/favicon|404|Failed to load resource/.test(m.text())) errs.push("C:" + m.text().slice(0, 110)); });
await p.goto(SITE, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
await p.locator('button[aria-label="Live chat"]').click();
await p.waitForTimeout(900);
const tabs = await p.evaluate(() => [...document.querySelectorAll("button")].map(b => b.innerText.trim()).filter(Boolean).slice(0, 22));
console.log("tabs present:", /Live Agent/.test(tabs.join("|")) ? "✅" : "❌", "| tabs:", tabs.filter(t => /Assistant|Live Agent|Message/.test(t)).join(" / "));
await p.getByRole("button", { name: /Live Agent/ }).first().click();
await p.waitForTimeout(2500);
const b = await p.evaluate(() => document.body.innerText);
console.log("visitor live pane:", /Waiting for an officer to join/i.test(b) ? "✅ status" : "❌");
console.log("composer:", (await p.locator('input[placeholder="Write your message…"]').count()) ? "✅" : "❌");
await p.screenshot({ path: "/home/user/view-live-visitor.png" });
console.log("visitor JS errors:", errs.length ? errs[0] : "none ✅");
await p.close();

// admin
const a = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await a.goto(`${SITE}/signin`, { waitUntil: "domcontentloaded" });
await a.waitForTimeout(1500);
await a.fill('input[name="nic"]', "superadmin@members.mpcs.lk");
await a.fill('input[name="password"]', "Admin@123");
await a.locator('form button[type="submit"]').first().click();
await a.waitForTimeout(5000);
const aerrs = [];
a.on("pageerror", (e) => aerrs.push(String(e).slice(0, 110)));
await a.goto(`${SITE}/admin/live-chat`, { waitUntil: "domcontentloaded" });
await a.waitForTimeout(3000);
await a.getByRole("button", { name: /Live Chats/ }).first().click();
await a.waitForTimeout(2500);
const ab = await a.evaluate(() => document.body.innerText);
console.log("\nadmin live chats tab:", /Live Chats/.test(ab) ? "✅" : "❌", "| empty state:", /live chats නෑ|Chat එකක් තෝරන්න/.test(ab) ? "✅" : "—");
console.log("admin JS errors:", aerrs.length ? aerrs[0] : "none ✅");
await a.screenshot({ path: "/home/user/view-live-admin.png" });
await browser.close();
