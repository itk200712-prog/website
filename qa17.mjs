import { chromium } from "playwright-core";
const B = "https://website-blond-eta-94.vercel.app";
const out = {};
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1560, height: 850 } });
await p.goto(B + "/", { waitUntil: "networkidle" });
await p.waitForTimeout(3000);

// board below hero — no overlap
out.boardCards = await p.locator("button:has-text('View Full Profile'), button:has-text('වැඩි විස්තර')").count();
out.gridCols = await p.evaluate(() => {
  const el = [...document.querySelectorAll("section")].find((s) => s.innerText.includes("Board of Directors") && s.querySelector("button"));
  const grid = el ? el.querySelector(".grid") : null;
  return grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0;
});

// popup modal
await p.locator("button:has-text('Emal Priyantha')").first().click();
await p.waitForTimeout(800);
out.modalOpen = await p.locator("text=Qualification").isVisible().catch(() => false);
await p.screenshot({ path: "/home/user/qa/person-modal.png" });
await p.locator("button:has-text('Close')").last().click();
await p.waitForTimeout(500);

// board section screenshot
const boardSec = p.locator("section", { has: p.locator("text=Governance & Leadership") }).first();
await boardSec.scrollIntoViewIfNeeded();
await p.waitForTimeout(800);
await p.screenshot({ path: "/home/user/qa/board-glass.png" });

// about section: stats above vision
const body = await p.locator("body").innerText();
const vi = body.indexOf("Our Vision");
const bi = body.indexOf("Business Divisions");
const mi = body.indexOf("Our Mission");
out.statsAboveVision = bi > 0 && vi > 0 && bi < vi && mi > vi;
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.38));
await p.waitForTimeout(800);
await p.screenshot({ path: "/home/user/qa/about-glass.png" });

await b.close();
console.log(JSON.stringify(out, null, 1));
