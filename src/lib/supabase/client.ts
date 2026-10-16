"use client";

import { createBrowserClient } from "@supabase/ssr";
export { isSupabaseConfigured } from "@/lib/env";

/** Browser (client components) සඳහා Supabase client */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Supabase වින්‍යාස වී නොමැත. .env.local එකට NEXT_PUBLIC_SUPABASE_URL සහ NEXT_PUBLIC_SUPABASE_ANON_KEY එක් කරන්න."
    );
  }
  return createBrowserClient(url, anon);
}

/** Session එක cookie ප්‍රශ්න තිබුණත් වැඩ වෙන්න — localStorage එකෙන් restore කරයි (bulletproof auth) */
export async function authedClient() {
  const sb = createClient();
  try {
    const { data } = await sb.auth.getSession();
    if (!data.session && typeof window !== "undefined") {
      const at = localStorage.getItem("mpcs_at");
      const rt = localStorage.getItem("mpcs_rt");
      if (at && rt) await sb.auth.setSession({ access_token: at, refresh_token: rt });
    }
  } catch { /* ignore */ }
  return sb;
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
