import { chromium } from "playwright-core";
const B = "https://website-blond-eta-94.vercel.app";
const b = await chromium.launch();
const p = await b.newPage();
const out = {};
await p.goto(B + "/membership/apply", { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
out.fileInputs = await p.locator('input[type="file"]').count();
out.hasBanner = await p.locator("text=We saved your previous answers").isVisible().catch(() => false);
// find draft key and seed it
const key = await p.evaluate(() => Object.keys(localStorage).filter(k => k.includes("apply") || k.includes("draft")));
out.draftKeys = key;
await p.evaluate((ks) => { localStorage.setItem(ks[0] || "mpcs_apply_draft", JSON.stringify({ name_en: "Test", nic: "123" })); }, key);
await p.goto(B + "/membership/apply", { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
out.bannerSeeded = await p.locator("text=We saved your previous answers").isVisible().catch(() => false);
if (out.bannerSeeded) {
  await p.locator("button:has-text('Later')").first().click();
  await p.waitForTimeout(500);
  out.bannerAfterLater = await p.locator("text=We saved your previous answers").isVisible().catch(() => false);
  await p.goto(B + "/membership/apply", { waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  out.bannerAfterReload = await p.locator("text=We saved your previous answers").isVisible().catch(() => false);
}
await b.close();
console.log(JSON.stringify(out, null, 1));
