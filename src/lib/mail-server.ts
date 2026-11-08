// Server-side mail: per-email SilentForms key mapping + per-recipient SMTP fallback.
// Keys live only in backup_secrets and are included in the existing full backup.
// The global/default key is legacy manual test only, never a recipient fallback.

import nodemailer from "nodemailer";
import {
  MAIL_PROVIDER_SETTING,
  SILENTFORMS_KEY_SETTING,
  resolveSilentFormsKey,
  postToSilentForms,
  type MailProvider,
  looksLikeAccessKey,
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
    try {
      const j = (await res.json()) as { message?: string; details?: string; hint?: string; code?: string };
      detail = [j?.message, j?.code, j?.hint].filter(Boolean).join(" · ").slice(0, 240);
    } catch {
      detail = (await res.text().catch(() => "")).slice(0, 240);
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
  return upsertSecretRows(rows);
}

/** Rate-limit/network cooldown is scoped to one key, never all recipients. */
const SF_DOWN_FOR_MS = 15 * 60 * 1000;
const sfDownUntil = new Map<string, number>();
function silentFormsDown(key: string): boolean {
  const until = sfDownUntil.get(key) ?? 0;
  if (Date.now() < until) return true;
  sfDownUntil.delete(key);
  return false;
}
function markSilentFormsDown(key: string): void {
  if (sfDownUntil.size > 500) sfDownUntil.clear();
  sfDownUntil.set(key, Date.now() + SF_DOWN_FOR_MS);
}
function clearSilentFormsDown(key: string): void { sfDownUntil.delete(key); }

export const RECIPIENT_KEY_PREFIX = "silentforms_recipient:";
export function normalizeMailAddress(email: string): string { return email.trim().toLowerCase(); }
const validMailAddress = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;

/** Server-only: each address has its own row, so independent saves cannot overwrite others. */
export async function loadRecipientKeys(): Promise<Map<string, string>> {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("server_not_configured");
  const query = new URLSearchParams({ select: "key,value", key: `like.${RECIPIENT_KEY_PREFIX}*` });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/backup_secrets?${query}`, { headers: svcHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`recipient_keys_load_failed (${res.status})`);
  const rows = await res.json() as { key: string; value: string }[];
  const out = new Map<string, string>();
  for (const row of rows) {
    const email = normalizeMailAddress(row.key.slice(RECIPIENT_KEY_PREFIX.length));
    if (row.key.startsWith(RECIPIENT_KEY_PREFIX) && validMailAddress(email) && looksLikeAccessKey(row.value)) out.set(email, row.value.trim());
  }
  return out;
}

/** No access keys leave the server; configured means saved, not inbox verified. */
export async function recipientKeyMetadata() {
  return Object.fromEntries(Array.from(await loadRecipientKeys(), ([email, key]) => [email, {
    configured: true, preview: `${key.slice(0, 4)}…${key.slice(-4)}`,
  }]));
}

export async function saveRecipientKey(emailInput: string, accessKey: string): Promise<string | null> {
  const email = normalizeMailAddress(emailInput);
  const key = accessKey.trim();
  if (!validMailAddress(email)) return "invalid_recipient_email";
  if (key && !looksLikeAccessKey(key)) return "invalid_access_key";
  // Empty value is an explicit removal, not a fallback to the unrelated global key.
  const error = await upsertSecretRows([{ key: RECIPIENT_KEY_PREFIX + email, value: key }]);
  if (!error && key) clearSilentFormsDown(key);
  return error;
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
  const rows: { key: string; value: string }[] = [];
  if (input.accessKey !== undefined) {
    rows.push({ key: SILENTFORMS_KEY_SETTING, value: String(input.accessKey).trim() });
  }
  if (input.provider !== undefined) {
    rows.push({ key: MAIL_PROVIDER_SETTING, value: input.provider === "smtp" ? "smtp" : "silentforms" });
  }
  return upsertSecretRows(rows);
}

/** Each recipient uses ONLY its mapped key. Global key is an explicit legacy test override. */
export async function sendViaSilentForms(
  to: string[], subject: string, text: string, keyOverride?: string
): Promise<MailResult[]> {
  const addresses = Array.from(new Set(to.map(normalizeMailAddress).filter(validMailAddress)));
  let keys: Map<string, string>;
  try { keys = keyOverride ? new Map(addresses.map(email => [email, keyOverride])) : await loadRecipientKeys(); }
  catch (error) { return addresses.map(to => ({ ok: false, method: "silentforms", to, error: (error as Error).message })); }
  return Promise.all(addresses.map(async (to): Promise<MailResult> => {
    const key = keys.get(to);
    if (!key) return { ok: false, method: "silentforms", to, error: "මේ email එකේ SilentForms key එක නෑ — Admin → Emails → එම email පේළියේ Save key කරන්න" };
    if (silentFormsDown(key)) return { ok: false, method: "silentforms", to, error: "This key is temporarily rate-limited / unavailable; retry later or configure SMTP" };
    const result = await postToSilentForms(key, {
      _subject: subject, from_name: "Panduwasnuwara MPCS", form: "MPCS · system mail",
      "To (configured)": to, message: text,
    });
    if (result.ok) clearSilentFormsDown(key);
    else if (!result.statusCode || result.statusCode === 429 || result.statusCode >= 500) markSilentFormsDown(key);
    return { ok: result.ok, method: "silentforms", to, ...(result.ok ? {} : { error: result.error ?? "SilentForms failed" }) };
  }));
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
    const info = await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to,
      subject,
      text,
    });
    if (!Array.isArray(info.accepted) || info.accepted.length === 0) {
      return { ok: false, method: "smtp", to, error: "SMTP server did not accept the recipient" };
    }
    return { ok: true, method: "smtp", to };
  } catch (e) {
    const msg = (e as Error).message || "SMTP error";
    return { ok: false, method: "smtp", to, error: msg.slice(0, 300) };
  }
}

/** Try providers per pending recipient only. A partial success never drops the others. */
export async function sendMail(input: {
  to: string | string[]; subject: string; text: string;
}): Promise<{ ok: number; failed: MailResult[]; results: MailResult[]; method: "smtp" | "silentforms" | "mixed" | "none" }> {
  const list = Array.from(new Set((Array.isArray(input.to) ? input.to : [input.to])
    .map(e => normalizeMailAddress(String(e ?? ""))).filter(validMailAddress)));
  if (!list.length) return { ok: 0, failed: [], results: [], method: "none" };
  const settings = await loadMailSettings();
  const order: MailProvider[] = settings.provider === "smtp" ? ["smtp", "silentforms"] : ["silentforms", "smtp"];
  const smtp = await loadSmtp();
  const final = new Map<string, MailResult>();
  for (const step of order) {
    const pending = list.filter(email => !final.get(email)?.ok);
    if (!pending.length) break;
    let attempts: MailResult[];
    if (step === "silentforms") attempts = await sendViaSilentForms(pending, input.subject, input.text);
    else if (smtp) attempts = await Promise.all(pending.map(to => sendViaSmtp(smtp, to, input.subject, input.text)));
    else continue;
    for (const result of attempts) {
      const previous = final.get(result.to);
      final.set(result.to, result.ok || !previous ? result : { ...result, error: `${previous.error ?? "Previous provider failed"}; ${result.error ?? "Provider failed"}` });
    }
  }
  const results = list.map(to => final.get(to) ?? { ok: false, method: "none" as const, to, error: "No configured mail provider" });
  const successes = results.filter(r => r.ok);
  const methods = new Set(successes.map(r => r.method));
  const method = methods.size > 1 ? "mixed" : successes[0]?.method ?? results[0]?.method ?? "none";
  return { ok: successes.length, failed: results.filter(r => !r.ok), results, method };
}
