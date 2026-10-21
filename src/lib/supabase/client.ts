"use client";

import { createBrowserClient } from "@supabase/ssr";
export { isSupabaseConfigured } from "@/lib/env";

type BrowserClient = ReturnType<typeof createBrowserClient>;
let cachedClient: BrowserClient | null = null;
let authReady: Promise<BrowserClient> | null = null;

/** Browser (client components) සඳහා Supabase client — එකම client එක reuse කරයි. */
export function createClient(): BrowserClient {
  if (cachedClient) return cachedClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Supabase වින්‍යාස වී නොමැත. .env.local එකට NEXT_PUBLIC_SUPABASE_URL සහ NEXT_PUBLIC_SUPABASE_ANON_KEY එක් කරන්න."
    );
  }
  cachedClient = createBrowserClient(url, anon);
  return cachedClient;
}

/** Session එක cookie ප්‍රශ්න තිබුණත් වැඩ වෙන්න — localStorage එකෙන් restore කරයි (bulletproof auth) */
export async function authedClient(): Promise<BrowserClient> {
  const sb = createClient();
  if (!authReady) {
    authReady = (async () => {
      try {
        const { data } = await sb.auth.getSession();
        if (!data.session && typeof window !== "undefined") {
          const at = localStorage.getItem("mpcs_at");
          const rt = localStorage.getItem("mpcs_rt");
          if (at && rt) await sb.auth.setSession({ access_token: at, refresh_token: rt });
        }
      } catch { /* ignore */ }
      return sb;
    })();
  }
  return authReady;
}

/** login එකේදී token මතක තබා ගන්න */
export function storeTokens(session: { access_token: string; refresh_token: string } | null) {
  if (typeof window === "undefined" || !session) return;
  localStorage.setItem("mpcs_at", session.access_token);
  localStorage.setItem("mpcs_rt", session.refresh_token);
}
export function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("mpcs_at");
  localStorage.removeItem("mpcs_rt");
}
