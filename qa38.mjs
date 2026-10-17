import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${SITE}/signin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.fill('input[name="nic"]', "superadmin@members.mpcs.lk");
await page.fill('input[name="password"]', "Admin@123");
await page.locator('form button[type="submit"]').first().click();
await page.waitForTimeout(5000);
// news insert — correct columns
const st = await page.evaluate(async () => {
  const at = localStorage.getItem("mpcs_at");
  const H = { apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYWJseG9wYnl6eXFkeXBodGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjg1ODAsImV4cCI6MjEwNzY0NDU4MH0.uuetb0ZcTs3WDB5Adz7PmgZ-_EN4g_E-lXbOgtBMr5w", Authorization: "Bearer " + at, "Content-Type": "application/json" };
  const r = await fetch("https://gdablxopbyzyqdyphtib.supabase.co/rest/v1/news", { method: "POST", headers: H, body: JSON.stringify({ id: "qa-instant-" + Date.now(), category: "notice", title_en: "QA-INSTANT-NEWS-TEST", title_si: "QA-INSTANT-NEWS-TEST", desc_en: "t", desc_si: "t", published: true }) });
  return r.status;
});
console.log("news insert:", st);
await page.goto(SITE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
const body = await page.evaluate(() => document.body.innerText);
console.log("INSTANT news on home:", body.includes("QA-INSTANT-NEWS-TEST") ? "✅✅ issaraha pennanawa!" : "❌");
await page.evaluate(async () => {
  const at = localStorage.getItem("mpcs_at");
  const H = { apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYWJseG9wYnl6eXFkeXBodGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjg1ODAsImV4cCI6MjEwNzY0NDU4MH0.uuetb0ZcTs3WDB5Adz7PmgZ-_EN4g_E-lXbOgtBMr5w", Authorization: "Bearer " + at };
  await fetch("https://gdablxopbyzyqdyphtib.supabase.co/rest/v1/news?title_en=eq.QA-INSTANT-NEWS-TEST", { method: "DELETE", headers: H });
});
console.log("cleaned");
await browser.close();
