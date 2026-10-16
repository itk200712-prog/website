import { chromium } from "playwright-core";
const B = "https://website-blond-eta-94.vercel.app";
const out = {};
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1560, height: 850 } });
await p.goto(B + "/", { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
const body = await p.locator("body").innerText();

// 2) buttons removed + all businesses
out.viewAllCount = (body.match(/සියල්ල බලන්න/g) || []).length;
out.noViewAllBiz = !(await p.locator("section:has-text('Business Divisions') a:has-text('සියල්ල'), section:has-text('Business Divisions') button:has-text('සියල්ල')").count());
out.allBusinesses = await p.evaluate(() => {
  const sec = [...document.querySelectorAll("section")].find((s) => s.innerText.includes("Business Divisions") && s.innerText.includes("ප්‍රධාන"));
  return sec ? sec.querySelectorAll("a[href*='businesses/'], .card").length : 0;
});

// 3) pill pro (after login)
await p.goto(B + "/signin", { waitUntil: "networkidle" });
await p.fill('input[name="nic"]', "SUPERADMIN");
await p.fill('input[name="password"]', "Admin@123");
await p.click('button[type="submit"]');
await p.waitForTimeout(5000);
out.pillPro = await p.evaluate(() => {
  const el = document.querySelector("header button .flex-col");
  return !!el;
});

// 1) person modal photo z-fix
await p.goto(B + "/", { waitUntil: "networkidle" });
await p.waitForTimeout(2000);
await p.locator("button:has-text('Emal Priyantha')").first().click();
await p.waitForTimeout(700);
out.photoZ = await p.evaluate(() => {
  const img = document.querySelector(".fixed.z-\\[120\\] .w-32.h-32");
  return img ? getComputedStyle(img).zIndex : "none";
});
await p.screenshot({ path: "/home/user/qa/modal-fixed.png" });
await p.locator("button:has-text('Close')").last().click();

// 5) gallery like/comment on home lightbox
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
await p.waitForTimeout(800);
await p.locator("button:has(.aspect-\\[4\\/3\\])").first().click();
await p.waitForTimeout(800);
out.likeBtn = await p.locator("button:has-text('Likes')").last().isVisible().catch(() => false);
out.commentForm = await p.locator('input[placeholder*="අදහස"], input[placeholder*="Comment"]').last().isVisible().catch(() => false);
await p.screenshot({ path: "/home/user/qa/gal-social.png" });

await b.close();
console.log(JSON.stringify(out, null, 1));
