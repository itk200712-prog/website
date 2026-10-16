import { chromium } from "playwright-core";
const B = "https://website-blond-eta-94.vercel.app";
const b = await chromium.launch();
const p = await b.newPage();
const out = {};
await p.goto(B + "/membership/apply", { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
out.bannerVisibleBefore = await p.locator("button:has-text('Later')").isVisible().catch(() => false);
if (out.bannerVisibleBefore) {
  await p.locator("button:has-text('Later')").first().click();
  await p.waitForTimeout(500);
  out.bannerVisibleAfter = await p.locator("button:has-text('Later')").isVisible().catch(() => false);
}
await b.close();
console.log(JSON.stringify(out, null, 1));
