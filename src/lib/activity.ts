// ============================================================================
// Admin Activities — action logger (fire-and-forget) + txt export
// ============================================================================

import { authedClient } from "@/lib/supabase/client";

export type ActivityLog = {
  id: string;
  actor: string;
  actor_role: string;
  action: string;
  detail: string;
  created_at: string;
};

/** හැම admin ක්‍රියාවක්ම සටහන් කරයි — blocking නෑ (fire-and-forget) */
export async function logActivity(action: string, detail = "") {
  try {
    const sb = await authedClient();
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return;
    const { data: prof } = await sb
      .from("profiles")
      .select("full_name, role")
      .eq("id", u.user.id)
      .maybeSingle();
    await sb.from("admin_activity_logs").insert({
      actor: prof?.full_name || u.user.email || "admin",
      actor_role: prof?.role ?? "",
      action,
      detail: detail.slice(0, 500),
    });
  } catch {
    /* logging එක fail වුණත් ප්‍රධාන වැඩේ යනවා */
  }
}

/** log එක txt file එකක් විදියට download කරයි */
export function downloadLogsTxt(logs: ActivityLog[]) {
  const lines = [
    "Panduwasnuwara New MPCS — Admin Activity Log",
    `Generated: ${new Date().toLocaleString()}`,
    `Total entries: ${logs.length}`,
    "=".repeat(72),
    ...logs.map((l) => {
      const when = new Date(l.created_at).toLocaleString();
      return `[${when}] ${(l.actor || "unknown").toUpperCase()} (${l.actor_role || "-"}) — ${l.action} — ${l.detail || ""}`;
    }),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}
