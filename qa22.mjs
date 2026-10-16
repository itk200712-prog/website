import { chromium } from "playwright-core";
const B = "https://website-blond-eta-94.vercel.app";
const out = {};
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await p.goto(B + "/", { waitUntil: "networkidle" });
await p.waitForTimeout(3000);

// white strip = horizontal overflow?
out.docW = await p.evaluate(() => document.documentElement.scrollWidth);
out.winW = await p.evaluate(() => window.innerWidth);
out.noOverflow = out.docW <= out.winW + 1;

// fonts loaded?
out.fontsLoaded = await p.evaluate(async () => {
  await document.fonts.ready;
  const inter = document.fonts.check("16px Inter");
  const si = document.fonts.check("16px 'Noto Sans Sinhala'") || [...document.fonts].some((f) => f.family.includes("Sinhala"));
  return { inter, si };
});

// brand full name visible?
out.brand = await p.evaluate(() => {
  const el = [...document.querySelectorAll("header div")].find((d) => d.className && d.className.includes("max-w-[190px]"));
  return el ? { text: el.innerText.slice(0, 30), fits: el.scrollWidth <= el.clientWidth + 1 || el.clientHeight > 30 } : null;
});

await p.screenshot({ path: "/home/user/qa/mobile-fixed.png" });
await b.close();
console.log(JSON.stringify(out, null, 1));
