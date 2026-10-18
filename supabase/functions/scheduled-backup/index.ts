// @ts-nocheck — Deno Edge Function: Next.js type-check එකට අදාළ නෑ (jsr:/Deno globals)
// ============================================================================
// Scheduled auto-backup — Supabase Edge Function (Deno)
// සතියකට වරක් pg_cron එකෙන් කැඳවූ විට සියලු data tables වල INSERT dump එකක්
// private 'backups' storage bucket එකට දානවා (අලුත්ම 8 තියාගන්නවා).
// ⚠ මෙය data-only backup එකකි — images/logins සහිත සම්පූර්ණ backup එකට
//    Admin → Backup & Restore එකෙන් ගන්න ZIP එක භාවිතා කරන්න.
//
// සක්‍රිය කරන හැටි (backup ZIP එකේ RECOVERY.txt එකෙත් ඇත):
//   1) supabase functions deploy scheduled-backup
//   2) supabase secrets set BACKUP_CRON_SECRET=<ඔබේ රහස් වචනය>
//   3) supabase/scheduled-backup.sql එකේ placeholders පුරවා SQL Editor එකේ run කරන්න
// (SUPABASE_URL සහ SUPABASE_SERVICE_ROLE_KEY ස්වයංක්‍රීයව ලැබේ)
// ============================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const TABLES: { name: string; pk: string }[] = [
  { name: "profiles", pk: "id" },
  { name: "member_rows", pk: "id" },
  { name: "voter_rows", pk: "id" },
  { name: "data_files", pk: "id" },
  { name: "data_imports", pk: "id" },
  { name: "membership_applications", pk: "id" },
  { name: "board_members", pk: "id" },
  { name: "business_units", pk: "id" },
  { name: "business_services", pk: "id" },
  { name: "business_contacts", pk: "id" },
  { name: "business_branches", pk: "id" },
  { name: "news", pk: "id" },
  { name: "gallery_items", pk: "id" },
  { name: "gallery_comments", pk: "id" },
  { name: "fuel_prices", pk: "type" },
  { name: "fuel_stock", pk: "id" },
  { name: "system_settings", pk: "key" },
  { name: "notify_emails", pk: "id" },
  { name: "messages", pk: "id" },
  { name: "f28_members", pk: "id" },
  { name: "f28_items", pk: "id" },
  { name: "admin_activity_logs", pk: "id" },
  { name: "backup_secrets", pk: "key" },
  { name: "chat_sessions", pk: "id" },
  { name: "chat_messages", pk: "id" },
  { name: "live_chat_events", pk: "id" },
  // site_images_backup හැර දමයි — images ඇත්තේ site-images storage එකේමය
];
const KEEP = 8;

function sqlVal(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return `'${s.replace(/'/g, "''")}'`;
}
const col = (c: string) => `"${c.replace(/"/g, '""')}"`;

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get("BACKUP_CRON_SECRET") ?? "";
  if (!secret || req.headers.get("x-backup-secret") !== secret) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401 });
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const lines: string[] = [
    "-- Panduwasnuwara New MPCS — SCHEDULED AUTO-BACKUP (data only)",
    `-- Generated: ${new Date().toISOString()}`,
    "-- Restore: schema.sql run කර මෙම file එක run කරන්න (images/logins සදහා ZIP backup එක ගන්න)",
    "",
  ];
  const counts: Record<string, number> = {};
  let total = 0;

  for (const t of TABLES) {
    lines.push(`-- ${t.name}`);
    let n = 0;
    for (let from = 0; from < 2_000_000; from += 1000) {
      const { data, error } = await sb.from(t.name).select("*").range(from, from + 999);
      if (error) {
        lines.push(`-- ⚠ ${t.name}: ${error.message}`);
        break;
      }
      const rows = (data ?? []) as Record<string, unknown>[];
      for (const r of rows) {
        const cols = Object.keys(r);
        if (!cols.length) continue;
        const sets = cols.filter((c) => c !== t.pk).map((c) => `${col(c)} = EXCLUDED.${col(c)}`).join(", ");
        lines.push(
          `INSERT INTO public.${t.name} (${cols.map(col).join(", ")}) VALUES (${cols.map((c) => sqlVal(r[c])).join(", ")})` +
            (sets ? ` ON CONFLICT (${col(t.pk)}) DO UPDATE SET ${sets};` : ` ON CONFLICT (${col(t.pk)}) DO NOTHING;`)
        );
        n++;
      }
      if (rows.length < 1000) break;
    }
    counts[t.name] = n;
    total += n;
    lines.push("");
  }

  const day = new Date().toISOString().slice(0, 10);
  const path = `auto/database-${day}.sql`;
  const { error: upErr } = await sb.storage
    .from("backups")
    .upload(path, new Blob([lines.join("\n")], { type: "text/plain" }), { upsert: true });
  if (upErr) return new Response(JSON.stringify({ ok: false, error: upErr.message }), { status: 500 });

  // අලුත්ම KEEP ගණන තියාගෙන පරණ ඒවා මකයි
  const { data: list } = await sb.storage.from("backups").list("auto", { limit: 100 });
  const names = (list ?? []).map((f) => f.name).filter((n) => n.endsWith(".sql")).sort().reverse();
  const stale = names.slice(KEEP).map((n) => `auto/${n}`);
  if (stale.length) await sb.storage.from("backups").remove(stale);

  return new Response(JSON.stringify({ ok: true, file: path, totalRows: total, counts }), {
    headers: { "Content-Type": "application/json" },
  });
});
