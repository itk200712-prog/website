import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("https://website-blond-eta-94.vercel.app/en", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4500);
const r = await page.evaluate(() => {
  const secs = [...document.querySelectorAll("section")];
  const heroSec = secs.find((s) => s.querySelector("h1"));
  const heroBottom = heroSec ? heroSec.getBoundingClientRect().bottom : 0;
  const boardHead = [...document.querySelectorAll("h2")].find((h) => /Board of Directors/i.test(h.textContent || ""));
  const hr = boardHead ? boardHead.getBoundingClientRect() : null;
  return {
    heroBottom: Math.round(heroBottom),
    headingTop: hr ? Math.round(hr.top) : null,
    headingIsWhite: boardHead ? getComputedStyle(boardHead).color : "",
    headingInsideHero: heroSec && boardHead ? heroSec.contains(boardHead) : null,
  };
});
console.log(JSON.stringify(r, null, 1));
console.log("heading BELOW hero:", r.headingTop >= r.heroBottom ? "✅" : "❌");
await page.evaluate(() => window.scrollTo(0, 520));
await page.waitForTimeout(1200);
await page.screenshot({ path: "qa48.png", clip: { x: 0, y: 0, width: 1440, height: 900 } });
await browser.close();
