"use client";

// ============================================================================
// Contact email resolver — hardcoded email වෙනුවට Admin → Settings එකේ
// (system_settings.contact_email_1 / contact_email_2) තියෙන එක ගනී.
// ============================================================================

import { createAnonClient } from "@/lib/supabase/anon";

let cached: string | null = null;
let at = 0;
const TTL = 5 * 60 * 1000;

export async function getContactEmail(fallback = ""): Promise<string> {
  if (cached && Date.now() - at < TTL) return cached;
  try {
    const sb = createAnonClient();
    const { data } = await sb
      .from("system_settings")
      .select("key,value")
      .in("key", ["contact_email_1", "contact_email_2"]);
    const map = new Map(((data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
    const v = (map.get("contact_email_1") || "").trim() || (map.get("contact_email_2") || "").trim() || fallback;
    if (v) {
      cached = v;
      at = Date.now();
    }
    return v || fallback;
  } catch {
    return fallback;
  }
}
