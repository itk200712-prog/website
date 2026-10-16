import { chromium } from "playwright-core";
const B = "https://website-blond-eta-94.vercel.app";
const b = await chromium.launch();
const p = await b.newPage();
const out = {};
// home page membership section = apply form
await p.goto(B + "/#members", { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
out.fileInputs = await p.locator('input[type="file"]').count();
out.hasBanner = await p.locator("text=We saved your previous answers").isVisible().catch(() => false);
// seed localStorage to test banner dismiss
await p.evaluate(() => localStorage.setItem("mpcs_apply_draft", "{}"));
await p.goto(B + "/#members", { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
out.bannerSeeded = await p.locator("text=We saved your previous answers").isVisible().catch(() => false);
if (out.bannerSeeded) {
  await p.locator("button:has-text('Later')").first().click();
  await p.waitForTimeout(500);
  out.bannerAfterLater = await p.locator("text=We saved your previous answers").isVisible().catch(() => false);
}
await b.close();
console.log(JSON.stringify(out, null, 1));
