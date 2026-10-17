"use client";

// ============================================================================
// Admin → Emails (⑳)
//  · නම + email add / edit / delete
//  · activation mail එකක් යැවීම (FormSubmit එකට confirm කරන්න ඕන)
//  · Membership applications මේ හැම ලිපිනයකටම යැවේ
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Mail, Plus, RefreshCw, Save, Send, Trash2, X } from "lucide-react";
import { AdminTopbar, dbInsert, dbDelete, dbUpdate, useNotice } from "@/components/admin";
import { clearNotifyCache, getNotifyEmails, sendActivation } from "@/lib/notify-emails";
import { authedClient } from "@/lib/supabase/client";

type Row = { id: string; label: string; email: string; active: boolean; verification: string; verified_at: string | null; created_at: string };

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export default function AdminEmailsPage() {
  const { show, node } = useNotice();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sb = await authedClient();
      const { data, error } = await sb.from("notify_emails").select("*").order("created_at");
      if (error) {
        if (/does not exist|PGRST205|schema cache|relation/i.test(error.message)) setMissing(true);
        setRows([]);
      } else {
        setMissing(false);
        setRows((data ?? []) as Row[]);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!label.trim()) return show("⚠ නම ඇතුළත් කරන්න");
    if (!isEmail(email)) return show("⚠ වලංගු email ලිපිනයක් ඇතුළත් කරන්න");
    if (rows.some((r) => r.email.toLowerCase() === email.trim().toLowerCase())) return show("⚠ මේ ලිපිනය දැනටමත් ඇත");
    setBusy("add");
    const err = await dbInsert("notify_emails", { label: label.trim(), email: email.trim(), active: true, verification: "pending" });
    setBusy("");
    if (err) return show(`⚠ ${err}`);
    clearNotifyCache();
    setLabel("");
    setEmail("");
    show("✅ ලිපිනය එකතු වුණා — දැන් Activate කරන්න");
    void load();
  }

  async function activate(r: Row) {
    setBusy(r.id);
    const ok = await sendActivation(r.email);
    if (ok) {
      await dbUpdate("notify_emails", { id: r.id }, { verification: "activated", verified_at: new Date().toISOString() });
      show("✅ Activation mail යැවුණා — inbox එකේ confirm කරන්න");
    } else {
      await dbUpdate("notify_emails", { id: r.id }, { verification: "failed" });
      show("⚠ Activation mail යැවීමට බැරි විය — ලිපිනය පරීක්ෂා කරන්න");
    }
    setBusy("");
    void load();
  }

  async function toggle(r: Row) {
    const err = await dbUpdate("notify_emails", { id: r.id }, { active: !r.active });
    if (err) return show(`⚠ ${err}`);
    clearNotifyCache();
    setRows((xs) => xs.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)));
  }

  async function saveEdit(r: Row) {
    if (!isEmail(editEmail)) return show("⚠ වලංගු email ලිපිනයක් ඇතුළත් කරන්න");
    const err = await dbUpdate("notify_emails", { id: r.id }, { label: editLabel.trim(), email: editEmail.trim() });
    if (err) return show(`⚠ ${err}`);
    clearNotifyCache();
    setEditId(null);
    show("✅ සුරැකුණා");
    void load();
  }

  async function remove(r: Row) {
    if (!confirm(`"${r.label}" (${r.email}) ඉවත් කරන්නද?`)) return;
    const err = await dbDelete("notify_emails", { id: r.id });
    if (err) return show(`⚠ ${err}`);
    clearNotifyCache();
    show("✅ ඉවත් කළා");
    void load();
  }

  return (
    <div>
      {node}
      <AdminTopbar title="Emails" sub="Membership application / inquiry notifications යන ලිපින" />

      {missing && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-[12.5px] font-extrabold text-amber-800">⚠ notify_emails table එක තවම හදලා නෑ</div>
          <p className="mt-1 text-[11.5px] text-amber-700">supabase/schema.sql එකේ අන්තිම &quot;§23. NOTIFICATION EMAILS&quot; block එක Supabase → SQL Editor එකේ run කරන්න.</p>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-4">
        {/* list */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-[13px] font-extrabold text-slate-900">
              <Mail size={15} className="text-indigo-600" /> Notification emails
              <span className="rounded-full bg-indigo-50 text-indigo-700 text-[9.5px] font-black px-1.5 py-0.5">{rows.filter((r) => r.active).length} active</span>
            </div>
            <button onClick={() => void load()} className="btn btn-outline !py-1.5 !px-2.5 !text-[11px]" disabled={loading}>
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          {rows.length === 0 && !loading && (
            <div className="px-4 py-10 text-center text-[11.5px] text-slate-400">
              තවම ලිපින නෑ — දකුණු පැත්තෙන් එකතු කරන්න
            </div>
          )}

          <div className="divide-y divide-slate-100">
            {rows.map((r) => (
              <div key={r.id} className="px-4 py-3">
                {editId === r.id ? (
                  <div className="space-y-2">
                    <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="නම" className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] outline-none focus:border-indigo-400" />
                    <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="email" className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] outline-none focus:border-indigo-400" />
                    <div className="flex gap-1.5">
                      <button onClick={() => void saveEdit(r)} className="btn btn-primary !py-1.5 !px-3 !text-[11px]"><Save size={11} /> Save</button>
                      <button onClick={() => setEditId(null)} className="btn btn-outline !py-1.5 !px-3 !text-[11px]"><X size={11} /> Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12.5px] font-extrabold text-slate-900 truncate">{r.label || "—"}</span>
                        {r.active ? (
                          <span className="rounded-full bg-emerald-50 text-emerald-700 text-[8.5px] font-black px-1.5 py-0.5">ACTIVE</span>
                        ) : (
                          <span className="rounded-full bg-slate-100 text-slate-500 text-[8.5px] font-black px-1.5 py-0.5">OFF</span>
                        )}
                        {r.verification === "activated" ? (
                          <span className="rounded-full bg-sky-50 text-sky-700 text-[8.5px] font-black px-1.5 py-0.5">✔ VERIFIED</span>
                        ) : r.verification === "failed" ? (
                          <span className="rounded-full bg-rose-50 text-rose-700 text-[8.5px] font-black px-1.5 py-0.5">FAILED</span>
                        ) : (
                          <span className="rounded-full bg-amber-50 text-amber-700 text-[8.5px] font-black px-1.5 py-0.5">NOT ACTIVATED</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{r.email}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => void activate(r)} disabled={busy === r.id} className="rounded-lg bg-indigo-50 px-2 py-1 text-[9.5px] font-extrabold text-indigo-700 hover:bg-indigo-100" title="Activation mail යවන්න">
                        {busy === r.id ? "…" : "Activate"}
                      </button>
                      <button onClick={() => void toggle(r)} className="rounded-lg bg-slate-100 px-2 py-1 text-[9.5px] font-extrabold text-slate-600 hover:bg-slate-200">
                        {r.active ? "Off" : "On"}
                      </button>
                      <button onClick={() => { setEditId(r.id); setEditLabel(r.label); setEditEmail(r.email); }} className="rounded-lg bg-slate-100 px-2 py-1 text-[9.5px] font-extrabold text-slate-600 hover:bg-slate-200">
                        Edit
                      </button>
                      <button onClick={() => void remove(r)} className="rounded-lg bg-rose-50 p-1 text-rose-600 hover:bg-rose-100">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* add / help */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[13px] font-extrabold text-slate-900 flex items-center gap-1.5">
              <Plus size={14} className="text-indigo-600" /> අලුත් ලිපිනයක්
            </div>
            <div className="mt-2.5 space-y-2">
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="නම (උදා: ලේකම් කාර්යාලය)" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] outline-none focus:border-indigo-400 focus:bg-white" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" type="email" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] outline-none focus:border-indigo-400 focus:bg-white" />
              <button onClick={() => void add()} disabled={busy === "add"} className="btn btn-primary w-full !py-2 !text-[12px]">
                <Plus size={13} /> {busy === "add" ? "Adding…" : "Add email"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <div className="flex items-center gap-1.5 text-[12px] font-extrabold text-indigo-800">
              <Send size={13} /> කොහොමද වැඩ කරන්නේ
            </div>
            <ol className="mt-2 space-y-1.5 text-[11px] text-indigo-900/80 list-decimal pl-4">
              <li>ලිපිනය add කරන්න (නම සමඟ)</li>
              <li><b>Activate</b> ඔබන්න — ඒ ලිපිනයට FormSubmit confirmation mail එකක් යයි</li>
              <li>ඒ inbox එකේ ලින්ක් එක confirm කරන්න</li>
              <li>දැන් සාමාජික අයදුම්පතක් submit වෙද්දී <b>හැම active ලිපිනයකටම</b> mail යයි ✅</li>
            </ol>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-1.5 text-[12px] font-extrabold text-amber-800">
              <AlertTriangle size={13} /> සටහන
            </div>
            <p className="mt-1.5 text-[11px] text-amber-800">
              FormSubmit එකට එක් ලිපිනයකට <b>එක වරක්</b> confirm කිරීම ප්‍රමාණවත්. Confirm නොකළ ලිපිනයකට mail යැවෙන්නේ නෑ.
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-[10.5px] font-semibold text-amber-700">
              <CheckCircle2 size={11} /> දැනට active: {rows.filter((r) => r.active).length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
