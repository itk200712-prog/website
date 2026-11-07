// ============================================================================
//  /api/mail/settings — Admin → Emails → “Mail Server (SMTP)” card
// ----------------------------------------------------------------------------
//  GET  → දැනට තියෙන සැකසුම (password එක එවන්නේ නෑ — තියෙනවද කියා විතරයි)
//  POST → host/port/user/app-password/from save (service-role → backup_secrets)
//  Auth: admin/superadmin Bearer token
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { loadSmtp, saveSmtp, sendMail } from "@/lib/mail-server";

export const runtime = "nodejs";
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
    ok: true,
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

  // 🧪 test send — configure කරලා තියෙන SMTP එකෙන් ලිපිනයකට යවලා බලනවා
  if (body?.testTo) {
    const r = await sendMail({
      to: String(body.testTo),
      subject: "✅ MPCS mail test — SMTP හරි",
      text: "මේ email එක Panduwasnuwara MPCS site එකේ Mail Server (SMTP) සැකසුම පරීක්ෂා කරන්න යැව්වා.\n\nSMTP වැඩ කරනවා ✅",
    });
    return json(
      { ok: r.ok > 0, sent: r.ok, method: r.method, failed: r.failed.map((f) => ({ to: f.to, error: f.error })) },
      r.ok > 0 ? 200 : 502
    );
  }

  const err = await saveSmtp({
    host: body?.host ? String(body.host) : undefined,
    port: body?.port ? Number(body.port) : undefined,
    user: body?.user ? String(body.user) : undefined,
    pass: body?.pass ? String(body.pass) : undefined,
    fromName: body?.fromName ? String(body.fromName) : undefined,
    fromEmail: body?.fromEmail ? String(body.fromEmail) : undefined,
    secure: typeof body?.secure === "boolean" ? (body.secure as boolean) : undefined,
  });
  if (err) return json({ ok: false, reason: err }, 500);
  const smtp = await loadSmtp();
  return json({ ok: true, configured: Boolean(smtp), host: smtp?.host ?? "", port: smtp?.port ?? 465, user: smtp?.user ?? "" });
}
