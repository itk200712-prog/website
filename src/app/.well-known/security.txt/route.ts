// ============================================================================
//  /.well-known/security.txt — RFC 9116 vulnerability disclosure channel
//  (pentestnet report: "Not found — no vulnerability disclosure channel")
// ============================================================================
import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET() {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const body = [
    "# Panduwasnuwara New MPCS — security policy",
    "Contact: mailto:itk200712@gmail.com",
    "Contact: tel:+94779453982",
    "Expires: " + expires,
    "Preferred-Languages: si, en",
    "Canonical: https://website-blond-eta-94.vercel.app/.well-known/security.txt",
    "Policy: https://website-blond-eta-94.vercel.app/en/privacy",
    "",
  ].join("\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
