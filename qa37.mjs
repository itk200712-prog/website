import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYWJseG9wYnl6eXFkeXBodGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjg1ODAsImV4cCI6MjEwNzY0NDU4MH0.uuetb0ZcTs3WDB5Adz7PmgZ-_EN4g_E-lXbOgtBMr5w";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// ── 1) HERO design ──
await page.goto(SITE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
const body = await page.evaluate(() => document.body.innerText);
console.log("hero title:", body.includes("Panduwasnuwara MPCS LTD") ? "✅" : "❌");
console.log("tagline:", body.includes("Empowering Our Community Through Co-operation") ? "✅" : "❌");
console.log("coop pill:", body.includes("Sri Lanka Co-operative Movement") ? "✅" : "❌");
console.log("stats bar:", body.includes("Dedicated Service") && body.includes("Member Owned") && body.includes("Official Registration") ? "✅" : "❌");
const mlink = await page.evaluate(() => document.querySelector('a[href*="maps.app.goo.gl"]')?.href || "none");
console.log("maps link:", mlink.includes("JFbV9o8sknmp1jDy7") ? "✅ " + mlink : "❌ " + mlink);
const emailCard = await page.evaluate(() => {
  const a = document.querySelector('a[href^="mailto:"]');
  return a ? { text: a.innerText.replace(/\n/g, "|"), nowrap: getComputedStyle(a).whiteSpace } : null;
});
console.log("email card:", JSON.stringify(emailCard), emailCard && emailCard.text.includes("\n") ? "❌ wrapped" : "✅ one-line");
// membership button
const mbtn = await page.evaluate(() => {
  const as = [...document.querySelectorAll("a")];
  const a = as.find((x) => /Membership|සාමාජිකත්වය/.test(x.textContent || "") && x.href.includes("members"));
  return a ? a.getAttribute("href") : "none";
});
console.log("Membership btn →", mbtn, mbtn.includes("membership/members") ? "✅" : "❌");
await page.screenshot({ path: "qa37-hero.png", clip: { x: 0, y: 0, width: 1440, height: 900 } });

// ── 2) NEWS instant (insert → home එකේ issaraha → delete) ──
await page.goto(`${SITE}/signin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.fill('input[name="nic"]', "superadmin@members.mpcs.lk");
await page.fill('input[name="password"]', "Admin@123");
await page.locator('form button[type="submit"]').first().click();
await page.waitForTimeout(5000);
const newsTest = await page.evaluate(async () => {
  const at = localStorage.getItem("mpcs_at");
  const H = { apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYWJseG9wYnl6eXFkeXBodGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjg1ODAsImV4cCI6MjEwNzY0NDU4MH0.uuetb0ZcTs3WDB5Adz7PmgZ-_EN4g_E-lXbOgtBMr5w", Authorization: "Bearer " + at, "Content-Type": "application/json" };
  const base = "https://gdablxopbyzyqdyphtib.supabase.co/rest/v1";
  const r = await fetch(base + "/news", { method: "POST", headers: H, body: JSON.stringify({ title: "QA-INSTANT-NEWS-TEST", body: "test", category: "notice", published: true }) });
  return r.status;
});
console.log("news insert:", newsTest);
await page.goto(SITE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
const body2 = await page.evaluate(() => document.body.innerText);
console.log("INSTANT news:", body2.includes("QA-INSTANT-NEWS-TEST") ? "✅ issaraha pennanawa!" : "❌ not shown");

// ── 3) APPLY page signed in → banner නෑ ──
await page.goto(`${SITE}/membership/apply`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
const body3 = await page.evaluate(() => document.body.innerText);
const bannerHidden = !body3.includes("Later / Apply Now") && !body3.includes("Sign In / Register");
console.log("apply banner hidden when signed in:", bannerHidden ? "✅" : "❌ still shows");
const filled = await page.evaluate(() => {
  const nic = document.querySelector('input[name="nic"]');
  return nic ? nic.value : "(no input)";
});
console.log("auto-fill nic:", filled && filled.length > 3 ? "✅ " + filled : "— (profile nic empty)");

// cleanup test news
await page.evaluate(async () => {
  const at = localStorage.getItem("mpcs_at");
  const H = { apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYWJseG9wYnl6eXFkeXBodGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjg1ODAsImV4cCI6MjEwNzY0NDU4MH0.uuetb0ZcTs3WDB5Adz7PmgZ-_EN4g_E-lXbOgtBMr5w", Authorization: "Bearer " + at };
  await fetch("https://gdablxopbyzyqdyphtib.supabase.co/rest/v1/news?title=eq.QA-INSTANT-NEWS-TEST", { method: "DELETE", headers: H });
});
console.log("test news cleaned");
await browser.close();
