"use client";

// ============================================================================
// Activities — See Log: සියලුම admin ක්‍රියා සටහන් (all admins can view;
// txt download = superadmin only)
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { Download, ListOrdered, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { AdminTopbar, useNotice } from "@/components/admin";
import { authedClient } from "@/lib/supabase/client";
import { downloadLogsTxt, type ActivityLog } from "@/lib/activity";

const ACTION_COLORS: Record<string, string> = {
  INSERT: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-amber-100 text-amber-700",
  UPSERT: "bg-indigo-100 text-indigo-700",
  DELETE: "bg-rose-100 text-rose-700",
  LOGIN: "bg-sky-100 text-sky-700",
  BACKUP_DOWNLOAD: "bg-purple-100 text-purple-700",
  BACKUP_IMPORT: "bg-purple-100 text-purple-700",
  PASSWORD_CHANGE: "bg-orange-100 text-orange-700",
  DATA_IMPORT: "bg-teal-100 text-teal-700",
};

export default function AdminActivitiesPage() {
  const { show, node } = useNotice();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string | null>(null);

  async function load() {
    const sb = await authedClient();
    const { data: u } = await sb.auth.getUser();
    if (u?.user) {
      const { data: prof } = await sb.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
      setRole(prof?.role ?? "member");
    }
    const { data } = await sb
      .from("admin_activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setLogs((data as ActivityLog[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return logs;
    return logs.filter(
      (l) =>
        l.action.toLowerCase().includes(s) ||
        l.actor.toLowerCase().includes(s) ||
        (l.detail ?? "").toLowerCase().includes(s)
    );
  }, [q, logs]);

  return (
    <div>
      <AdminTopbar title="Activities" sub="See Log — every action performed by site administrators, with date & time" />
      {node}

      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2.5">
            <ListOrdered size={19} className="text-indigo-700" /> See Log
            <span className="badge-blue rounded-full px-2.5 py-0.5 text-[10.5px] font-bold">{logs.length} entries</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="field !pl-9 !w-auto min-w-[220px]" placeholder="Search actions / admins…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className="btn btn-outline !py-2 !px-3.5 !text-[12px]" onClick={load}>
              <RefreshCw size={13} /> Refresh
            </button>
            {role === "superadmin" ? (
              <button className="btn btn-primary !py-2 !px-3.5 !text-[12px]" onClick={() => downloadLogsTxt(filtered)}>
                <Download size={13} /> Download Log (.txt)
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
                <ShieldCheck size={13} /> .txt download — superadmin පමණි
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-2 max-h-[640px] overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <div className="text-center py-10">
              <ListOrdered size={34} className="mx-auto text-slate-300" />
              <div className="text-slate-500 font-semibold text-[13px] mt-2">Log entries නෑ</div>
              <div className="text-slate-400 text-[11.5px]">admins ලා දේවල් කරන විට මෙතන සටහන් වේ</div>
            </div>
          )}
          {filtered.map((l) => (
            <div key={l.id} className="flex flex-wrap items-start gap-3 rounded-2xl border border-slate-100 px-4 py-3 hover:bg-slate-50/60 transition">
              <div className="text-[11px] text-slate-400 tabular-nums w-[135px] shrink-0 pt-0.5">
                {new Date(l.created_at).toLocaleString()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[9.5px] font-bold ${ACTION_COLORS[l.action] ?? "bg-slate-100 text-slate-600"}`}>
                    {l.action}
                  </span>
                  <span className="font-extrabold text-slate-900 text-[12.5px]">{l.actor || "—"}</span>
                  {l.actor_role && (
                    <span className="rounded-full bg-slate-900 text-white px-2 py-0.5 text-[8.5px] font-bold uppercase">
                      {l.actor_role}
                    </span>
                  )}
                </div>
                {l.detail && <div className="text-slate-600 text-[12px] mt-1 break-words">{l.detail}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
