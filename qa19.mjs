import { chromium } from "playwright-core";
const B = "https://website-blond-eta-94.vercel.app";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1560, height: 850 } });
await p.goto(B + "/", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
await p.locator("a:has-text('සිංහල'), button:has-text('සිංහල')").first().click().catch(() => {});
await p.waitForTimeout(1500);
const m = await p.evaluate(() => {
  const el = [...document.querySelectorAll("header div")].find((d) => d.className.includes("whitespace-nowrap"));
  return el ? { text: el.innerText, scroll: el.scrollWidth, client: el.clientWidth, fits: el.scrollWidth <= el.clientWidth + 1, cls: el.className } : null;
});
console.log(JSON.stringify(m, null, 1));
await p.screenshot({ path: "/home/user/qa/header-si.png", clip: { x: 0, y: 0, width: 900, height: 110 } });
await b.close();
