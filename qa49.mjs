import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("https://website-blond-eta-94.vercel.app/si", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4500);
const r = await page.evaluate(() => {
  const h1 = document.querySelector("h1");
  const heroSec = [...document.querySelectorAll("section")].find((s) => s.querySelector("h1"));
  const heroBottom = heroSec ? Math.round(heroSec.getBoundingClientRect().bottom) : 0;
  const boardH2 = [...document.querySelectorAll("h2")].find((h) => /අධ්‍යක්ෂ මණ්ඩලය/.test(h.textContent || ""));
  const bt = boardH2 ? Math.round(boardH2.getBoundingClientRect().top + window.scrollY) : null;
  return {
    title: h1 ? h1.innerText.trim() : "",
    heroBottom,
    viewport: window.innerHeight,
    boardHeadingTop: bt,
    coversFirstScreen: heroBottom >= window.innerHeight - 5,
    headingBelowHero: bt !== null && bt >= heroBottom,
  };
});
console.log(JSON.stringify(r, null, 1));
console.log("title correct:", r.title === "සී/ස පඬුවස්නුවර නව විවිධ සේවා සමූපකාර සමිතිය" ? "✅" : "❌ " + r.title);
console.log("hero fills first screen:", r.coversFirstScreen ? "✅ (white strip නෑ)" : "❌");
console.log("board details below hero:", r.headingBelowHero ? "✅" : "❌");
await page.screenshot({ path: "qa49-hero.png", clip: { x: 0, y: 0, width: 1440, height: 900 } });
await page.evaluate(() => window.scrollTo(0, window.innerHeight - 60));
await page.waitForTimeout(1200);
await page.screenshot({ path: "qa49-below.png", clip: { x: 0, y: 0, width: 1440, height: 900 } });
await browser.close();
