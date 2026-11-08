// ============================================================================
//  📮 MAIL SERVER — SilentForms (ප්‍රධාන) + SMTP (උපසේවා)
// ----------------------------------------------------------------------------
//  ✅ ප්‍රධාන සේවාව: **SilentForms** — `https://silentforms.com/api/submit`
//     · Admin → Emails එකේ “SilentForms Access Key” card එකෙන් key එක save කරනවා
//       (key එක `backup_secrets` table එකේ — service-role එකෙන් විතරයි කියවන්නේ)
//     · key එක save කරලා නැත්නම් built-in default key එක පාවිච්චි වේ → මුලින්ම වැඩ කරයි
//     · SilentForms එකේ ලිපි **access key එකට සම්බන්ධ inbox එකටයි** එන්නේ —
//       ඒ නිසා හැම පණිවිඩයකම අදාළ route/ලිපින සටහන් වේ
//     · එය fail වුණොත් ඉබේම **SMTP** එකට මාරු වේ (Gmail App Password)
//
//  ⚠ මේ module එක **server-only** (API routes) — browser bundle එකට යන්නේ නෑ.
// ============================================================================

import nodemailer from "nodemailer";
import {
  MAIL_PROVIDER_SETTING,
  SILENTFORMS_KEY_SETTING,
  resolveSilentFormsKey,
  postToSilentForms,
  type MailProvider,
} from "@/lib/silentforms";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

export const SMTP_KEYS = {
  host: "smtp_host",
  port: "smtp_port",
  user: "smtp_user",
  pass: "smtp_pass",
  fromName: "smtp_from_name",
  fromEmail: "smtp_from_email",
  secure: "smtp_secure",
} as const;

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  secure: boolean;
};

/** SMTP ලෙස වැඩ කරන පොදු presets (Admin card එකේ shortcut buttons) */
export const SMTP_PRESETS = {
  gmail: { host: "smtp.gmail.com", port: 465, secure: true },
  outlook: { host: "smtp-mail.outlook.com", port: 587, secure: false },
  yahoo: { host: "smtp.mail.yahoo.com", port: 465, secure: true },
} as const;

function svcHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, ...extra };
}

/** `backup_secrets` එකෙන් SMTP සැකසුම කියවයි (service-role — browser එකට යන්නේ නෑ) */
export async function loadSmtp(): Promise<SmtpConfig | null> {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  try {
    const keys = Object.values(SMTP_KEYS).join(",");
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/backup_secrets?select=key,value&key=in.(${keys})`,
      { headers: svcHeaders(), cache: "no-store" }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { key: string; value: string }[];
    const map = new Map(rows.map((r) => [r.key, String(r.value ?? "").trim()]));
    const host = map.get(SMTP_KEYS.host) ?? "";
    const user = map.get(SMTP_KEYS.user) ?? "";
    const pass = map.get(SMTP_KEYS.pass) ?? "";
    if (!host || !user || !pass) return null;
    const port = Number(map.get(SMTP_KEYS.port) ?? 465) || 465;
    return {
      host,
      port,
      user,
      pass,
      fromName: map.get(SMTP_KEYS.fromName) || "Panduwasnuwara MPCS",
      fromEmail: map.get(SMTP_KEYS.fromEmail) || user,
      secure: (map.get(SMTP_KEYS.secure) ?? "true") !== "false" && port !== 587,
    };
  } catch {
    return null;
  }
}

/** SMTP සැකසුම save කරයි (password දුන්නොත් විතරක් pass key එක update වේ) */
export async function saveSmtp(input: Partial<SmtpConfig> & { pass?: string }): Promise<string | null> {
  if (!SUPABASE_URL || !SERVICE_KEY) return "server_not_configured";
  const rows: { key: string; value: string }[] = [];
  const put = (k: string, v: string | number | boolean | undefined) => {
    if (v === undefined) return;
    rows.push({ key: k, value: String(v) });
  };
  put(SMTP_KEYS.host, input.host?.trim());
  put(SMTP_KEYS.port, input.port);
  put(SMTP_KEYS.user, input.user?.trim());
  put(SMTP_KEYS.pass, input.pass);
  put(SMTP_KEYS.fromName, input.fromName?.trim());
  put(SMTP_KEYS.fromEmail, input.fromEmail?.trim());
  put(SMTP_KEYS.secure, typeof input.secure === "boolean" ? String(input.secure) : undefined);
  if (!rows.length) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/backup_secrets`, {
      method: "POST",
      headers: svcHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(rows),
      cache: "no-store",
    });
    return res.ok ? null : `save failed (${res.status})`;
  } catch (e) {
    return (e as Error).message;
  }
}

/**
 * 🚦 SilentForms “down” මතකය (server instance එකකට) — එක වරක් fail වුණාම ඊළඟ විනාඩි 15
 * SilentForms එක ආයේ උත්සාහ නොකර කෙලින්ම SMTP එකට යනවා (ෆෝම් එක රැඳෙන්නේ නෑ).
 * සේවාව හොඳ වුණාම ඉබේම ආයේ SilentForms එකට මාරු වේ.
 */
const SF_DOWN_FOR_MS = 15 * 60 * 1000;
let sfDownUntil = 0;
function silentFormsDown(): boolean {
  return Date.now() < sfDownUntil;
}
function markSilentFormsDown(): void {
  sfDownUntil = Date.now() + SF_DOWN_FOR_MS;
}
function clearSilentFormsDown(): void {
  sfDownUntil = 0;
}

export type MailResult = { ok: boolean; method: "smtp" | "silentforms" | "none"; to: string; error?: string };

/** 📨 Admin → Emails එකේදී save කරන SilentForms සැකසුම (server-only, backup_secrets) */
export async function loadMailSettings(): Promise<{ key: string; provider: MailProvider; saved: boolean }> {
  if (!SUPABASE_URL || !SERVICE_KEY) return { key: resolveSilentFormsKey(null), provider: "silentforms", saved: false };
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/backup_secrets?select=key,value&key=in.(${SILENTFORMS_KEY_SETTING},${MAIL_PROVIDER_SETTING})`,
      { headers: svcHeaders(), cache: "no-store" }
    );
    if (!res.ok) return { key: resolveSilentFormsKey(null), provider: "silentforms", saved: false };
    const rows = (await res.json()) as { key: string; value: string | null }[];
    const map = new Map(rows.map((r) => [r.key, String(r.value ?? "")]));
    const raw = (map.get(SILENTFORMS_KEY_SETTING) ?? "").trim();
    return {
      key: resolveSilentFormsKey(raw),
      provider: (map.get(MAIL_PROVIDER_SETTING) ?? "").trim().toLowerCase() === "smtp" ? "smtp" : "silentforms",
      saved: raw.length > 0,
    };
  } catch {
    return { key: resolveSilentFormsKey(null), provider: "silentforms", saved: false };
  }
}

/** SilentForms key / provider save කරයි */
export async function saveMailSettings(input: { accessKey?: string; provider?: MailProvider }): Promise<string | null> {
  if (!SUPABASE_URL || !SERVICE_KEY) return "server key නෑ";
  const rows: { key: string; value: string; updated_at: string }[] = [];
  const now = new Date().toISOString();
  if (input.accessKey !== undefined) {
    rows.push({ key: SILENTFORMS_KEY_SETTING, value: String(input.accessKey).trim(), updated_at: now });
  }
  if (input.provider !== undefined) {
    rows.push({ key: MAIL_PROVIDER_SETTING, value: input.provider === "smtp" ? "smtp" : "silentforms", updated_at: now });
  }
  if (!rows.length) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/backup_secrets`, {
      method: "POST",
      headers: svcHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(rows),
      cache: "no-store",
    });
    return res.ok ? null : `save failed (${res.status})`;
  } catch (e) {
    return (e as Error).message;
  }
}

/**
 * 📨 SilentForms එකෙන් යවයි (server). ලිපින කීපයක් වුණත් **එක submission එකක්** —
 * SilentForms එකේ පණිවිඩ එන්නේ key එකට සම්බන්ධ inbox එකට; ලිපින සියල්ල body එකේ සටහන් වේ.
 */
export async function sendViaSilentForms(
  to: string[],
  subject: string,
  text: string,
  keyOverride?: string
): Promise<MailResult[]> {
  const { key } = keyOverride ? { key: resolveSilentFormsKey(keyOverride) } : await loadMailSettings();
  const r = await postToSilentForms(key, {
    _subject: subject,
    from_name: "Panduwasnuwara MPCS",
    form: "MPCS · system mail",
    "To (configured)": to.join(", "),
    message: text,
  });
  return to.map((addr) =>
    r.ok
      ? { ok: true, method: "silentforms" as const, to: addr }
      : { ok: false, method: "silentforms" as const, to: addr, error: r.error ?? "SilentForms failed" }
  );
}

/** SMTP එකකින් යවයි */
export async function sendViaSmtp(cfg: SmtpConfig, to: string, subject: string, text: string): Promise<MailResult> {
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
      connectionTimeout: 12_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to,
      subject,
      text,
    });
    return { ok: true, method: "smtp", to };
  } catch (e) {
    const msg = (e as Error).message || "SMTP error";
    return { ok: false, method: "smtp", to, error: msg.slice(0, 300) };
  }
}

/**
 * හැම ලිපිනයකටම යවයි.
 *
 *  ① **SilentForms** (default) — එක submission එකකින් සියලු ලිපින එකම inbox එකට
 *  ② එය fail / down නම් **SMTP** එකෙන් වෙන් වෙන් වශයෙන් (configure කරලා තිබ්බොත්)
 *  ③ දෙකම නැත්නම් 0 — form data තවමත් DB එකේ/Admin → Messages එකේ save වේ
 */
export async function sendMail(input: {
  to: string | string[];
  subject: string;
  text: string;
}): Promise<{ ok: number; failed: MailResult[]; results: MailResult[]; method: "smtp" | "silentforms" | "none" }> {
  const list = Array.from(
    new Set(
      (Array.isArray(input.to) ? input.to : [input.to])
        .map((e) => String(e ?? "").trim())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e))
    )
  );
  if (!list.length) return { ok: 0, failed: [], results: [], method: "none" };

  const settings = await loadMailSettings();
  const order: MailProvider[] = settings.provider === "smtp" ? ["smtp", "silentforms"] : ["silentforms", "smtp"];
  const smtp = await loadSmtp();
  let results: MailResult[] = [];

  for (const step of order) {
    if (step === "silentforms") {
      if (silentFormsDown()) continue; // 🔴 ඊළඟ විනාඩි 15 කෙලින්ම SMTP එකට
      const r = await sendViaSilentForms(list, input.subject, input.text, settings.key);
      if (r.some((x) => x.ok)) {
        clearSilentFormsDown();
        return { ok: r.filter((x) => x.ok).length, failed: [], results: r, method: "silentforms" };
      }
      markSilentFormsDown(); // 👉 ඉබේම SMTP එකට මාරු වේ
      results = r;
    } else if (smtp) {
      const out: MailResult[] = [];
      for (const to of list) out.push(await sendViaSmtp(smtp, to, input.subject, input.text));
      if (out.some((x) => x.ok)) return { ok: out.filter((x) => x.ok).length, failed: out.filter((x) => !x.ok), results: [...out, ...results], method: "smtp" };
      results = [...out, ...results];
    }
  }
  return { ok: 0, failed: results.filter((r) => !r.ok), results, method: smtp ? "smtp" : "silentforms" };
}
