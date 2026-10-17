import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(`${SITE}/membership/members`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(7000);
// file dropdown open
await page.locator('button:has-text("All Files")').first().click();
await page.waitForTimeout(700);
// dropdown panel fully visible? (table එකට උඩින්, clip නොවෙනවා)
const box = await page.evaluate(() => {
  const panels = [...document.querySelectorAll("div")].filter((d) => d.className && typeof d.className === "string" && d.className.includes("z-[60]"));
  const p = panels[0];
  if (!p) return null;
  const r = p.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, h: r.height, items: p.querySelectorAll("button").length };
});
console.log("dropdown panel:", JSON.stringify(box), box && box.h > 200 ? "✅ full height (clip නෑ)" : "❌ clipped?");
await page.screenshot({ path: "qa36-dropdown.png", clip: { x: 0, y: 0, width: 1440, height: 1000 } });
// select a file → PDF button label check
await page.locator('button:has-text("Adukkane")').first().click();
await page.waitForTimeout(600);
console.log("file selected:", (await page.evaluate(() => document.body.innerText)).includes("Adukkane") ? "✅" : "❌");
await browser.close();
