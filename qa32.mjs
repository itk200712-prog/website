import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYWJseG9wYnl6eXFkeXBodGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjg1ODAsImV4cCI6MjEwNzY0NDU4MH0.uuetb0ZcTs3WDB5Adz7PmgZ-_EN4g_E-lXbOgtBMr5w";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.goto(`${SITE}/signin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.fill('input[name="nic"]', "superadmin@members.mpcs.lk");
await page.fill('input[name="password"]', "Admin@123");
await page.locator('form button[type="submit"]').first().click();
await page.waitForTimeout(5000);
// seed realistic sample rows for the screenshot
await page.evaluate(async () => {
  const at = localStorage.getItem("mpcs_at");
  const H = { apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYWJseG9wYnl6eXFkeXBodGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjg1ODAsImV4cCI6MjEwNzY0NDU4MH0.uuetb0ZcTs3WDB5Adz7PmgZ-_EN4g_E-lXbOgtBMr5w", Authorization: "Bearer " + at, "Content-Type": "application/json" };
  const base = "https://gdablxopbyzyqdyphtib.supabase.co/rest/v1";
  const rows = [
    ["01/01", "0000000000", "ඩී.ආර්.නිමල්", "පල්ලන්තොට", "බණ්ඩාරකොස්වත්ත", "ස්ත්‍රිය"],
    ["01/03", "0000000000", "ආර්.පී.කුමාර්", "පල්ලන්තොට", "පල්ලන්තොට", "පුරුෂ"],
    ["01/05", "0000000000", "එච්.ඩී.සමන් පෙරේරා", "මුල්ලේගම", "මුල්ලේගම", "පුරුෂ"],
    ["01/08", "0000000000", "කේ.ආර්.ජයලතා කුමාරි", "බිංබිල්ල අභයපුරමුල්ල", "බිංබිල්ල", "ස්ත්‍රිය"],
    ["01/11", "0000000000", "ඩී.ආර්.හේමන්ත", "කුලුගමුව", "කුලුගමුව", "පුරුෂ"],
  ].map((r) => ({ member_no: r[0], nic: r[1], full_name: r[2], address: r[3], postal_address: r[4], gender: r[5], file_name: "01" }));
  await fetch(base + "/member_rows", { method: "POST", headers: H, body: JSON.stringify(rows) });
  await fetch(base + "/data_files", { method: "POST", headers: H, body: JSON.stringify({ kind: "member", file_name: "01", rows: 5 }) });
});
await page.goto(`${SITE}/membership/members`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5500);
const body = await page.evaluate(() => document.body.innerText);
console.log("header badge:", body.includes("5 Members") ? "✅" : "❌");
console.log("meta line:", /Showing 1/.test(body) ? "✅" : "❌");
console.log("rows:", body.includes("01/01") ? "✅" : "❌");
await page.screenshot({ path: "qa32-top.png", clip: { x: 0, y: 0, width: 1440, height: 620 } });
await page.screenshot({ path: "qa32-bottom.png", clip: { x: 0, y: 560, width: 1440, height: 540 } });
// popup design check
await page.locator("tr.group").nth(1).click();
await page.waitForTimeout(800);
await page.screenshot({ path: "qa32-popup.png" });
console.log("popup:", (await page.evaluate(() => document.body.innerText)).includes("POSTAL ADDRESS") ? "✅" : "❌");
// cleanup
await page.evaluate(async () => {
  const at = localStorage.getItem("mpcs_at");
  const H = { apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYWJseG9wYnl6eXFkeXBodGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjg1ODAsImV4cCI6MjEwNzY0NDU4MH0.uuetb0ZcTs3WDB5Adz7PmgZ-_EN4g_E-lXbOgtBMr5w", Authorization: "Bearer " + at };
  const base = "https://gdablxopbyzyqdyphtib.supabase.co/rest/v1";
  for (const t of ["member_rows", "voter_rows", "data_files"]) await fetch(base + "/" + t + "?id=neq.00000000-0000-0000-0000-000000000000", { method: "DELETE", headers: H });
});
console.log("cleanup done");
await browser.close();
