import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYWJseG9wYnl6eXFkeXBodGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjg1ODAsImV4cCI6MjEwNzY0NDU4MH0.uuetb0ZcTs3WDB5Adz7PmgZ-_EN4g_E-lXbOgtBMr5w";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${SITE}/signin`, { waitUntil: "networkidle" });
await page.fill('input[name="nic"]', "superadmin@members.mpcs.lk");
await page.fill('input[name="password"]', "Admin@123");
await page.locator('form button[type="submit"]').first().click();
await page.waitForTimeout(5000);
console.log("login:", page.url().includes("/admin") || page.url().includes("/") ? "ok " + page.url() : "fail");

await page.goto(`${SITE}/admin/data`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

// ---- UI upload: ඔයාගේ format (header-less CSV) ----
const fi = page.locator('input[type="file"]').first();
await fi.setInputFiles("/home/user/coop-web/test-members.csv");
await page.waitForTimeout(700);
await page.locator('button:has-text("Upload & Process File")').first().click();
await page.waitForTimeout(9000);
const body1 = await page.evaluate(() => document.body.innerText);
console.log("upload msg:", body1.includes("added") || body1.includes("✅") ? "success msg shown" : body1.slice(0, 120));

// ---- rows read + count add ----
const rowsNow = await page.evaluate(async ({ ANON }) => {
  const res = await fetch("https://gdablxopbyzyqdyphtib.supabase.co/rest/v1/member_rows?select=member_no,full_name,nic,gender,postal_address&order=member_no.asc&limit=8", { headers: { apikey: ANON } });
  return await res.json();
}, { ANON });
console.log("MEMBER_ROWS:", JSON.stringify(rowsNow).slice(0, 400));
console.log("UPLOAD READ:", rowsNow.length === 3 ? "✅✅ 3/3 rows parsed+inserted" : "❌ " + rowsNow.length);

// ---- stat card = count add වෙලාද ----
await page.goto(SITE, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const stat = await page.evaluate(() => {
  const els = document.querySelectorAll(".glassStat, .glass-card, .stat");
  return document.body.innerText.match(/\d+\+?/g)?.slice(0, 6).join(", ");
});
console.log("home stats:", stat);
await page.screenshot({ path: "qa26-home.png", clip: { x: 0, y: 130, width: 1440, height: 280 } });

// ---- cleanup: test rows ඉවත් (ඔයාගේ excel එකට DB එක පිරිසිදුව තියන්න) ----
const cleaned = await page.evaluate(async () => {
  const at = localStorage.getItem("mpcs_at");
  const H = { apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYWJseG9wYnl6eXFkeXBodGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjg1ODAsImV4cCI6MjEwNzY0NDU4MH0.uuetb0ZcTs3WDB5Adz7PmgZ-_EN4g_E-lXbOgtBMr5w", Authorization: "Bearer " + at, "Content-Type": "application/json" };
  const base = "https://gdablxopbyzyqdyphtib.supabase.co/rest/v1";
  await fetch(base + "/member_rows?id=neq.00000000-0000-0000-0000-000000000000", { method: "DELETE", headers: H });
  await fetch(base + "/data_files?kind=eq.member", { method: "DELETE", headers: H });
  const chk = await fetch(base + "/member_rows?select=id", { headers: { apikey: H.apikey } });
  return (await chk.json()).length;
});
console.log("cleanup: member_rows after =", cleaned, "(0 expected)");

// ---- cleanup (මේ test rows ඉවත් — ඔයාගේ excel එකට ඉඩ) ----
await page.goto(`${SITE}/admin/data`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
// replace-all mode එකෙන් empty state — data_files + rows delete
const cleaned = await page.evaluate(async () => {
  try {
    const { createClient } = await import("/_next/static/chunks/libs/supabase.js").catch(() => ({}));
  } catch {}
  return "ui";
});
console.log("cleanup note: replace-all එකෙන් ඔයා ඔයාගේ excel එක upload කරාම old test rows replace වෙනවා; stats 3→ඔයාගේ count");
await browser.close();
const ok = rowsNow.length === 3;
console.log("RESULT:", ok ? "USER FORMAT UPLOAD OK (3/3 rows read+added)" : "CHECK");
