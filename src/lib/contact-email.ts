"use client";

// ============================================================================
// Contact email resolver — hardcoded email වෙනුවට Admin → Settings එකේ
// (system_settings.contact_email_1 / contact_email_2) තියෙන එක ගනී.
//
// ⑳ — Live Chat එකට වෙනම address එකක්:
//      system_settings.live_chat_email  (Admin → Live Chat → Settings)
//      හිස් නම් contact_email_1 ට fallback වේ.
// ============================================================================

import { createAnonClient } from "@/lib/supabase/anon";

let cached: string | null = null;
let at = 0;
const TTL = 5 * 60 * 1000;

async function readSettings(keys: string[]): Promise<Map<string, string>> {
  try {
    const sb = createAnonClient();
    const { data } = await sb.from("system_settings").select("key,value").in("key", keys);
    return new Map(((data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  } catch {
    return new Map();
  }
}

export async function getContactEmail(fallback = ""): Promise<string> {
  if (cached && Date.now() - at < TTL) return cached;
  const map = await readSettings(["contact_email_1", "contact_email_2"]);
  const v = (map.get("contact_email_1") || "").trim() || (map.get("contact_email_2") || "").trim() || fallback;
  if (v) {
    cached = v;
    at = Date.now();
  }
  return v || fallback;
}

/** Live Chat වලින් එන ඉල්ලීම් යවන ලිපිනය — live_chat_email → contact_email_1 */
export async function getLiveChatEmail(fallback = ""): Promise<string> {
  const map = await readSettings(["live_chat_email", "contact_email_1", "contact_email_2"]);
  const v =
    (map.get("live_chat_email") || "").trim() ||
    (map.get("contact_email_1") || "").trim() ||
    (map.get("contact_email_2") || "").trim() ||
    fallback;
  return v || fallback;
}
