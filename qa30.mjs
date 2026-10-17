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

// file input → panel-internal upload button (DOM එකෙන්ම)
await page.locator('input[type="file"]').first().setInputFiles("/home/user/coop-web/test-members.csv");
await page.waitForTimeout(1200);
await page.locator('input[type="file"]').first().evaluate((inp) => {
  const panel = inp.closest("div.card") || inp.parentElement.parentElement.parentElement;
  const btn = [...panel.querySelectorAll("button")].find((b) => /Upload & Process File/.test(b.textContent || ""));
  btn && btn.click();
});
// poll REST until rows appear
let n = 0;
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(1500);
  n = await page.evaluate(async ({ ANON }) => {
    const r = await fetch("https://gdablxopbyzyqdyphtib.supabase.co/rest/v1/member_rows?select=id", { headers: { apikey: ANON } });
    return (await r.json()).length;
  }, { ANON });
  if (n >= 4) break;
}
console.log("member_rows count:", n, n >= 4 ? "✅ upload read+added" : "❌");

// directory order + count
await page.goto(`${SITE}/membership/members`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
const body = await page.evaluate(() => document.body.innerText);
const nos = [...body.matchAll(/(\d+\/\d+)\s+[^\n]{3,}/g)].map((m) => m[1]).filter((x) => /^(1|2|10)\//.test(x));
const uniq = [...new Set(nos)].slice(0, 6);
console.log("order seen:", uniq.join(", "));
console.log("ORDER:", uniq[0] === "1/01" && uniq.includes("10/03") ? "✅ 1/01 සිට ස්වාභාවික පිළිවෙල (10/03 මුලින් නෑ)" : "❌");
console.log("badge:", (body.match(/[\d,]+ Members/) || ["?"])[0], body.includes("4 Members") ? "✅" : "❌");
await page.screenshot({ path: "qa30-members.png" });

// cleanup
const cleaned = await page.evaluate(async () => {
  const at = localStorage.getItem("mpcs_at");
  const H = { apikey: "'''PLACEHOLDER'''", Authorization: "Bearer " + at };
  void H;
  return 0;
});
await page.evaluate(async () => {
  const at = localStorage.getItem("mpcs_at");
  const H = { apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYWJseG9wYnl6eXFkeXBodGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjg1ODAsImV4cCI6MjEwNzY0NDU4MH0.uuetb0ZcTs3WDB5Adz7PmgZ-_EN4g_E-lXbOgtBMr5w", Authorization: "Bearer " + at };
  const base = "https://gdablxopbyzyqdyphtib.supabase.co/rest/v1";
  for (const t of ["member_rows", "voter_rows", "data_files"]) await fetch(base + "/" + t + "?id=neq.00000000-0000-0000-0000-000000000000", { method: "DELETE", headers: H });
  const m = await (await fetch(base + "/member_rows?select=id", { headers: { apikey: H.apikey } })).json();
  console.log("cleanup member_rows:", m.length, m.length === 0 ? "✅" : "❌");
});
await browser.close();
