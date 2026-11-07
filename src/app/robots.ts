// ============================================================================
//  /robots.txt — pentestnet report: "Not found" → දැන් හරියට generate වේ
//  · Admin / auth / API / dashboard වගේ private routes crawler වලට තහනම්
//  · Public pages සියල්ල allow
// ============================================================================
import type { MetadataRoute } from "next";

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://website-blond-eta-94.vercel.app";

export default function robots(): MetadataRoute.Robots {
  const disallow = [
    "/admin",
    "/admin/",
    "/api/",
    "/dashboard",
    "/dashboard/",
    "/signin",
    "/register",
    "/hub",
    "/auth/",
    "/*/admin",
    "/*/admin/",
    "/*/api/",
    "/*/dashboard",
    "/*/signin",
    "/*/register",
    "/*/hub",
  ];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      // AI crawlers — public data scrape කරන්න ඉඩ දෙන්නේ නෑ
      { userAgent: "GPTBot", disallow: "/" },
      { userAgent: "CCBot", disallow: "/" },
      { userAgent: "AhrefsBot", disallow: "/" },
      { userAgent: "SemrushBot", disallow: "/" },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
