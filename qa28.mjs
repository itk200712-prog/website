import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE ERR:", m.text().slice(0, 200)); });
page.on("pageerror", (e) => console.log("PAGE ERR:", String(e).slice(0, 200)));
await page.goto(`${SITE}/signin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.fill('input[name="nic"]', "superadmin@members.mpcs.lk");
await page.fill('input[name="password"]', "Admin@123");
await page.locator('form button[type="submit"]').first().click();
await page.waitForTimeout(5000);
await page.goto(`${SITE}/admin/data`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
const inputs = await page.locator('input[type="file"]').count();
console.log("file inputs:", inputs);
// file chosen labels on each panel
await page.locator('input[type="file"]').first().setInputFiles("/home/user/coop-web/test-members.csv");
await page.waitForTimeout(800);
const before = await page.evaluate(() => document.body.innerText.match(/test-members|test-voters/g));
console.log("chosen labels:", JSON.stringify(before));
await page.locator('button:has-text("Upload & Process File")').first().click();
for (const t of [2000, 4000]) {
  await page.waitForTimeout(t);
  const txt = await page.evaluate(() => {
    const els = [...document.querySelectorAll("div")].map(d => d.innerText || "").filter(x => x.length < 220 && x.length > 4 && (/✅|⚠|added|Uploaded|rows|හිස්|Upload/.test(x)));
    return els.slice(-3).join(" || ");
  });
  console.log("toast@" + t + ":", txt.slice(0, 300));
}
const chk = await page.evaluate(async () => {
  const at = localStorage.getItem("mpcs_at");
  const H = { apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYWJseG9wYnl6eXFkeXBodGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjg1ODAsImV4cCI6MjEwNzY0NDU4MH0.uuetb0ZcTs3WDB5Adz7PmgZ-_EN4g_E-lXbOgtBMr5w", Authorization: "Bearer " + at };
  const base = "https://gdablxopbyzyqdyphtib.supabase.co/rest/v1";
  const m = await (await fetch(base + "/member_rows?select=member_no", { headers: { apikey: H.apikey } })).json();
  return m;
});
console.log("member_rows:", JSON.stringify(chk).slice(0, 300));
await page.screenshot({ path: "qa28.png", fullPage: false });
await browser.close();
