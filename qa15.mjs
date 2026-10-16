import { chromium } from "playwright-core";
const B = "https://website-blond-eta-94.vercel.app";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1560, height: 800 } });
await p.goto(B + "/", { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
const body = await p.locator("body").innerText();
const i = body.indexOf("General Manager");
const j = body.indexOf("Regional");
console.log(JSON.stringify({
  gm: i, regional: j,
  around: body.slice(Math.max(0, (i > 0 ? i : j > 0 ? j : 3000) - 400), (i > 0 ? i : j > 0 ? j : 3000) + 300),
  hasOfficial: body.includes("Official Members"),
  hasOfficerPill: body.includes("Administrative Officer"),
}));
await b.close();
