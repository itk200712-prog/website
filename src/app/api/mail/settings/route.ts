// ============================================================================
//  /api/mail/settings — Admin → Emails → “SilentForms” + “Mail Server (SMTP)” cards
// ----------------------------------------------------------------------------
//  GET  → දැනට තියෙන සැකසුම (password/access key එවන්නේ නෑ — තියෙනවද + masked preview)
//  POST → { accessKey?, provider? } SilentForms සැකසුම · host/port/user/pass/from SMTP
//         (service-role → backup_secrets — backup එකට ඉබේම එකතු වේ)
//  POST → { recipientEmail, recipientAccessKey } per-email key; { testTo, testProvider } isolated test
//  Auth: admin/superadmin Bearer token
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { loadMailSettings, loadSmtp, saveMailSettings, saveSmtp, sendMail, sendViaSilentForms, sendViaSmtp, recipientKeyMetadata, saveRecipientKey } from "@/lib/mail-server";

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
  const sf = await loadMailSettings();
  const key = sf.key;
  let recipientKeys;
  try { recipientKeys = await recipientKeyMetadata(); }
  catch { return json({ ok: false, reason: "recipient_keys_load_failed" }, 503); }
  return json({
    ok: true,
    silentforms: {
      configured: sf.saved,       // admin save කරපු key එකක් තියෙනවද
      saved: sf.saved,
      usingDefault: !sf.saved && Boolean(key),
      provider: sf.provider,
      preview: key ? `${key.slice(0, 8)}…${key.slice(-6)}` : "",
      length: key.length,
    },
    recipientKeys,
    provider: sf.provider,
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

  // Separate row per normalized email; auth is checked before all secret operations.
  if (body?.recipientEmail !== undefined) {
    if (typeof body.recipientEmail !== "string" || typeof body.recipientAccessKey !== "string") return json({ ok: false, reason: "invalid_recipient_key_payload" }, 400);
    const error = await saveRecipientKey(body.recipientEmail, body.recipientAccessKey);
    if (error) return json({ ok: false, reason: error }, error.startsWith("invalid_") ? 400 : 500);
    try { return json({ ok: true, recipientKeys: await recipientKeyMetadata() }); }
    catch { return json({ ok: false, reason: "Saved, but metadata refresh failed. Refresh page." }, 503); }
  }

  // 🧪 test send — configure කරලා තියෙන SMTP එකෙන් ලිපිනයකට යවලා බලනවා
  if (body?.testTo) {
    const to = String(body.testTo).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return json({ ok: false, reason: "invalid_test_email" }, 400);
    const testProvider = body.testProvider;
    if (testProvider !== undefined && testProvider !== "smtp" && testProvider !== "silentforms") {
      return json({ ok: false, reason: "invalid_test_provider" }, 400);
    }
    const subject = `MPCS mail test — ${new Date().toISOString()}`;
    const text = `Panduwasnuwara MPCS mail test. Requested address: ${to}\n` +
      "SilentForms delivers only to the key owner and dashboard-confirmed extra recipients. " +
      "API acceptance is not proof of inbox delivery. Check Email me every submission, confirmation, Spam and All Mail.";
    let r;
    // Test the selected card itself. Never hide SMTP errors behind SilentForms success.
    if (testProvider === "smtp") {
      const smtp = await loadSmtp();
      if (!smtp) return json({ ok: false, reason: "SMTP configure කර Save කරන්න. Gmail App Password අවශ්‍යයි." }, 400);
      const result = await sendViaSmtp(smtp, to, subject, text);
      r = { ok: result.ok ? 1 : 0, method: "smtp", failed: result.ok ? [] : [result] };
    } else if (testProvider === "silentforms") {
      const legacyKey = body.useGlobalKey === true ? (await loadMailSettings()).key : undefined;
      const results = await sendViaSilentForms([to], subject, text, legacyKey);
      r = { ok: results.filter(x => x.ok).length, method: "silentforms", failed: results.filter(x => !x.ok) };
    } else {
      r = await sendMail({ to, subject, text });
    }
    const notice = r.method === "silentforms"
      ? (body.useGlobalKey === true
        ? "Legacy global-key submission accepted — goes to that key owner, not necessarily the typed email. Inbox delivery unconfirmed."
        : "SilentForms submission accepted — inbox delivery තහවුරු නෑ. මේ email එකට අදාළ key එකම save කළ බව බලන්න. SilentForms → Email me every submission ON → Inbox / Spam බලන්න.")
      : r.method === "mixed" ? "SilentForms + SMTP accepted pending recipients; inbox delivery unconfirmed."
      : `SMTP server accepted mail for ${to} — inbox / Spam බලන්න; instant delivery සහතික කළ නොහැක.`;
    return json(
      { ok: r.ok > 0, sent: r.ok, method: r.method, delivery: "unconfirmed", notice, failed: r.failed.map((f) => ({ to: f.to, error: f.error })) },
      r.ok > 0 ? 200 : 502
    );
  }

  // 📨 SilentForms access key / provider save
  if (body?.accessKey !== undefined || body?.provider !== undefined) {
    const accessKey = body?.accessKey === undefined ? undefined : String(body.accessKey ?? "").trim();
    if (accessKey !== undefined && accessKey !== "" && !/^[a-zA-Z0-9_-]{16,128}$/.test(accessKey)) {
      return json({ ok: false, reason: "invalid_access_key" }, 400);
    }
    const provider = body?.provider === undefined ? undefined : String(body.provider) === "smtp" ? "smtp" as const : "silentforms" as const;
    const mkErr = await saveMailSettings({ accessKey, provider });
    if (mkErr) return json({ ok: false, reason: mkErr }, 500);
    const after = await loadMailSettings();
    return json({
      ok: true,
      silentforms: {
        configured: after.saved,
        saved: after.saved,
        usingDefault: !after.saved && Boolean(after.key),
        provider: after.provider,
        preview: after.key ? `${after.key.slice(0, 8)}…${after.key.slice(-6)}` : "",
        length: after.key.length,
      },
    });
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
