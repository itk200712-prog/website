import type { NextConfig } from "next";

// ============================================================================
//  🔐 Security headers — pentestnet report (07 Nov 2026) fix
//  Missing: X-Frame-Options · Content-Security-Policy · X-Content-Type-Options
//           Referrer-Policy · Permissions-Policy      → ඒ හැම එකක්ම දැන් set
//  · X-Powered-By: Next.js header එකත් ඉවත් (framework fingerprinting අඩු කරයි)
//  · CSP එකේ connect-src/ img-src වලට Supabase විතරයි අවසර — වෙන තැනකට data යන්නේ නෑ
// ============================================================================

const SUPABASE_ORIGIN = "https://*.supabase.co";
const SUPABASE_WS = "wss://*.supabase.co";

/**
 * 📌 CSP එක දැන් **middleware** එකේ per-request nonce එකකින් set වේ
 * (`src/middleware.ts` → `buildCsp(nonce)`). next.config එකේ CSP දැම්මොත් header
 * දෙකක් යනවා → browser එකේ දෙකේම intersection එක බලන නිසා nonce එක වැඩ කරන්නේ නෑ.
 */

const securityHeaders = (_isDev: boolean) => [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // 📌 pentestnet: "feature 'geolocation' is not restricted to specific origins"
    //    → origin එක explicit ව දෙන්නේ (self පමණයි = වෙන කිසිම third-party origin එකකට බෑ)
    value:
      "camera=(self), microphone=(self), geolocation=(self), payment=(self), " +
      "usb=(self), magnetometer=(self), gyroscope=(self), accelerometer=(self), " +
      "fullscreen=(self), picture-in-picture=(self), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

const nextConfig: NextConfig = {
  // 🔐 framework fingerprint එක ඉවත් කරයි (pentest report: x-powered-by)
  poweredByHeader: false,
  // ⚡ lucide icons ටික විතරක් bundle එකට ගනී — page JS එක සැහැල්ලු වේ
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
    ],
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    return [
      { source: "/:path*", headers: securityHeaders(isDev) },
      // API routes: cache කරන්න එපා + nosniff
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  // Backup ZIP එකට canonical supabase/schema.sql එකත්, hidden /hub පිටුවට
  // standalone HTML එකත් string එකක් විදිහට import කරන්න
  webpack: (config) => {
    config.module.rules.push({ test: /\.(sql|html)$/, type: "asset/source" });
    return config;
  },
};

export default nextConfig;
