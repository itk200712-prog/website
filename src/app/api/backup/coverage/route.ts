// ============================================================================
//  GET /api/backup/coverage — Backup Coverage check (Admin → Backup & Restore)
// ----------------------------------------------------------------------------
//  "site එකේ හැම දෙයක්ම backup එකට එනවද?" කියා Admin එකේ පෙන්වන්න මේ route එකෙන්
//  ගණන් දෙනවා:
//    · images        → `site-images` storage bucket එකේ files ගාණ (recursive)
//    · siteAssets    → public/ icons/photos/fonts ගාණ (auto manifest)
//    · siteSource    → backup එකට යන design/source files ගාණ
//  (tables වල row ගණන Admin page එකේදීම client එකෙන් `head: true` count වලින් එයි)
//
//  Auth: admin/superadmin Bearer token හෝ x-backup-secret (scheduled backup)
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { SITE_PACKAGE_VERSION, SITE_SOURCE_FILES } from "@/lib/site-source.generated";
import { PUBLIC_ASSET_FILES } from "@/lib/public-assets.generated";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const CRON_KEY = "backup_cron_secret";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FILES = 5000;

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

async function secretOk(provided: string): Promise<boolean> {
  if (!provided || !SUPABASE_URL || !SERVICE_KEY) return false;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/backup_secrets?select=value&key=eq.${CRON_KEY}&limit=1`,
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

/** `site-images` bucket එකේ files ගණන (folders recursive, උපරිම 5000) */
async function countStorageImages(): Promise<number> {
  if (!SUPABASE_URL || !SERVICE_KEY) return 0;
  let count = 0;
  async function walk(prefix: string, depth: number): Promise<void> {
    if (depth > 6 || count >= MAX_FILES) return;
    for (let offset = 0; offset < MAX_FILES; offset += 100) {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/site-images`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefix, limit: 100, offset, sortBy: { column: "name", order: "asc" } }),
        cache: "no-store",
      });
      if (!res.ok) return;
      const items = (await res.json()) as { name: string; id: string | null }[];
      if (!items.length) return;
      for (const f of items) {
        const path = prefix ? `${prefix}/${f.name}` : f.name;
        if (f.id === null) await walk(path, depth + 1);
        else count += 1;
        if (count >= MAX_FILES) return;
      }
      if (items.length < 100) return;
    }
  }
  try {
    await walk("", 0);
  } catch {
    /* list නොහැකි නම් 0 */
  }
  return count;
}

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL) return deny(401);

  const cronSecret = (req.headers.get("x-backup-secret") ?? "").trim();
  if (cronSecret) {
    if (!(await secretOk(cronSecret))) return deny(401);
  } else {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!token || !(await userIsAdmin(token))) return deny(token ? 403 : 401);
  }

  const images = await countStorageImages();
  return NextResponse.json(
    {
      ok: true,
      images,
      siteAssets: PUBLIC_ASSET_FILES.length,
      siteSource: SITE_SOURCE_FILES.length,
      sitePackageVersion: SITE_PACKAGE_VERSION,
      checkedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } }
  );
}
