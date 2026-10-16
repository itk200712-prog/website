import { chromium } from "playwright-core";
const B = "https://website-blond-eta-94.vercel.app";
const out = {};
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1560, height: 850 } });
await p.goto(B + "/", { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
// stats section එකට යන්න
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.35));
await p.waitForTimeout(1000);
const grab = async () => {
  return await p.evaluate(() => {
    const sec = [...document.querySelectorAll("section")].find((s) => s.innerText.includes("CSV / EXCEL"));
    return sec ? sec.innerText.replace(/\n+/g, " | ").slice(0, 260) : "not found";
  });
};
out.t0 = await grab();
await p.waitForTimeout(3500);
out.t1 = await grab(); // තත්පර 3.5කට පස්සේ — refresh වෙලා ආයේ count වෙන්න ඕන
await p.screenshot({ path: "/home/user/qa/real-stats.png" });
await b.close();
console.log(JSON.stringify(out, null, 1));
