// ============================================================================
//  POST /api/admin-reset-password — admin කෙනෙක්ට වෙනත් ගිණුමක password reset
//  Browser එකෙන් කෙලින්ම වෙනත් අයෙකුගේ Auth password එක වෙනස් කරන්න බෑ —
//  ඒ නිසා මේ server route එක Vercel env එකේ SUPABASE_SERVICE_ROLE_KEY එකෙන්
//  Supabase Auth Admin API එක හරහා කරනවා. Key එක browser එකට එන්නේ නෑ.
//
//  නීතිය (src/lib/root-admin.ts):
//   · member (user) ගිණුම් — ඕනෑම admin/superadmin කෙනෙක්ට reset පුළුවන්
//   · admin/superadmin ගිණුම් — මුල සිටම සිටි original (root) superadmin ට විතරයි
//   · තමන්ගේම password එක මෙයින් බෑ — Admin → Profile එකෙන් කරන්න
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { canResetPassword, isAdminRole, pickRootAdminId, type AccountLike } from "@/lib/root-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function sameOrigin(req: NextRequest): boolean {
  const source = req.headers.get("origin") || req.headers.get("referer");
  if (!source) return process.env.NODE_ENV !== "production";
  try {
    const host = (req.headers.get("x-forwarded-host") || req.nextUrl.host).split(",")[0].trim();
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

const hits = new Map<string, number[]>();
function rateLimited(req: NextRequest): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 20;
}

function supabaseBase(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
}

async function fetchJson(url: string, init: RequestInit): Promise<{ status: number; data: unknown }> {
  try {
    const res = await fetch(url, { ...init, cache: "no-store" });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* හිස් response එකක් වෙන්න පුළුවන් */
    }
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

async function restRows(path: string, serviceKey: string): Promise<Record<string, unknown>[] | null> {
  const base = supabaseBase();
  if (!base) return null;
  const { status, data } = await fetchJson(`${base}/rest/v1/${path}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (status < 200 || status >= 300 || !Array.isArray(data)) return null;
  return data as Record<string, unknown>[];
}

async function loadAccounts(serviceKey: string): Promise<AccountLike[] | null> {
  const rows = await restRows("profiles?select=id,role,joined_date,nic,auth_email", serviceKey);
  if (!rows) return null;
  const accounts = rows as AccountLike[];
  // is_root_admin column එක තියෙනවා නම් ඒ ලකුණත් ගන්නවා (නැත්නම් seed/පැරණිම එක අනුව හොයයි)
  const flags = await restRows("profiles?select=id,is_root_admin&is_root_admin=eq.true", serviceKey);
  if (flags) {
    const flagged = new Set(flags.map((r) => String(r.id ?? "")));
    for (const a of accounts) if (a.id && flagged.has(a.id)) a.is_root_admin = true;
  }
  return accounts;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, reason: "forbidden" }, 403);
  if (rateLimited(req)) return json({ ok: false, reason: "rate_limited" }, 429);

  const base = supabaseBase();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!base || !serviceKey) return json({ ok: false, reason: "server_not_configured" }, 503);

  const authHeader = req.headers.get("authorization") || "";
  const accessToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!accessToken) return json({ ok: false, reason: "unauthorized" }, 401);

  let body: { targetId?: unknown; newPassword?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ ok: false, reason: "bad_request" }, 400);
  }
  const targetId = typeof body.targetId === "string" ? body.targetId.trim() : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (!UUID_RE.test(targetId)) return json({ ok: false, reason: "bad_request" }, 400);
  if (newPassword.length < 8 || newPassword.length > 72 || /[\r\n]/.test(newPassword)) {
    return json({ ok: false, reason: "weak_password" }, 400);
  }

  // කවුද මේ ඉල්ලීම කරන්නේ කියා access token එකෙන් තහවුරු කරනවා
  const me = await fetchJson(`${base}/auth/v1/user`, {
    headers: { apikey: anonKey || serviceKey, Authorization: `Bearer ${accessToken}` },
  });
  const actorId = String((me.data as { id?: unknown } | null)?.id ?? "");
  if (me.status < 200 || me.status >= 300 || !UUID_RE.test(actorId)) {
    return json({ ok: false, reason: "unauthorized" }, 401);
  }

  const accounts = await loadAccounts(serviceKey);
  if (!accounts) return json({ ok: false, reason: "profile_load_failed" }, 500);
  const actor = accounts.find((a) => a.id === actorId) ?? null;
  const target = accounts.find((a) => a.id === targetId) ?? null;
  if (!actor || !isAdminRole(actor.role)) return json({ ok: false, reason: "forbidden" }, 403);
  if (!target) return json({ ok: false, reason: "not_found" }, 404);
  if (actor.id === target.id) return json({ ok: false, reason: "self_reset_use_profile" }, 400);

  const rootId = pickRootAdminId(accounts);
  if (!canResetPassword(actor, target, rootId)) {
    return json({ ok: false, reason: "protected_admin" }, 403);
  }

  // 1) ඇත්ත login password එක (Supabase Auth Admin API)
  const authUpdate = await fetchJson(`${base}/auth/v1/admin/users/${encodeURIComponent(targetId)}`, {
    method: "PUT",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: newPassword, email_confirm: true }),
  });
  if (authUpdate.status < 200 || authUpdate.status >= 300) {
    return json({ ok: false, reason: "auth_update_failed", status: authUpdate.status || undefined }, 502);
  }

  // 2) Admin ලාට පේන password_display එකත් sync කරනවා (base64)
  const display = Buffer.from(newPassword, "utf8").toString("base64");
  const profileUpdate = await fetchJson(`${base}/rest/v1/profiles?id=eq.${encodeURIComponent(targetId)}`, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ password_display: display }),
  });
  if (profileUpdate.status < 200 || profileUpdate.status >= 300) {
    return json({ ok: false, reason: "profile_update_failed", status: profileUpdate.status || undefined }, 502);
  }

  return json({ ok: true, targetRole: target.role ?? "member" });
}
