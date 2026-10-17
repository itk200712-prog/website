import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("https://website-blond-eta-94.vercel.app/en", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4500);
// hero + board heading එකම section එකේද?
const res = await page.evaluate(() => {
  const secs = [...document.querySelectorAll("section")];
  const heroSec = secs.find((s) => s.querySelector("h1"));
  const heads = heroSec ? [...heroSec.querySelectorAll("h2")] : [];
  const boardHead = heads.find((h) => /Board of Directors/i.test(h.textContent || ""));
  const boardSecs = secs.filter((s) => s.querySelector("button.group"));
  const boardSec = boardSecs[0];
  const bg = boardSec ? getComputedStyle(boardSec).backgroundImage : "";
  return {
    headingInHero: !!boardHead,
    headingColor: boardHead ? getComputedStyle(boardHead).color : "",
    heroH: heroSec ? Math.round(heroSec.getBoundingClientRect().height) : 0,
    boardSecBgImage: bg.includes("url") ? "HAS IMAGE ❌" : "gradient ✅",
    cards: boardSec ? boardSec.querySelectorAll("button.group").length : 0,
  };
});
console.log(JSON.stringify(res, null, 1));
await page.screenshot({ path: "qa47-a.png", clip: { x: 0, y: 0, width: 1440, height: 900 } });
await page.evaluate(() => window.scrollTo(0, 560));
await page.waitForTimeout(1200);
await page.screenshot({ path: "qa47-b.png", clip: { x: 0, y: 0, width: 1440, height: 900 } });
await browser.close();
