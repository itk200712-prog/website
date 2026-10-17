import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();

// ── Sinhala chat ──
const p1 = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs1 = [];
p1.on("pageerror", (e) => errs1.push(String(e).slice(0, 100)));
await p1.goto(`${SITE}/si`, { waitUntil: "domcontentloaded" });
await p1.waitForTimeout(3000);
await p1.locator('button[aria-label="Live chat"]').click();
await p1.waitForTimeout(1200);
const sinBtns = await p1.getByRole("button", { name: /සාමාජික සොයන්න/ }).count();
console.log("si buttons:", sinBtns ? "✅" : "❌");
await p1.getByRole("button", { name: /සාමාජික සොයන්න/ }).first().click();
await p1.waitForTimeout(600);
await p1.locator('input[placeholder*="මුදිත"]').fill("41/01");
await p1.getByRole("button", { name: "සොයන්න", exact: true }).click();
await p1.waitForTimeout(3500);
const siBody = await p1.evaluate(() => document.querySelector(".overflow-y-auto")?.innerText || "");
console.log("si search:", /ප්‍රතිඵල|සාමාජික/.test(siBody) ? "✅" : "❌", "| 41/01 row:", /41\/01/.test(siBody) ? "✅" : "❌");
const allActions = await p1.evaluate(() => document.querySelectorAll(".flex.flex-wrap.gap-1\\.5 > button").length);
console.log("visible action buttons:", allActions || "?");
console.log("si JS errors:", errs1.length ? errs1[0] : "none ✅");
await p1.screenshot({ path: "/home/user/view-chat-si.png" });
await p1.close();

// ── admin live chat page ──
const p2 = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await p2.goto(`${SITE}/signin`, { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(1500);
await p2.fill('input[name="nic"]', "superadmin@members.mpcs.lk");
await p2.fill('input[name="password"]', "Admin@123");
await p2.locator('form button[type="submit"]').first().click();
await p2.waitForTimeout(5000);
const errs2 = [];
p2.on("pageerror", (e) => errs2.push(String(e).slice(0, 100)));
const r = await p2.goto(`${SITE}/admin/live-chat`, { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(4000);
const pb = await p2.evaluate(() => document.body.innerText);
console.log("\nadmin /admin/live-chat:", r.status(), "|",
  /Live Chat contact email/.test(pb) ? "email setting ✅" : "email setting ❌", "|",
  /Contact requests/.test(pb) ? "requests ✅" : "requests ❌", "|",
  /QA Livechat/.test(pb) ? "QA row visible ✅" : "QA row —", "|",
  /§20/.test(pb) ? "SQL banner ✅" : "no banner");
console.log("admin JS errors:", errs2.length ? errs2[0] : "none ✅");
await p2.screenshot({ path: "/home/user/view-admin-livechat.png" });
await browser.close();
