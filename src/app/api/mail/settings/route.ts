// Admin-only SMTP settings and test endpoint. Passwords are never returned.
import { NextRequest, NextResponse } from "next/server";
import { loadSmtp, saveSmtp, sendMail, cleanupRetiredMailSettings } from "@/lib/mail-server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
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

async function auth(req: NextRequest): Promise<boolean> {
  const h = req.headers.get("authorization") ?? "";
  const token = h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
  return Boolean(token) && (await userIsAdmin(token));
}

export async function GET(req: NextRequest) {
  if (!(await auth(req))) return json({ ok: false, reason: "forbidden" }, 403);
  const smtp = await loadSmtp();
  return json({
    ok: true, provider: "smtp",
    configured: Boolean(smtp),
    host: smtp?.host ?? "",
    port: smtp?.port ?? 465,
    user: smtp?.user ?? "",
    fromName: smtp?.fromName ?? "Panduwasnuwara MPCS",
    fromEmail: smtp?.fromEmail ?? "",
    hasPassword: Boolean(smtp?.pass),
  });
}

export async function POST(req: NextRequest) {
  if (!(await auth(req))) return json({ ok: false, reason: "forbidden" }, 403);
  let body: Record<string, unknown> | null = null;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, reason: "bad_json" }, 400);
  }

  if (!body || Array.isArray(body)) return json({ ok: false, reason: "bad_json_object" }, 400);
  const allowed = new Set(["host", "port", "user", "pass", "fromName", "fromEmail", "secure", "testTo"]);
  if (Object.keys(body).some(key => !allowed.has(key))) return json({ ok: false, reason: "unsupported_fields — SMTP settings only" }, 400);
  if (Object.keys(body).length === 0) return json({ ok: false, reason: "empty_settings" }, 400);

  if (body.testTo !== undefined) {
    const to = String(body.testTo).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return json({ ok: false, reason: "invalid_test_email" }, 400);
    const result = await sendMail({
      to, subject: `MPCS SMTP test — ${new Date().toISOString()}`,
      text: `Panduwasnuwara MPCS — SMTP mail test.\nRecipient: ${to}\nSMTP server acceptance does not guarantee inbox delivery. Check Inbox / Spam / All Mail.`,
    });
    return json({ ok: result.ok > 0, sent: result.ok, method: result.method, delivery: "unconfirmed",
      notice: result.ok ? `SMTP server accepted mail for ${to} — Inbox / Spam බලන්න; instant delivery සහතික කළ නොහැක.` : undefined,
      failed: result.failed.map(({ to, error }) => ({ to, error })),
    }, result.ok > 0 ? 200 : 502);
  }
  for (const key of ["host", "user", "pass", "fromName", "fromEmail"]) {
    if (body[key] !== undefined && typeof body[key] !== "string") return json({ ok: false, reason: `invalid_${key}` }, 400);
  }
  const emailValid = (v: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? "").trim());
  if (body.host !== undefined && !/^[a-zA-Z0-9.-]{1,253}$/.test(String(body.host).trim())) return json({ ok: false, reason: "invalid_host" }, 400);
  if (body.user !== undefined && !String(body.user).trim()) return json({ ok: false, reason: "invalid_user" }, 400);
  if (body.fromEmail !== undefined && String(body.fromEmail).trim() && !emailValid(body.fromEmail)) return json({ ok: false, reason: "invalid_from_email" }, 400);
  if (body.port !== undefined && (!Number.isInteger(Number(body.port)) || Number(body.port) < 1 || Number(body.port) > 65535)) return json({ ok: false, reason: "invalid_port" }, 400);
  if (body.secure !== undefined && typeof body.secure !== "boolean") return json({ ok: false, reason: "invalid_secure" }, 400);
  const port = body.port === undefined ? undefined : Number(body.port);
  const host = body.host === undefined ? undefined : String(body.host).trim();
  let pass = body.pass ? String(body.pass) : undefined; // blank preserves saved password
  if (host?.toLowerCase() === "smtp.gmail.com" && pass) pass = pass.replace(/\s/g, "");
  if (!pass) pass = undefined;
  const error = await saveSmtp({
    host, port, user: body.user === undefined ? undefined : String(body.user).trim(), pass,
    fromName: body.fromName === undefined ? undefined : String(body.fromName).trim(),
    fromEmail: body.fromEmail === undefined ? undefined : String(body.fromEmail).trim(),
    secure: port === 465 ? true : port === 587 ? false : typeof body.secure === "boolean" ? body.secure : undefined,
  });
  if (error) return json({ ok: false, reason: error }, 500);
  const legacyCleaned = await cleanupRetiredMailSettings();
  const smtp = await loadSmtp();
  return json({ ok: true, provider: "smtp", configured: Boolean(smtp), host: smtp?.host ?? "", port: smtp?.port ?? 465,
    user: smtp?.user ?? "", legacyCleaned,
    warning: legacyCleaned ? undefined : "SMTP saved. Old unused mail settings cleanup failed; saving again will retry.",
  });
}
