import { chromium } from "playwright-core";
const B = "https://website-blond-eta-94.vercel.app";
const out = {};
const b = await chromium.launch();
const p = await b.newPage();

// apply page banner + Later
await p.goto(B + "/apply", { waitUntil: "networkidle" });
out.bannerBefore = await p.locator("text=We saved your previous answers").isVisible().catch(() => false);
await p.locator("button:has-text('Later')").first().click().catch(() => {});
await p.waitForTimeout(400);
out.bannerAfterLater = await p.locator("text=We saved your previous answers").isVisible().catch(() => false);
out.fileInput = await p.locator('input[type="file"]').count();

// admin applications photo column
await p.goto(B + "/signin", { waitUntil: "networkidle" });
await p.fill('input[name="nic"]', "SUPERADMIN");
await p.fill('input[name="password"]', "Admin@123");
await p.click('button[type="submit"]');
await p.waitForTimeout(5000);
await p.goto(B + "/admin/applications", { waitUntil: "networkidle" });
const h = await p.content();
out.photoColumn = h.includes("PHOTO") || h.includes("photo");
await b.close();
console.log(JSON.stringify(out, null, 1));
