// ============================================================================
//  📮 MAIL SERVER — SMTP (Gmail App Password) + FormSubmit fallback
// ----------------------------------------------------------------------------
//  ප්‍රශ්නය: site එකේ හැම email එකක්ම යැව්වේ FormSubmit (formsubmit.co) හරහා.
//  ඒ සේවාව down වුණාම (Cloudflare 522) — activation mail, backup report,
//  contact form, membership… **හැම email එකක්ම** යැවෙන්නේ නෑ.
//
//  ✅ විසඳුම: අපේම SMTP (Gmail App Password) එකකින් යවන්න පුළුවන් විදිහක්.
//     · Admin → Emails එකේ “Mail Server (SMTP)” card එකෙන් host/port/user/app password දානවා
//     · රහස් (password) `backup_secrets` table එකේ — service-role එකෙන් විතරයි කියවන්නේ
//     · SMTP configure කරලා නැත්නම් කලින් විදිහටම FormSubmit එකෙන් යවයි (fallback)
//
//  ⚠ මේ module එක **server-only** (API routes) — browser bundle එකට යන්නේ නෑ.
// ============================================================================

import nodemailer from "nodemailer";

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

export type MailResult = { ok: boolean; method: "smtp" | "formsubmit" | "none"; to: string; error?: string };

/** FormSubmit (fallback) — 522/timeout වුණොත් තව එක වරක් උත්සාහ කරයි */
export async function sendViaFormSubmit(to: string, subject: string, text: string): Promise<MailResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to.trim())}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ _subject: subject, Name: "Panduwasnuwara MPCS", Message: text }),
      });
      let sent = res.ok;
      let note = "";
      try {
        const j = (await res.json()) as { success?: boolean | string; message?: string } | null;
        if (j && typeof j.success !== "undefined") sent = res.ok && (j.success === true || j.success === "true");
        note = j?.message ? String(j.message) : "";
      } catch {
        note = res.ok ? "" : `HTTP ${res.status}`;
      }
      if (sent) return { ok: true, method: "formsubmit", to };
      if (res.status === 522 || res.status === 503 || res.status === 504) {
        // සේවාව down — ඊළඟ උත්සාහය
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
        return { ok: false, method: "formsubmit", to, error: `FormSubmit සේවාව down (HTTP ${res.status})` };
      }
      return { ok: false, method: "formsubmit", to, error: note || `HTTP ${res.status}` };
    } catch (e) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      return { ok: false, method: "formsubmit", to, error: (e as Error).message };
    }
  }
  return { ok: false, method: "formsubmit", to, error: "unknown" };
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
 * හැම ලිපිනයකටම යවයි — **SMTP configure කරලා තියෙනවා නම් SMTP**, නැත්නම් FormSubmit.
 * SMTP එකෙන් fail වුණොත් ලිපිනය FormSubmit එකෙන් උත්සාහ කරයි (double safety).
 */
export async function sendMail(input: {
  to: string | string[];
  subject: string;
  text: string;
}): Promise<{ ok: number; failed: MailResult[]; results: MailResult[]; method: "smtp" | "formsubmit" | "none" }> {
  const list = Array.from(
    new Set(
      (Array.isArray(input.to) ? input.to : [input.to])
        .map((e) => String(e ?? "").trim())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e))
    )
  );
  if (!list.length) return { ok: 0, failed: [], results: [], method: "none" };
  const smtp = await loadSmtp();
  const results: MailResult[] = [];
  for (const to of list) {
    if (smtp) {
      const r = await sendViaSmtp(smtp, to, input.subject, input.text);
      if (r.ok) {
        results.push(r);
        continue;
      }
      // SMTP fail → FormSubmit උත්සාහය
      const fb = await sendViaFormSubmit(to, input.subject, input.text);
      results.push(fb.ok ? fb : { ...r, error: `${r.error} · fallback: ${fb.error ?? "failed"}` });
    } else {
      results.push(await sendViaFormSubmit(to, input.subject, input.text));
    }
  }
  const ok = results.filter((r) => r.ok).length;
  const method = results.find((r) => r.ok)?.method ?? (smtp ? "smtp" : "formsubmit");
  return { ok, failed: results.filter((r) => !r.ok), results, method };
}
