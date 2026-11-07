// /sitemap.xml — public pages ටික (admin/api නෑ)
import type { MetadataRoute } from "next";

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://website-blond-eta-94.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    "/board",
    "/businesses",
    "/gallery",
    "/news",
    "/contact",
    "/membership/apply",
    "/membership/members",
    "/membership/voters",
    "/privacy",
    "/terms",
  ];
  const now = new Date();
  return paths.flatMap((p) =>
    ["si", "en"].map((lang) => ({
      url: `${BASE}/${lang}${p}`,
      lastModified: now,
      changeFrequency: (p === "" ? "daily" : "weekly") as "daily" | "weekly",
      priority: p === "" ? 1 : 0.7,
    }))
  );
}
