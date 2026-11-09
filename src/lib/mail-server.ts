// Server-side SMTP-only mail. Credentials are stored in backup_secrets, never in the browser.
import nodemailer from "nodemailer";
import { createHash } from "node:crypto";
import { smtpConfigurationIssue } from "@/lib/mail-config";
export { SMTP_PRESETS } from "@/lib/mail-config";

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

function svcHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, ...extra };
}

/**
 * 🗝 `backup_secrets` එකට rows save කරයි (merge on key).
 *
 * ⚠ ඒ table එකේ තියෙන්නේ **`key` සහ `value` විතරයි** — `updated_at` වගේ column එකක්
 *   යැව්වොත් PostgREST එක `400 · column backup_secrets.updated_at does not exist` දෙනවා.
 *   (ඒකයි “save failed (400)” කියලා ආවේ.) දැන් යවන්නේ ඒ columns දෙකම විතරයි, අසාර්ථක
 *   වුණොත් Supabase එකේ ඇත්ත හේතුවම UI එකට එනවා.
 */
async function upsertSecretRows(rows: { key: string; value: string }[]): Promise<string | null> {
  if (!SUPABASE_URL || !SERVICE_KEY) return "server_not_configured";
  if (!rows.length) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/backup_secrets`, {
      method: "POST",
      headers: svcHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(rows.map((r) => ({ key: r.key, value: r.value }))),
      cache: "no-store",
    });
    if (res.ok) return null;
    let detail = "";
    const raw = await res.text();
    try {
      const j = JSON.parse(raw) as { message?: string; details?: string; hint?: string; code?: string };
      detail = [j?.message, j?.code, j?.hint].filter(Boolean).join(" · ").slice(0, 240);
    } catch {
      detail = raw.slice(0, 240);
    }
    return `save failed (${res.status})${detail ? ` — ${detail}` : ""}`;
  } catch (e) {
    return (e as Error).message;
  }
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
    const map = new Map(rows.map((r) => [r.key, r.key === SMTP_KEYS.pass ? String(r.value ?? "") : String(r.value ?? "").trim()]));
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
  return upsertSecretRows(rows);
}

export function normalizeMailAddress(email: string): string { return email.trim().toLowerCase(); }
const validMailAddress = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
export type MailResult = { ok: boolean; method: "smtp" | "none"; to: string; error?: string };

/** One-time cleanup of retired mail settings; never deletes SMTP credentials or unrelated secrets. */
export async function cleanupRetiredMailSettings(): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_KEY) return false;
  // These names are retained only to remove obsolete database rows, not for sending mail.
  const query = new URLSearchParams({ or: "(key.like.silentforms*,key.eq.mail_provider)" });
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/backup_secrets?${query}`, {
      method: "DELETE", headers: svcHeaders({ Prefer: "return=minimal" }), cache: "no-store",
    });
    return res.ok;
  } catch { return false; }
}

/** SMTP එකකින් යවයි */
export async function sendViaSmtp(cfg: SmtpConfig, to: string, subject: string, text: string, messageIdSeed?: string): Promise<MailResult> {
  const configurationIssue = smtpConfigurationIssue(cfg);
  if (configurationIssue) return { ok: false, method: "smtp", to, error: configurationIssue };
  let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;
  try {
    transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      requireTLS: !cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
      connectionTimeout: 12_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    const info = await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to,
      subject,
      text,
      ...(messageIdSeed ? { messageId: `<mpcs-${createHash("sha256").update(messageIdSeed + ":" + to).digest("hex")}@${cfg.fromEmail.split("@")[1] || "mpcs.invalid"}>` } : {}),
    });
    if (!Array.isArray(info.accepted) || info.accepted.length === 0) {
      return { ok: false, method: "smtp", to, error: "SMTP server did not accept the recipient" };
    }
    return { ok: true, method: "smtp", to };
  } catch (e) {
    const msg = (e as Error).message || "SMTP error";
    const safeMessage = cfg.pass ? msg.split(cfg.pass).join("[redacted]") : msg;
    const failure = e as Error & { code?: string; responseCode?: number };
    if (failure.code === "EAUTH" || failure.responseCode === 535 || /\b535\b|BadCredentials|Invalid login/i.test(safeMessage)) {
      const advice = cfg.host.toLowerCase() === "smtp.gmail.com"
        ? "Gmail username එක නිවැරදිද බලන්න. එම ගිණුමේ 2-Step Verification ON කර අලුත් 16-character App Password එකක් සාදා මෙතන Save කරන්න. සාමාන්‍ය Gmail password එක නොවේ."
        : "SMTP username/password සහ එම provider එකේ SMTP access සක්‍රීයද බලන්න. Gmail App Password එක වෙනත් provider එකකට භාවිත කරන්න බැහැ.";
      return { ok: false, method: "smtp", to, error: `SMTP authentication failed (${failure.responseCode ?? (/535/.test(safeMessage) ? 535 : "EAUTH")}) — ${advice}` };
    }
    return { ok: false, method: "smtp", to, error: safeMessage.slice(0, 300) };
  } finally { transporter?.close(); }
}

/** One SMTP sender, many recipients; no secondary provider or silent fallback. */
export async function sendMail(input: {
  to: string | string[]; subject: string; text: string; messageIdSeed?: string;
}): Promise<{ ok: number; failed: MailResult[]; results: MailResult[]; method: "smtp" | "none" }> {
  const list = Array.from(new Set((Array.isArray(input.to) ? input.to : [input.to])
    .map(e => normalizeMailAddress(String(e ?? ""))).filter(validMailAddress)));
  if (!list.length) return { ok: 0, failed: [], results: [], method: "none" };
  const smtp = await loadSmtp();
  if (!smtp) {
    const failed: MailResult[] = list.map(to => ({ ok: false, method: "none", to,
      error: "SMTP configure කරලා නෑ / settings කියවීමට බැරි වුණා — Admin → Emails → Mail Server (SMTP) Save කරන්න" }));
    return { ok: 0, failed, results: failed, method: "none" };
  }
  // Bound parallel connections while continuing after individual recipient failures.
  const results: MailResult[] = [];
  for (let i = 0; i < list.length; i += 3) {
    results.push(...await Promise.all(list.slice(i, i + 3).map(to => sendViaSmtp(smtp, to, input.subject, input.text, input.messageIdSeed))));
  }
  return { ok: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok), results, method: "smtp" };
}
