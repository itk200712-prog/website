import { chromium } from "playwright-core";
const B = "https://website-blond-eta-94.vercel.app";
const out = {};
const b = await chromium.launch({ channel: undefined, executablePath: undefined }).catch(() => null) || await chromium.launch();
const ctx = await b.newContext({ acceptDownloads: true });
const p = await ctx.newPage();

// 1) default language = English?
await p.goto(B + "/", { waitUntil: "domcontentloaded" });
out.homeHtml = await p.content();
out.defaultEnglish = out.homeHtml.includes("Board of Directors") || out.homeHtml.includes("Business Divisions") || out.homeHtml.includes('lang="en"');
delete out.homeHtml;

// 2) login superadmin
await p.goto(B + "/signin", { waitUntil: "networkidle" });
await p.fill('input[name="nic"]', "SUPERADMIN");
await p.fill('input[name="password"]', "Admin@123");
await p.click('button[type="submit"]');
await p.waitForTimeout(5000);
out.afterLoginUrl = p.url();

// 3) backup download
await p.goto(B + "/admin/backup", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
await p.fill('input[placeholder="Download password එක ඇතුළත් කරන්න"]', "MPCS@Backup#2026");
const dl = p.waitForEvent("download", { timeout: 60000 });
await p.click("text=Generate & Download Backup");
const d = await dl;
const path = await d.path();
const fs = await import("fs");
const sql = fs.readFileSync(path, "utf-8");
out.dlName = d.suggestedFilename();
out.sqlSizeKB = Math.round(sql.length / 1024);
out.sqlHasF28 = sql.includes("f28_members") && sql.includes("f28_items");
out.sqlHasFuelStock = sql.includes("fuel_stock");
out.sqlHasActivityLogs = sql.includes("admin_activity_logs");
out.sqlHasApplications = sql.includes("membership_applications");
out.sqlHasAuth = sql.includes("LOGIN ACCOUNTS") && sql.includes("auth.users");
out.sqlHasImages = sql.includes("site_images_backup");
out.insertCount = (sql.match(/INSERT INTO public\./g) || []).length;

// 4) import test (same file — full replace round-trip)
const errToast = p.waitForSelector("text=Restored", { timeout: 60000 }).then(() => true).catch(() => false);
const chooser = p.waitForEvent("filechooser", { timeout: 30000 });
await p.fill('input[placeholder="Import password එක ඇතුළත් කරන්න"]', "MPCS@Restore#2026");
await p.click("text=Choose .sql File");
const fc = await chooser;
await fc.setFiles(path);
p.once("dialog", (d2) => d2.accept());
out.importOk = await errToast;
await p.waitForTimeout(3000);
out.afterImport = (await p.locator("body").innerText()).slice(0, 200);

await p.screenshot({ path: "/home/user/qa/backup-test.png", fullPage: false });
await b.close();
console.log(JSON.stringify(out, null, 1));
