import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto("https://website-blond-eta-94.vercel.app/si", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4500);
const y = await page.evaluate(() => {
  const h2 = [...document.querySelectorAll("h2")].find((x) => /අධ්‍යක්ෂ මණ්ඩලය/.test(x.textContent || ""));
  return h2 ? h2.getBoundingClientRect().top + window.scrollY - 40 : 0;
});
await page.evaluate((yy) => window.scrollTo(0, yy), y);
await page.waitForTimeout(1500);
await page.screenshot({ path: "qa45-board.png", clip: { x: 0, y: 0, width: 1440, height: 1000 } });
console.log("screenshot taken, board top y =", Math.round(y));
await browser.close();
