import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
    ],
  },
  // Backup ZIP එකට canonical supabase/schema.sql එකත්, hidden /hub පිටුවට
  // standalone HTML එකත් string එකක් විදිහට import කරන්න
  webpack: (config) => {
    config.module.rules.push({ test: /\.(sql|html)$/, type: "asset/source" });
    return config;
  },
};

export default nextConfig;
