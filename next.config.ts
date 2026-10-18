import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
    ],
  },
  // Backup ZIP එකට canonical supabase/schema.sql එක string එකක් විදිහට import කරන්න
  webpack: (config) => {
    config.module.rules.push({ test: /\.sql$/, type: "asset/source" });
    return config;
  },
};

export default nextConfig;
