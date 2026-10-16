import { chromium } from "playwright-core";
import fs from "fs";

const BASE = "https://website-blond-eta-94.vercel.app";
const PAGES = [
  ["home-si", "/si"], ["home-en", "/en"],
  ["news", "/en/news"], ["board", "/en/board"],
  ["businesses", "/en/businesses"], ["biz-detail", "/en/businesses/rural-bank"],
  ["gallery", "/en/gallery"], ["contact", "/en/contact"],
  ["privacy", "/en/privacy"], ["terms", "/en/terms"],
  ["signin", "/signin"], ["register", "/register"],
  ["apply", "/en/membership/apply"], ["members", "/en/membership/members"],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
const report = [];

for (const [name, path] of PAGES) {
  const errors = [], failed = [];
  page.removeAllListeners();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("vitals")) failed.push(r.status() + " " + r.url().replace(BASE, "").slice(0, 90)); });
  try {
    const resp = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `/home/user/qa/${name}.png`, fullPage: false });
    report.push({ name, path, status: resp.status(), errors: [...new Set(errors)].slice(0, 5), failed: [...new Set(failed)].slice(0, 8) });
    console.log(`${name} ${resp.status()} err:${errors.length} fail:${failed.length}`);
  } catch (e) {
    report.push({ name, path, status: "TIMEOUT", errors: [], failed: [String(e).slice(0, 100)] });
    console.log(`${name} TIMEOUT`);
  }
}
fs.writeFileSync("/home/user/qa/report.json", JSON.stringify(report, null, 1));
await browser.close();
console.log("DONE");
