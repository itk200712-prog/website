import { NextRequest, NextResponse } from "next/server";
import { loadBackupDiagnostics } from "@/lib/backup-diagnostics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const CRON_SECRET_KEY = "backup_cron_secret";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function deny(status = 403) {
  return NextResponse.json(
    { ok: false, reason: status === 401 ? "unauthorized" : "forbidden" },
    { status, headers: { "Cache-Control": "no-store" } }
  );
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
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/backup_secrets?select=value&key=eq.${CRON_SECRET_KEY}&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store" }
    );
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
    const key = SERVICE_KEY || token;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(String(user.id))}&limit=1`,
      { headers: { apikey: ANON_KEY || SERVICE_KEY, Authorization: `Bearer ${key}` }, cache: "no-store" }
    );
    if (!res.ok) return false;
    const rows = (await res.json()) as { role?: string }[];
    const role = rows?.[0]?.role ?? "";
    return role === "superadmin";
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL) return deny(401);

  const cronSecret = (req.headers.get("x-backup-secret") ?? "").trim();
  if (cronSecret) {
    if (!(await cronSecretOk(cronSecret))) return deny(401);
  } else {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!token || !(await userIsAdmin(token))) return deny(token ? 403 : 401);
  }


  try { return NextResponse.json(await loadBackupDiagnostics(), { headers: { "Cache-Control": "no-store, private" } }); }
  catch { return NextResponse.json({ ok: false, reason: "diagnostics_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
