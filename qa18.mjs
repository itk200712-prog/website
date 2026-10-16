import { chromium } from "playwright-core";
const B = "https://website-blond-eta-94.vercel.app";
const out = {};
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1560, height: 850 } });
await p.goto(B + "/", { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
const body = await p.locator("body").innerText();

// 1) news 4/row
out.newsCols = await p.evaluate(() => {
  const sec = [...document.querySelectorAll("section")].find((s) => s.innerText.includes("News & Announcements"));
  const grid = sec ? sec.querySelector(".grid") : null;
  return grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0;
});

// 2) gallery click → lightbox + tagline + prev/next
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.52));
await p.waitForTimeout(800);
const galBtn = p.locator("button:has(.aspect-\\[4\\/3\\])").first();
await galBtn.click();
await p.waitForTimeout(800);
out.lightboxOpen = await p.locator("text=Photo Gallery").last().isVisible().catch(() => false);
out.lightboxNav = await p.locator("button[aria-label], button:has-text('›')").count() > 0;
await p.screenshot({ path: "/home/user/qa/gal-lightbox.png" });
await p.locator("button:has-text('Close')").last().click();
await p.waitForTimeout(400);

// 3) CTA professional (checkoạt new content)
out.ctaPro = body.includes("Free registration") || body.includes("නොමිලේ ලියාපදිංචිය");

// 4) social icons popup — footer designer
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(1000);
await p.locator("text=Induwara Thathsara").first().click();
await p.waitForTimeout(500);
out.socialIcons = await p.locator("a[title='WhatsApp'], a[title='Facebook']").count();

// 5) about unique border
out.aboutBorder = await p.evaluate(() => {
  const el = [...document.querySelectorAll("div")].find((d) => d.className && typeof d.className === "string" && d.className.includes("bg-gradient-to-br from-indigo-500/70"));
  return !!el;
});

// 6) hero centered
out.heroCenter = await p.evaluate(() => {
  const h1 = [...document.querySelectorAll("h1")].find((x) => x.innerText.includes("Panduwasnuwara"));
  return h1 ? getComputedStyle(h1).textAlign : "none";
});

// 7) Sinhala header name full
await p.goto(B + "/", { waitUntil: "networkidle" });
await p.locator("button:has-text('සිංහල'), a:has-text('සිංහල')").first().click().catch(() => {});
await p.waitForTimeout(1500);
out.headerBrand = await p.evaluate(() => {
  const el = document.querySelector("header .font-extrabold.text-white, header a div.font-extrabold");
  const els = [...document.querySelectorAll("header div")].filter((d) => d.innerText.includes("සමිති"));
  const t = els.length ? els[0] : null;
  return t ? { text: t.innerText.slice(0, 60), scroll: t.scrollWidth, client: t.clientWidth, fits: t.scrollWidth <= t.clientWidth + 2 } : null;
});
await p.locator("button:has-text('English'), a:has-text('English')").first().click().catch(() => {});
await p.waitForTimeout(1200);

// 8) mega dropdown hover border class
const biz = p.locator("nav button:has-text('Businesses')");
await biz.hover();
await p.waitForTimeout(700);
out.megaHoverClass = await p.evaluate(() => {
  const item = document.querySelector(".mega a, .mega [class*='rounded-xl']");
  return item ? item.className.includes("hover:border-indigo-300") : false;
});

// 9) contact cards glass
out.contactGlass = await p.evaluate(() => document.body.innerHTML.includes("from-indigo-500 to-indigo-700"));

await b.close();
console.log(JSON.stringify(out, null, 1));
