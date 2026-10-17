"use client";

// ============================================================================
//  Central email routing — ㉕
//  හැම "mail එකක් එන තැනක්" ම Admin → Emails එකෙන් පාලනය වේ.
//  Route එකකට ලිපින 1–4ක් (default 2) දාන්න පුළුවන් — හැම ලිපිනයකටම යවයි.
//
//  storage: system_settings.mail_route_<route>_<n>   (n = 1..4)
//  (වෙනම table එකක් / SQL run කිරීමක් අවශ්‍ය නෑ — system_settings දැනටමත් තියෙනවා)
// ============================================================================

import { createAnonClient } from "@/lib/supabase/anon";

export type MailRouteKey = "membership" | "inquiry" | "livechat" | "business";

export type MailRouteDef = {
  key: MailRouteKey;
  title_en: string;
  title_si: string;
  desc_en: string;
  desc_si: string;
  /** පැරණි settings වලින් fallback (පිළිවෙලට) */
  fallbackKeys: string[];
  /** notify_emails table එකේ ලිපිනත් එකතු කරන්නද */
  useNotifyList?: boolean;
};

export const MAIL_SLOTS = 4;
export const DEFAULT_SLOTS = 2;

export const MAIL_ROUTES: MailRouteDef[] = [
  {
    key: "membership",
    title_en: "Membership Applications",
    title_si: "සාමාජික අයදුම්පත්",
    desc_en: "හැම ‘Apply for Membership’ submit එකක්ම මේ ලිපිනවලට යයි (රැස් කළ පෝරමය + අයදුම්කරුගේ විස්තර).",
    desc_si: "සාමාජිකත්වය සඳහා අයදුම්පතක් submit වෙද්දී මේ ලිපින වලට email එකක් යයි.",
    fallbackKeys: ["contact_email_1", "contact_email_2"],
    useNotifyList: true,
  },
  {
    key: "inquiry",
    title_en: "Contact / Inquiry Form",
    title_si: "විමසුම් පෝරමය (Contact Us)",
    desc_en: "Contact page එකේ ‘Send an Inquiry’ පෝරමය submit වෙද්දී මේ ලිපින වලට යයි.",
    desc_si: "‘Send an Inquiry’ / සම්බන්ධ වන්න පෝරමය submit වෙද්දී මේ ලිපින වලට යයි.",
    fallbackKeys: ["contact_email_1", "contact_email_2"],
  },
  {
    key: "livechat",
    title_en: "Live Chat Requests & Callbacks",
    title_si: "සජීවී චැට් ඉල්ලීම් / ඇමතුම් ඉල්ලීම්",
    desc_en: "‘Contact Live Chat’ සහ ‘Request a Call’ ඉල්ලීම් (නම · NIC · දුරකථන) මේ ලිපින වලට යයි.",
    desc_si: "‘Contact Live Chat’ සහ ‘Request a Call’ ඉල්ලීම් (නම · NIC · දුරකථන) මේ ලිපින වලට යයි.",
    fallbackKeys: ["live_chat_email", "contact_email_1"],
  },
  {
    key: "business",
    title_en: "Business Unit Inquiries",
    title_si: "ව්‍යාපාරික අංශ විමසුම්",
    desc_en: "ව්‍යාපාරික අංශයක පිටුවේ ‘Send an Inquiry’ පෝරමය submit වෙද්දී මේ ලිපින වලට යයි.",
    desc_si: "ව්‍යාපාර විස්තර page එකේ ‘Send an Inquiry’ පෝරමය submit වෙද්දී මේ ලිපින වලට යයි.",
    fallbackKeys: ["contact_email_1", "contact_email_2"],
  },
];

const ROUTE_MAP = new Map(MAIL_ROUTES.map((r) => [r.key, r]));

export function routeDef(key: MailRouteKey): MailRouteDef {
  return ROUTE_MAP.get(key) ?? MAIL_ROUTES[0];
}

/** system_settings key — mail_route_<route>_<n> */
export function mailKey(route: MailRouteKey, n: number): string {
  return `mail_route_${route}_${n}`;
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

// ---------------------------------------------------------------------------
// cache
// ---------------------------------------------------------------------------
type CacheEntry = { at: number; emails: string[] };
const cache = new Map<string, CacheEntry>();
const TTL = 45 * 1000;

export function clearMailRouteCache() {
  cache.clear();
}

async function readSettings(keys: string[]): Promise<Map<string, string>> {
  try {
    const sb = createAnonClient();
    const { data } = await sb.from("system_settings").select("key,value").in("key", keys);
    return new Map(((data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  } catch {
    return new Map();
  }
}

/** route එකකට දැමූ ලිපින (හිස් ඒවා ඉවත් කර, unique) */
export async function getRouteEmails(route: MailRouteKey, opts?: { fallback?: boolean }): Promise<string[]> {
  const def = routeDef(route);
  const keys: string[] = [];
  for (let n = 1; n <= MAIL_SLOTS; n++) keys.push(mailKey(route, n));
  const map = await readSettings([...keys, ...def.fallbackKeys]);

  const own: string[] = [];
  for (let n = 1; n <= MAIL_SLOTS; n++) {
    const v = (map.get(mailKey(route, n)) || "").trim();
    if (v) own.push(v);
  }
  if (own.length) return Array.from(new Set(own));

  // ── fallback (පරණ settings / notify list) ──
  const list: string[] = [];
  if (def.useNotifyList) {
    try {
      const sb = createAnonClient();
      const { data } = await sb.from("notify_emails").select("email,active").eq("active", true);
      for (const r of (data ?? []) as { email: string; active: boolean }[]) {
        if (r.email) list.push(r.email.trim());
      }
    } catch {
      /* table නැත්නම් ignore */
    }
  }
  for (const k of def.fallbackKeys) {
    const v = (map.get(k) || "").trim();
    if (v) list.push(v);
  }
  return Array.from(new Set(list.filter(Boolean)));
}

/** cache එකක් සමඟ — client forms වලින් call කරයි */
export async function getRouteEmailsCached(route: MailRouteKey): Promise<string[]> {
  const hit = cache.get(route);
  if (hit && Date.now() - hit.at < TTL) return hit.emails;
  const emails = await getRouteEmails(route);
  cache.set(route, { at: Date.now(), emails });
  return emails;
}

/**
 * හැම ලිපිනයකටම email යවයි.
 * @returns යැවූ ගණන
 */
export async function sendToRoute(route: MailRouteKey, payload: Record<string, unknown>): Promise<number> {
  const list = await getRouteEmails(route);
  if (!list.length) return 0;
  let ok = 0;
  await Promise.all(
    list.map(async (to) => {
      try {
        const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) ok++;
      } catch {
        /* ignore */
      }
    })
  );
  return ok;
}

/** FormSubmit activation mail — ලිපිනයකට */
export async function sendActivationMail(email: string): Promise<boolean> {
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(email)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: "MPCS — Activate this email address",
        Name: "Panduwasnuwara MPCS",
        Message:
          "This is the activation request for the society notification list. Please confirm this address to start receiving notifications.",
        Source: "Admin → Emails (activation)",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
