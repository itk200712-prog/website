"use client";

// ============================================================================
// Site logo — admin settings එකෙන් upload කරන logo එක header/footer/hero වල පෙන්වයි
// ============================================================================

import { useEffect, useState } from "react";
import { createAnonClient } from "@/lib/supabase/anon";

const CACHE_KEY = "mpcs_site_logo";

export function useSiteLogo(): string {
  const [logo, setLogo] = useState<string>("");

  useEffect(() => {
    let alive = true;
    // localStorage cache — පළමු render එකේම පෙන්වන්න
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) setLogo(cached);
    } catch {
      /* ignore */
    }
    (async () => {
      try {
        const sb = createAnonClient();
        const { data } = await sb.from("system_settings").select("value").eq("key", "site_logo").maybeSingle();
        if (!alive) return;
        const v = ((data as { value?: string } | null)?.value || "").trim();
        setLogo(v);
        try {
          if (v) localStorage.setItem(CACHE_KEY, v);
          else localStorage.removeItem(CACHE_KEY);
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return logo;
}

export function SiteLogoBadge({ size = 44, className = "" }: { size?: number; className?: string }) {
  const logo = useSiteLogo();
  return (
    <div
      className={`rounded-full overflow-hidden bg-gradient-to-br from-fuchsia-600 to-purple-700 text-white flex items-center justify-center text-[10px] font-black tracking-wide shadow shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="Logo" className="w-full h-full object-cover" />
      ) : (
        "coop"
      )}
    </div>
  );
}
