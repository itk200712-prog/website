import { chromium } from "playwright";
const SITE = "https://website-blond-eta-94.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(`${SITE}/membership/members`, { waitUntil: "domcontentloaded" });
// rows load වෙනකම් (first batch ~6s)
await page.waitForTimeout(8000);
// file dropdown එකෙන් ඇත්ත file එකක් තෝරමු (Adukkane 697 rows → ~24 pages)
await page.locator('button:has-text("All Files")').first().click();
await page.waitForTimeout(600);
await page.locator('button:has-text("Adukkane")').first().click();
await page.waitForTimeout(800);
const body = await page.evaluate(() => document.body.innerText);
console.log("file filter:", body.includes("Adukkane") ? "✅ Adukkane selected" : "❌");
console.log("rows in file:", (body.match(/of [\d,]+ entries/) || ["?"])[0]);
// Download PDF
const dl = page.waitForEvent("download", { timeout: 240000 });
await page.locator('button:has-text("Download PDF")').click();
const download = await dl;
const path = "/home/user/coop-web/qa35-out.pdf";
await download.saveAs(path);
console.log("downloaded:", download.suggestedFilename());
await browser.close();
