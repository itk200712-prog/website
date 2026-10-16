import { chromium } from "playwright-core";
const B = "https://website-blond-eta-94.vercel.app";
const out = {};
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(B + "/signin", { waitUntil: "networkidle" });
await p.fill('input[name="nic"]', "SUPERADMIN");
await p.fill('input[name="password"]', "Admin@123");
await p.click('button[type="submit"]');
await p.waitForTimeout(5000);
await p.goto(B + "/admin/applications", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);

// 1) approved row → Reject locked
const approvedRow = p.locator("tr", { has: p.locator("text=approved") }).first();
out.rejectLocked = await approvedRow.locator("span.cursor-not-allowed:has-text('Reject')").count() > 0;
out.photoViewBtns = await p.locator("button:has-text('View')").count();

// 2) edit modal + save
await p.locator("button:has-text('Edit')").first().click();
await p.waitForTimeout(600);
out.editModalOpen = await p.locator("text=Application Details Edit").isVisible().catch(() => false);
await p.locator("button:has-text('Save Changes')").click();
await p.waitForTimeout(2500);
out.saveToast = (await p.locator("body").innerText()).includes("details saved") || (await p.locator("body").innerText()).includes("✅");

// 3) activities log entry
await p.goto(B + "/admin/activities", { waitUntil: "networkidle" });
await p.waitForTimeout(2000);
const act = await p.locator("body").innerText();
out.activityLogged = act.includes("APPLICATION_UPDATED") || act.includes("APPLICATION_APPROVED") || act.includes("application");

await b.close();
console.log(JSON.stringify(out, null, 1));
