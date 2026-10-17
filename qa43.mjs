import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
// admin login
await page.goto(`${SITE}/signin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.fill('input[name="nic"]', "superadmin@members.mpcs.lk");
await page.fill('input[name="password"]', "Admin@123");
await page.locator('form button[type="submit"]').first().click();
await page.waitForTimeout(5000);
await page.goto(`${SITE}/admin/settings`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
const body = await page.evaluate(() => document.body.innerText);
console.log("Board BG setting section:", body.includes("Board Section Background Image") ? "✅" : "❌");
console.log("upload button:", body.includes("Background Image Upload") ? "✅" : "❌");
// QA: hero image 1 එකින් board_bg set කරමු
const set = await page.evaluate(async () => {
  const at = localStorage.getItem("mpcs_at");
  const H = { apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYWJseG9wYnl6eXFkeXBodGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjg1ODAsImV4cCI6MjEwNzY0NDU4MH0.uuetb0ZcTs3WDB5Adz7PmgZ-_EN4g_E-lXbOgtBMr5w", Authorization: "Bearer " + at, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" };
  const r = await fetch("https://gdablxopbyzyqdyphtib.supabase.co/rest/v1/system_settings", { method: "POST", headers: H, body: JSON.stringify({ key: "board_bg", value: "/images/hero/hero-2.jpg" }) });
  return r.status;
});
console.log("board_bg test set:", set);
await page.waitForTimeout(800);
await page.goto(`${SITE}/en`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
const check = await page.evaluate(() => {
  const secs = [...document.querySelectorAll("section")];
  const s = secs.find((x) => x.style && x.style.backgroundImage && x.style.backgroundImage.includes("hero-2"));
  return s ? { found: true, hasOverlay: !!s.querySelector(".bg-gradient-to-b.from-slate-950\\/82"), cards: s.querySelectorAll("button.group").length } : { found: false };
});
console.log("board section bg:", JSON.stringify(check), check.found ? "✅ image + overlay applied" : "❌");
// screenshot board area
const y = await page.evaluate(() => {
  const h2 = [...document.querySelectorAll("h2")].find((x) => /Board of Directors/i.test(x.textContent || ""));
  return h2 ? h2.getBoundingClientRect().top + window.scrollY - 60 : 0;
});
await page.evaluate((yy) => window.scrollTo(0, yy), y);
await page.waitForTimeout(1200);
await page.screenshot({ path: "qa43-board.png", clip: { x: 0, y: 0, width: 1440, height: 900 } });
await browser.close();
