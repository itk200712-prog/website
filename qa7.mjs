import { chromium } from "playwright-core";
const B = "https://website-blond-eta-94.vercel.app";
const b = await chromium.launch();
const p = await b.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const r = await p.goto(B + "/apply", { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
console.log(JSON.stringify({
  status: r.status(),
  fileInput: await p.locator('input[type="file"]').count(),
  text: (await p.locator("body").innerText()).slice(0, 400),
  errors,
}, null, 1));
await b.close();
