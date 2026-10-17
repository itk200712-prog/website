import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYWJseG9wYnl6eXFkeXBodGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjg1ODAsImV4cCI6MjEwNzY0NDU4MH0.uuetb0ZcTs3WDB5Adz7PmgZ-_EN4g_E-lXbOgtBMr5w";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${SITE}/signin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.fill('input[name="nic"]', "superadmin@members.mpcs.lk");
await page.fill('input[name="password"]', "Admin@123");
await page.locator('form button[type="submit"]').first().click();
await page.waitForTimeout(5000);
await page.goto(`${SITE}/admin/data`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);

// REAL binary .xlsx upload (title row + Sinhala sheet)
await page.locator('input[type="file"]').first().setInputFiles("/home/user/coop-web/test-real.xlsx");
await page.waitForTimeout(1200);
await page.locator('input[type="file"]').first().evaluate((inp) => {
  const panel = inp.closest("div.card") || inp.parentElement.parentElement.parentElement;
  const btn = [...panel.querySelectorAll("button")].find((b) => /Upload & Process File/.test(b.textContent || ""));
  btn && btn.click();
});
let n = 0;
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(1500);
  n = await page.evaluate(async ({ ANON }) => {
    const r = await fetch("https://gdablxopbyzyqdyphtib.supabase.co/rest/v1/member_rows?select=member_no,full_name,postal_address", { headers: { apikey: ANON } });
    return await r.json();
  }, { ANON });
  if (n.length >= 4) break;
}
console.log("XLSX upload rows:", n.length, n.length === 4 ? "✅ 4/4 (title row නෑ!)" : "❌");
console.log("sample:", JSON.stringify(n[0] || {}));
console.log("title junk row?:", n.some((r) => (r.member_no || "").includes("කාරක")) ? "❌ JUNK!" : "✅ title row filtered");

// members page: postal column + details popup
await page.goto(`${SITE}/membership/members`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
let body = await page.evaluate(() => document.body.innerText);
console.log("POSTAL column:", body.includes("Postal Address") ? "✅" : "❌");
console.log("rows visible:", body.includes("41/01") && body.includes("චමින්ද") ? "✅" : "❌");
// row click → popup
await page.locator("tr.cursor-pointer").first().click();
await page.waitForTimeout(900);
body = await page.evaluate(() => document.body.innerText);
const popup = body.includes("Full Name") && body.includes("Postal Address") && body.includes("File") && (body.includes("41/01") || body.includes("Member No"));
console.log("DETAILS POPUP:", popup ? "✅ full details show" : "❌");
await page.screenshot({ path: "qa31-popup.png" });

// cleanup
await page.evaluate(async () => {
  const at = localStorage.getItem("mpcs_at");
  const H = { apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYWJseG9wYnl6eXFkeXBodGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjg1ODAsImV4cCI6MjEwNzY0NDU4MH0.uuetb0ZcTs3WDB5Adz7PmgZ-_EN4g_E-lXbOgtBMr5w", Authorization: "Bearer " + at };
  const base = "https://gdablxopbyzyqdyphtib.supabase.co/rest/v1";
  for (const t of ["member_rows", "voter_rows", "data_files"]) await fetch(base + "/" + t + "?id=neq.00000000-0000-0000-0000-000000000000", { method: "DELETE", headers: H });
});
console.log("cleanup done");
await browser.close();
