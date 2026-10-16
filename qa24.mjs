import { chromium } from "playwright-core";
const B = "https://website-blond-eta-94.vercel.app";
const out = {};
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1560, height: 850 } });
await p.goto(B + "/", { waitUntil: "networkidle" });
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.33));
await p.waitForTimeout(1500);
const grab = () => p.evaluate(() => {
  const nums = [...document.querySelectorAll(".tabular-nums")].map((el) => el.innerText.trim());
  return nums.slice(0, 6);
});
out.t0 = await grab();
await p.waitForTimeout(4000);
out.t1 = await grab();
await p.screenshot({ path: "/home/user/qa/real-stats.png" });
await b.close();
console.log(JSON.stringify(out, null, 1));
