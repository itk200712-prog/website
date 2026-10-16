import { chromium } from "playwright-core";
const BASE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
for (const [name, path] of [["fix-gallery", "/en/gallery"], ["fix-businesses", "/en/businesses"], ["fix-contact", "/en/contact"]]) {
  const failed = [];
  page.removeAllListeners();
  page.on("response", (r) => { if (r.status() >= 400) failed.push(r.status() + " " + r.url().replace(BASE, "").slice(0, 70)); });
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `/home/user/qa/${name}.png` });
  console.log(name, "fails:", failed.length ? failed : "none");
}
await browser.close();
