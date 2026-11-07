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

export type MailRouteKey = "membership" | "inquiry" | "livechat" | "message" | "business" | "backup";

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
    key: "message",
    title_en: "Website Message Box",
    title_si: "වෙබ් පණිවිඩ පෙට්ටිය (Message tab)",
    desc_en: "Messages sent from the chat widget's ‘Message’ tab are emailed to these addresses (and also appear in Admin → Messages).",
    desc_si: "චැට් එකේ ‘Message’ tab එකෙන් එවන පණිවිඩ මේ ලිපින වලට email වේ — එම පණිවිඩ Admin → Messages එකෙත් පෙනේ.",
    fallbackKeys: ["mail_route_livechat_1", "live_chat_email", "contact_email_1"],
  },
  {
    key: "backup",
    title_en: "Auto Backup Reports",
    title_si: "Auto Backup වාර්තා (සාර්ථක / අසාර්ථක)",
    desc_en:
      "Every scheduled auto-backup sends a report here: file name, file type, file size, status (successful/failed), time spent, and the date & day of the run.",
    desc_si:
      "ඉබේම දුවන හැම auto-backup එකකටම පස්සේ වාර්තාවක් මේ ලිපින වලට එයි — file නම · file වර්ගය · file ප්‍රමාණය · තත්ත්වය (සාර්ථක/අසාර්ථක) · ගත වූ වේලාව · දිනය සහ දවස.",
    fallbackKeys: ["contact_email_1", "contact_email_2"],
    useNotifyList: false,
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
/**
 * 🌐 මුලින්ම **server route** එකෙන් යවන්න බලයි (`/api/mail/send`, SMTP).
 * FormSubmit down වුණත් (522) SMTP configure කරලා තියෙනවා නම් email යනවා.
 * Server එකෙන් යැවීම අසාර්ථක නම් පමණක් පරණ FormSubmit ක්‍රමයට යයි.
 */
async function sendViaServerRoute(route: MailRouteKey, payload: Record<string, unknown>): Promise<number> {
  try {
    const subject = String(payload._subject ?? "MPCS — පණිවිඩයක්");
    const skip = new Set(["_subject", "_template", "_autoresponse", "_captcha", "Message"]);
    const lines: string[] = [];
    const msg = payload.Message ?? payload.message ?? "";
    if (msg) lines.push(String(msg));
    for (const [k, v] of Object.entries(payload)) {
      if (skip.has(k) || v === "" || v === undefined || v === null) continue;
      const show = String(v) === "true" ? "ඔව්" : String(v) === "false" ? "නෑ" : String(v);
      lines.push(`${k}: ${show}`);
    }
    lines.push("", "— Panduwasnuwara New MPCS LTD");
    const res = await fetch("/api/mail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ route, subject, text: lines.join("\n") }),
    });
    if (!res.ok) return 0;
    const j = (await res.json().catch(() => ({}))) as { sent?: number };
    return Number(j?.sent ?? 0);
  } catch {
    return 0;
  }
}

export async function sendToRoute(route: MailRouteKey, payload: Record<string, unknown>): Promise<number> {
  // ① SMTP (server) — configure කරලා නම් / FormSubmit down නම් වැඩ කරයි
  const viaServer = await sendViaServerRoute(route, payload);
  if (viaServer > 0) return viaServer;
  // ② පරණ FormSubmit ක්‍රමය (fallback)
  const list = await getRouteEmails(route);
  if (!list.length) return 0;
  let ok = 0;
  await Promise.all(
    list.map(async (to, i) => {
      try {
        // Visitor confirmation (_autoresponse) එක පළමු ලිපිනයෙන් පමණයි —
        // නැත්නම් ලිපින ගණනටම confirmation mail යයි
        const body: Record<string, unknown> = { ...payload };
        if (i > 0) delete body._autoresponse;
        const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(body),
        });
        // FormSubmit එක HTTP 200 දුන්නත් confirm නොකළ ලිපිනයකට success:"false" එයි —
        // ඒක "යැවුණා" කියලා ගණන් ගන්නේ නෑ
        let sent = res.ok;
        try {
          const j = (await res.json()) as { success?: boolean | string } | null;
          if (j && typeof j.success !== "undefined") sent = res.ok && (j.success === true || j.success === "true");
        } catch {
          /* JSON නෙවෙයි නම් HTTP status එකම ඇති */
        }
        if (sent) ok++;
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
