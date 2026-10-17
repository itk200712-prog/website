import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("https://website-blond-eta-94.vercel.app/en", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
const info = await page.evaluate(() => {
  const h = document.querySelector("header");
  const balls = h ? [...h.querySelectorAll("div,span")].filter((e) => /rounded-full/.test(e.className) && e.offsetWidth >= 18 && e.offsetWidth <= 48) : [];
  return balls.slice(0, 3).map((b) => ({ txt: b.innerText.trim().slice(0, 12), w: b.offsetWidth, hasImg: !!b.querySelector("img") }));
});
console.log("header balls:", JSON.stringify(info));
const heroBall = await page.evaluate(() => {
  const b = [...document.querySelectorAll("div")].filter((e) => /rounded-full/.test(e.className) && e.offsetWidth === 20);
  return b.length ? { n: b.length, hasImg: !!b[0].querySelector("img"), txt: b[0].innerText.trim() } : null;
});
console.log("hero pill ball:", JSON.stringify(heroBall));
await browser.close();
