import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYWJseG9wYnl6eXFkeXBodGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjg1ODAsImV4cCI6MjEwNzY0NDU4MH0.uuetb0ZcTs3WDB5Adz7PmgZ-_EN4g_E-lXbOgtBMr5w";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => console.log("CONSOLE[" + m.type() + "]:", m.text().slice(0, 220)));
page.on("pageerror", (e) => console.log("PAGEERR:", String(e).slice(0, 300)));
// insert 4 member rows via anon? RLS needs admin — use signin session first
await page.goto(`${SITE}/signin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.fill('input[name="nic"]', "superadmin@members.mpcs.lk");
await page.fill('input[name="password"]', "Admin@123");
await page.locator('form button[type="submit"]').first().click();
await page.waitForTimeout(5000);
const inserted = await page.evaluate(async () => {
  const at = localStorage.getItem("mpcs_at");
  const H = { apikey: "''' + ANON2 + '''", Authorization: "Bearer " + at, "Content-Type": "application/json", Prefer: "return=representation" };
  const base = "https://gdablxopbyzyqdyphtib.supabase.co/rest/v1";
  await fetch(base + "/member_rows?file_name=eq.QA29", { method: "DELETE", headers: H });
  const rows = ["1/01", "1/02", "2/10", "10/03"].map((no, i) => ({ member_no: no, nic: "000000000" + i, full_name: "QA " + no, address: "A", postal_address: "P", gender: "පුරුෂ", file_name: "QA29" }));
  const r = await fetch(base + "/member_rows", { method: "POST", headers: H, body: JSON.stringify(rows) });
  const chk = await (await fetch(base + "/member_rows?select=member_no", { headers: { apikey: H.apikey } })).json();
  return { status: r.status, chk };
});
console.log("insert:", JSON.stringify(inserted).slice(0, 260));
await page.goto(`${SITE}/membership/members`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);
const state = await page.evaluate(() => {
  const body = document.body.innerText;
  return {
    badge: (body.match(/[\d,]+ Members/) || ["none"])[0],
    allFiles: (body.match(/All Files \([\d,]+\)/) || ["none"])[0],
    firstRows: body.split("\n").filter((l) => /^\s*\d+\s+\d+\/\d+/.test(l)).slice(0, 5),
    emptyMsg: body.includes("No uploaded data yet") ? "EMPTY-MSG" : body.includes("Loading data") ? "LOADING" : "ROWS?",
  };
});
console.log("MEMBERS PAGE STATE:", JSON.stringify(state, null, 1).slice(0, 500));
// direct REST from same page
const rest = await page.evaluate(async ({ ANON }) => {
  const r = await fetch("https://gdablxopbyzyqdyphtib.supabase.co/rest/v1/member_rows?select=member_no&limit=10", { headers: { apikey: ANON } });
  return { status: r.status, body: await r.text() };
}, { ANON });
console.log("REST from page:", rest.status, rest.body.slice(0, 200));
await page.screenshot({ path: "qa29.png" });
await browser.close();
