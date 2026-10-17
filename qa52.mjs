import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
await page.goto(`${SITE}/en`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4500);

// 1) launcher
const launcher = await page.evaluate(() => !!document.querySelector('button[aria-label="Live chat"]'));
console.log("chat launcher:", launcher ? "✅" : "❌");
await page.locator('button[aria-label="Live chat"]').click();
await page.waitForTimeout(800);
const body1 = await page.evaluate(() => document.body.innerText);
console.log("welcome msg:", body1.includes("assistant") ? "✅" : "❌");
console.log("quick chips:", body1.includes("Find a member") ? "✅" : "❌");

// 2) member lookup
await page.locator('input[placeholder*="member number"]').fill("41/01");
await page.keyboard.press("Enter");
await page.waitForTimeout(3000);
const body2 = await page.evaluate(() => document.body.innerText);
const found = /Member No: 41\/01/.test(body2) && /NIC:/.test(body2) && /Address:/.test(body2);
console.log("member lookup 41/01:", found ? "✅ full details" : "❌");
const name = (body2.match(/([^\n]+)\n✅ Member No: 41\/01/) || [])[1] || "";
console.log("  →", JSON.stringify(name.slice(0, 40)));

// 3) business managers
await page.locator('input[placeholder*="member number"]').fill("business managers");
await page.keyboard.press("Enter");
await page.waitForTimeout(3000);
const body3 = await page.evaluate(() => document.body.innerText);
console.log("business managers:", body3.includes("Business Managers") && /\d{3}\s?\d{3}\s?\d{4}/.test(body3) ? "✅ names + phones" : "❌");

// 4) office hours
await page.locator('input[placeholder*="member number"]').fill("office hours");
await page.keyboard.press("Enter");
await page.waitForTimeout(1500);
const body4 = await page.evaluate(() => document.body.innerText);
console.log("office hours:", body4.includes("Office Hours") && body4.includes("8.30") ? "✅" : "❌");

// 5) unknown → fallback
await page.locator('input[placeholder*="member number"]').fill("asdkjhasd");
await page.keyboard.press("Enter");
await page.waitForTimeout(1500);
const body5 = await page.evaluate(() => document.body.innerText);
console.log("fallback:", body5.includes("didn't catch that") ? "✅" : "❌");

await page.screenshot({ path: "qa52-chat.png" });

// 6) Send message tab → form → DB row
await page.getByRole("button", { name: /Message/ }).click();
await page.waitForTimeout(800);
await page.locator('form input[name="name"]').fill("QA Chat Test");
await page.locator('form input[name="phone"]').fill("0771234567");
await page.locator('form textarea[name="message"]').fill("Testing live chat message delivery");
await page.locator('form button[type="submit"]').click();
await page.waitForTimeout(5000);
const body6 = await page.evaluate(() => document.body.innerText);
console.log("send message UI:", /Message sent|යැවුණා/.test(body6) ? "✅" : "❌");
const db = await page.evaluate(async () => {
  const r = await fetch("https://gdablxopbyzyqdyphtib.supabase.co/rest/v1/messages?select=name,department,message&department=eq.Live%20Chat&order=created_at.desc&limit=1", { headers: { apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYWJseG9wYnl6eXFkeXBodGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjg1ODAsImV4cCI6MjEwNzY0NDU4MH0.uuetb0ZcTs3WDB5Adz7PmgZ-_EN4g_E-lXbOgtBMr5w" } });
  return await r.json();
});
console.log("DB message row:", JSON.stringify(db), db.length && db[0].name === "QA Chat Test" ? "✅ saved to admin inbox" : "❌");
console.log("JS errors:", errs.length ? errs : "none ✅");
await page.screenshot({ path: "qa52-form.png" });
await browser.close();
