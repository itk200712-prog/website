import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYWJseG9wYnl6eXFkeXBodGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjg1ODAsImV4cCI6MjEwNzY0NDU4MH0.uuetb0ZcTs3WDB5Adz7PmgZ-_EN4g_E-lXbOgtBMr5w";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${SITE}/signin`, { waitUntil: "domcontentloaded" });
await page.fill('input[name="nic"]', "superadmin@members.mpcs.lk");
await page.fill('input[name="password"]', "Admin@123");
await page.locator('form button[type="submit"]').first().click();
await page.waitForTimeout(5000);

// 1) empty state (demo rows නෑ)
await page.goto(`${SITE}/membership/members`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
let body = await page.evaluate(() => document.body.innerText);
console.log("empty state:", body.includes("No uploaded data yet") || body.includes("upload Excel") ? "✅ no demo rows" : "❌ still demo: " + (body.match(/All Files \([\d,]+\)/) || ["?"])[0]);

// 2) upload members (shuffled) via UI
await page.goto(`${SITE}/admin/data`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
await page.locator('input[type="file"]').first().setInputFiles("/home/user/coop-web/test-members.csv");
await page.waitForTimeout(700);
await page.locator('button:has-text("Upload & Process File")').first().click();
await page.waitForTimeout(8000);
// voters
await page.locator('input[type="file"]').nth(1).setInputFiles("/home/user/coop-web/test-voters.csv");
await page.waitForTimeout(700);
await page.locator('button:has-text("Upload & Process File")').nth(1).click();
await page.waitForTimeout(8000);

// 3) directory: order 1/01 සිට + counts
await page.goto(`${SITE}/membership/members`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
body = await page.evaluate(() => document.body.innerText);
const nos = [...body.matchAll(/^\s*\d+\s+(\d+\/\d+)\s/gm)].map(m => m[1]);
console.log("member order:", nos.join(", ") || "(parse fail)");
console.log("ORDER OK:", nos[0] === "1/01" && nos.join(",") === "1/01,1/02,2/10,10/03" ? "✅ 1/01 සිට පිළිවෙලට" : "❌ " + nos.join(","));
console.log("member count badge:", body.includes("4 Members") ? "✅ 4" : "❌ " + (body.match(/[\d,]+ Members/) || ["?"])[0]);

await page.goto(`${SITE}/membership/voters`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
body = await page.evaluate(() => document.body.innerText);
console.log("voter rows:", body.includes("33/01") && body.includes("33/02") ? "✅ 33/02, 33/01 shown" : "❌");
console.log("voter count:", body.includes("2 Voters") ? "✅ 2" : "❌ " + (body.match(/[\d,]+ Voters/) || ["?"])[0]);

// 4) home stats
await page.goto(SITE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
const stats = await page.evaluate(() => document.body.innerText.match(/\b\d+\+?\b/g)?.slice(0, 8).join(", "));
console.log("home stats:", stats);
await page.screenshot({ path: "qa27-home.png", clip: { x: 0, y: 130, width: 1440, height: 280 } });

// 5) cleanup test rows
const cleaned = await page.evaluate(async () => {
  const at = localStorage.getItem("mpcs_at");
  const H = { apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYWJseG9wYnl6eXFkeXBodGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjg1ODAsImV4cCI6MjEwNzY0NDU4MH0.uuetb0ZcTs3WDB5Adz7PmgZ-_EN4g_E-lXbOgtBMr5w", Authorization: "Bearer " + at };
  const base = "https://gdablxopbyzyqdyphtib.supabase.co/rest/v1";
  for (const t of ["member_rows", "voter_rows"]) await fetch(base + "/" + t + "?id=neq.00000000-0000-0000-0000-000000000000", { method: "DELETE", headers: H });
  await fetch(base + "/data_files?id=neq.00000000-0000-0000-0000-000000000000", { method: "DELETE", headers: H });
  const m = await fetch(base + "/member_rows?select=id", { headers: { apikey: H.apikey } });
  const v = await fetch(base + "/voter_rows?select=id", { headers: { apikey: H.apikey } });
  return { m: (await m.json()).length, v: (await v.json()).length };
});
console.log("cleanup:", JSON.stringify(cleaned), "(0/0 expected)");
await browser.close();
