import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
await page.goto(`${SITE}/signin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.fill('input[name="nic"]', "superadmin@members.mpcs.lk");
await page.fill('input[name="password"]', "Admin@123");
await page.locator('form button[type="submit"]').first().click();
await page.waitForTimeout(5000);

// 1) default value පේනවද (settings load)
await page.goto(`${SITE}/admin/settings`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
const preview = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('img[alt="Board background"]')];
  return imgs.length ? imgs[0].src : "none";
});
console.log("settings preview (loaded from DB):", preview.includes("hero-2") ? "✅ " + preview.split("/").pop() : preview);

// 2) REAL upload through UI
await page.locator('input[type="file"]').nth(1).setInputFiles("/home/user/coop-web/qa-boardbg.jpg");
// nth(1) = board bg input? check panel scoping instead:
const ok = await page.evaluate(async () => {
  // upload was triggered by setInputFiles; wait for DB
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 700));
    const r = await fetch("https://gdablxopbyzyqdyphtib.supabase.co/rest/v1/system_settings?select=value&key=eq.board_bg", {
      headers: { apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYWJseG9wYnl6eXFkeXBodGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjg1ODAsImV4cCI6MjEwNzY0NDU4MH0.uuetb0ZcTs3WDB5Adz7PmgZ-_EN4g_E-lXbOgtBMr5w" },
    });
    const j = await r.json();
    const v = j[0]?.value || "";
    if (v.includes("site-images")) return v;
  }
  return "not saved";
});
console.log("UI upload → DB:", ok === "not saved" ? "❌ FAILED" : "✅ " + ok.split("/").slice(-2).join("/"));

// 3) home — background පේනවද
await page.goto(`${SITE}/si`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
const bg = await page.evaluate(() => {
  const s = [...document.querySelectorAll("section")].find((x) => x.style.backgroundImage && x.style.backgroundImage !== "none" && x.querySelector("button.group"));
  return s ? s.style.backgroundImage.slice(0, 110) : "none";
});
console.log("home board bg:", bg === "none" ? "❌ none" : "✅ " + bg);
await browser.close();
