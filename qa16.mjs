import { chromium } from "playwright-core";
const B = "https://website-blond-eta-94.vercel.app";
const out = {};
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1560, height: 800 } });

// header glider
await p.goto(B + "/", { waitUntil: "networkidle" });
await p.waitForTimeout(2000);
const gallery = p.locator('nav a:has-text("Gallery")');
await gallery.hover();
await p.waitForTimeout(500);
out.gliderVisible = await p.evaluate(() => {
  const g = document.querySelector('nav span[aria-hidden]');
  return g ? getComputedStyle(g).opacity : "none";
});
await p.screenshot({ path: "/home/user/qa/nav-glider.png", clip: { x: 0, y: 0, width: 1560, height: 130 } });

// signin page
await p.goto(B + "/signin", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
out.signinSplit = await p.locator("text=Welcome Back").isVisible().catch(() => false);
await p.screenshot({ path: "/home/user/qa/signin-new.png" });

// register page
await p.goto(B + "/register", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
out.registerSplit = await p.locator("text=Become a Member").isVisible().catch(() => false);
out.registerForm = await p.locator('input[name="full_name"]').isVisible().catch(() => false);
await p.screenshot({ path: "/home/user/qa/register-new.png" });

await b.close();
console.log(JSON.stringify(out, null, 1));
