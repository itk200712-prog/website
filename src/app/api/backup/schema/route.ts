// ============================================================================
//  GET /api/backup/schema — canonical supabase/schema.sql (සර්වර් එකේ විතරයි)
//
//  ඇයි මේ route එක?
//    කලින් `src/lib/backup.ts` එකේ `await import("../../supabase/schema.sql")`
//    එකෙන් schema.sql එකේ මුළු text එකම **browser bundle** එකට ගියා.
//    ඒකේ seed/deep-link passwords (superadmin default password, backup default
//    passwords) තියෙන නිසා ඒවා client JS එකෙන් කියවන්න පුළුවන් වුණා.
//    දැන් schema එක server chunk එකේ විතරයි — backup ZIP එකට ඕන වුණාම
//    superadmin කෙනෙක් මේ route එකෙන් ගන්නවා (session token එකෙන් verify වේ).
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
// `.sql` files next.config.ts loader එකෙන් string එකක් ලෙස import වේ (server bundle එකේ විතරයි)
import schemaSql from "../../../../../supabase/schema.sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function deny(status = 403) {
  return NextResponse.json(
    { ok: false, reason: status === 401 ? "unauthorized" : "forbidden" },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token || !SUPABASE_URL) return deny(401);

  // 1) token එකේ අයිතිකරු කවුද?
  let userId = "";
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY || SERVICE_KEY, Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return deny(401);
    const user = (await res.json()) as { id?: string };
    userId = String(user?.id ?? "");
  } catch {
    return deny(401);
  }
  if (!UUID_RE.test(userId)) return deny(401);

  // 2) ඒ user admin/superadmin ද? (service key තියෙනවා නම් service key එකෙන්, නැත්තං ඒ අයගේම token එකෙන් — RLS)
  try {
    const key = SERVICE_KEY || token;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(userId)}&limit=1`,
      { headers: { apikey: ANON_KEY || SERVICE_KEY, Authorization: `Bearer ${key}` }, cache: "no-store" }
    );
    if (!res.ok) return deny();
    const rows = (await res.json()) as { role?: string }[];
    const role = rows?.[0]?.role ?? "";
    if (role !== "admin" && role !== "superadmin") return deny();
  } catch {
    return deny();
  }

  const text = typeof schemaSql === "string" ? schemaSql : String(schemaSql ?? "");
  if (text.length < 500) return NextResponse.json({ ok: false, reason: "schema_missing" }, { status: 500 });
  return new NextResponse(text, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
