// ============================================================================
//  POST /api/mail/send — site එකේ email එකක් යවන එකම තැන
// ----------------------------------------------------------------------------
//  · SMTP (Gmail App Password) configure කරලා තියෙනවා නම් **SMTP** එකෙන් යයි
//  · **SMTP ONLY**; no fallback provider
//  · Auth: admin/superadmin Bearer token හෝ x-backup-secret (cron)
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { loadSmtp, sendMail } from "@/lib/mail-server";
import { rateLimit, routeEmailsServer, SERVER_MAIL_ROUTES, type ServerMailRoute } from "@/lib/mail-routes-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function cronSecretOk(provided: string): Promise<boolean> {
  if (!provided || !SUPABASE_URL || !SERVICE_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/backup_secrets?select=value&key=eq.backup_cron_secret&limit=1`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const rows = (await res.json()) as { value?: string }[];
    return sameSecret((rows?.[0]?.value ?? "").trim(), provided.trim());
  } catch {
    return false;
  }
}

async function userIsAdmin(token: string): Promise<boolean> {
  if (!SUPABASE_URL || !token) return false;
  try {
    const me = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY || SERVICE_KEY, Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!me.ok) return false;
    const user = (await me.json()) as { id?: string };
    if (!UUID_RE.test(String(user?.id ?? ""))) return false;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(String(user.id))}&limit=1`,
      { headers: { apikey: ANON_KEY || SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY || token}` }, cache: "no-store" }
    );
    if (!res.ok) return false;
    const rows = (await res.json()) as { role?: string }[];
    const role = rows?.[0]?.role ?? "";
    return role === "admin" || role === "superadmin";
  } catch {
    return false;
  }
}

/** GET — Admin card එකේ status එකට (රහස් එවන්නේ නෑ) */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token || !(await userIsAdmin(token))) return json({ ok: false, reason: "forbidden" }, 403);
  const smtp = await loadSmtp();
  return json({
    ok: true,
    smtpConfigured: Boolean(smtp),
    smtp: smtp ? { host: smtp.host, port: smtp.port, user: smtp.user, fromName: smtp.fromName, fromEmail: smtp.fromEmail } : null,
  });
}

export async function POST(req: NextRequest) {
  const cronSecret = (req.headers.get("x-backup-secret") ?? "").trim();
  let authed = false;
  if (cronSecret) {
    if (!(await cronSecretOk(cronSecret))) return json({ ok: false, reason: "unauthorized" }, 401);
    authed = true;
  } else {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (token) {
      if (!(await userIsAdmin(token))) return json({ ok: false, reason: "forbidden" }, 403);
      authed = true;
    }
  }

  type MailBody = { to?: unknown; subject?: unknown; text?: unknown; route?: unknown; only?: unknown } | null;
  let body: MailBody = null;
  try {
    body = (await req.json()) as MailBody;
  } catch {
    return json({ ok: false, reason: "bad_json" }, 400);
  }

  // 🌐 PUBLIC FORMS — ලිපින client එකෙන් එවන්නේ නෑ; server එකේම Admin → Emails වලින් ගන්නවා.
  //    (ඒ නිසා මේක open relay එකක් නොවේ — යවන්න පුළුවන් ලිපින තීරණය වෙන්නේ admin විසින්මයි)
  const wanted = String(body?.route ?? "").trim() as ServerMailRoute;
  if (!authed && wanted) {
    if (!SERVER_MAIL_ROUTES.includes(wanted)) return json({ ok: false, reason: "bad_route" }, 400);
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    if (!rateLimit(ip, wanted)) return json({ ok: false, reason: "rate_limited" }, 429);
    const all = await routeEmailsServer(wanted);
    if (!all.length) return json({ ok: false, reason: "no_recipients" }, 400);
    // 🔒 `only` — client එකේදී යැවීමට නොහැකි වුණු ලිපින විතරක් ඉල්ලන්න පුළුවන්.
    //    නමුත් ඒවා **route එකට දාලා තියෙන ලිපිනම** විය යුතුයි (එහෙනම් විතරයි) — open relay නොවේ.
    const wantedOnly = Array.isArray(body?.only) ? (body.only as unknown[]).map((x) => String(x).trim().toLowerCase()) : [];
    const recipients = wantedOnly.length
      ? all.filter((e) => wantedOnly.includes(e.trim().toLowerCase()))
      : all;
    if (!recipients.length) return json({ ok: false, reason: "no_recipients" }, 400);
    const subject = String(body?.subject ?? "MPCS — පණිවිඩයක්").slice(0, 200);
    const text = String(body?.text ?? "").slice(0, 20_000);
    if (!text) return json({ ok: false, reason: "empty" }, 400);
    const r = await sendMail({ to: recipients, subject, text });
    return json({ ok: r.ok > 0, sent: r.ok, method: r.method, failed: r.failed.map((f) => ({ to: f.to, error: f.error })) }, r.ok > 0 ? 200 : 502);
  }

  if (!authed) return json({ ok: false, reason: "unauthorized" }, 401);
  const to = Array.isArray(body?.to) ? (body?.to as unknown[]).map(String) : [String(body?.to ?? "")];
  const subject = String(body?.subject ?? "").slice(0, 200);
  const text = String(body?.text ?? "").slice(0, 20_000);
  if (!subject || !text) return json({ ok: false, reason: "missing_subject_or_text" }, 400);

  const result = await sendMail({ to, subject, text });
  return json(
    {
      ok: result.ok > 0,
      sent: result.ok,
      method: result.method,
      failed: result.failed.map((f) => ({ to: f.to, error: f.error, method: f.method })),
    },
    result.ok > 0 ? 200 : 502
  );
}
