import { chromium } from "playwright-core";
const B = "https://website-blond-eta-94.vercel.app";
const out = {};
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1560, height: 850 } });
// login first
await p.goto(B + "/signin", { waitUntil: "networkidle" });
await p.fill('input[name="nic"]', "SUPERADMIN");
await p.fill('input[name="password"]', "Admin@123");
await p.click('button[type="submit"]');
await p.waitForTimeout(5000);
// home page (after login) — pill
await p.goto(B + "/", { waitUntil: "networkidle" });
await p.waitForTimeout(2000);
const body = await p.locator("body").innerText();
out.viewAllEng = (body.match(/View All →/g) || []).length;
out.pillPro = await p.evaluate(() => {
  const el = [...document.querySelectorAll("header button")].find((b) => b.innerText.includes("SUPERADMIN") || b.innerText.includes("Member"));
  return el ? el.className.includes("ring-2") || el.querySelector(".flex-col") !== null : false;
});
out.bizCards = await p.evaluate(() => {
  const sec = [...document.querySelectorAll("section")].find((s) => s.innerText.includes("Our Businesses"));
  return sec ? sec.querySelectorAll("a[href*='/businesses/']").length : 0;
});
await p.screenshot({ path: "/home/user/qa/pill-check.png", clip: { x: 900, y: 0, width: 660, height: 90 } });
await b.close();
console.log(JSON.stringify(out, null, 1));
