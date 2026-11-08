// ============================================================================
//  📮 MAIL ROUTES — server-side recipient resolution (service role)
// ----------------------------------------------------------------------------
//  Browser bundle එකට යන්නේ නෑ. `/api/mail/send` route එකේදී විතරයි පාවිච්චි වෙන්නේ:
//    · ලිපින client එකෙන් එවන්නේ නෑ — server එකේම `system_settings` එකෙන් හොයනවා
//      (ඒ නිසා route එක open relay එකක් වෙන්නේ නෑ)
//    · SMTP පමණයි; not-configured / send failure පැහැදිලිව වාර්තා කරයි
// ============================================================================

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

export type ServerMailRoute = "membership" | "inquiry" | "livechat" | "message" | "business" | "backup";

export const SERVER_MAIL_ROUTES: ServerMailRoute[] = [
  "membership",
  "inquiry",
  "livechat",
  "message",
  "business",
  "backup",
];

const FALLBACKS: Record<ServerMailRoute, string[]> = {
  membership: ["contact_email_1", "contact_email_2"],
  inquiry: ["contact_email_1", "contact_email_2"],
  livechat: ["live_chat_email", "contact_email_1"],
  message: ["mail_route_livechat_1", "live_chat_email", "contact_email_1"],
  business: ["contact_email_1", "contact_email_2"],
  backup: ["contact_email_1", "contact_email_2"],
};

async function rowsFor(keys: string[]): Promise<Map<string, string>> {
  if (!SUPABASE_URL || !SERVICE_KEY || !keys.length) return new Map();
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/system_settings?select=key,value&key=in.(${keys.map(encodeURIComponent).join(",")})`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store" }
    );
    if (!res.ok) return new Map();
    const rows = (await res.json()) as { key: string; value: string }[];
    return new Map(rows.map((r) => [r.key, String(r.value ?? "").trim()]));
  } catch {
    return new Map();
  }
}

/** route එකක ලිපින (Admin → Emails එකේ දාලා තියෙන ඒවා) */
export async function routeEmailsServer(route: ServerMailRoute): Promise<string[]> {
  const keys = ["mail_route_" + route + "_1", "mail_route_" + route + "_2", "mail_route_" + route + "_3", "mail_route_" + route + "_4"];
  const map = await rowsFor([...keys, ...FALLBACKS[route]]);
  const own = keys.map((k) => map.get(k) ?? "").filter(Boolean);
  if (own.length) return Array.from(new Set(own));
  const fb = FALLBACKS[route].map((k) => map.get(k) ?? "").filter(Boolean);
  return Array.from(new Set(fb));
}

/* --------------------------------------------------------- rate limiting --- */
const HITS = new Map<string, { at: number; count: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 6;

/** එකම IP එකෙන් 10 මිනිත්තුවකට 6කට වඩා යවන්න දෙන්නේ නෑ (spam protection) */
export function rateLimit(ip: string, key = "mail"): boolean {
  const now = Date.now();
  const k = `${key}:${ip}`;
  const cur = HITS.get(k);
  if (!cur || now - cur.at > WINDOW_MS) {
    HITS.set(k, { at: now, count: 1 });
    return true;
  }
  if (cur.count >= MAX_PER_WINDOW) return false;
  cur.count += 1;
  return true;
}
