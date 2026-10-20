import hubHtml from "./hub.html";

// Direct-URL-only standalone page. It is intentionally not linked from the
// public site or the admin panel; /hub, /si/hub and /en/hub all reach it.
export function GET() {
  return new Response(hubHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
