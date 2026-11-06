"use client";

// ============================================================================
// Admin → Data & Live Metrics → "Download With Special" අවසර පැනලය
//   · sign in වී ඇති users ලැයිස්තුව (profiles) → නම/NIC අනුව සොයන්න
//   · F28 වගේම "Do You Want to Authenticate?" → No / Yes
//   · authentic කරපු අයට Enable / Disable / Remove (delete) — edit only, register දත්තවලට කිසිදු බලපෑමක් නෑ
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Lock, Search, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import { AdminModal, dbDelete, dbUpdate, dbUpsert, useNotice } from "@/components/admin";
import { authedClient } from "@/lib/supabase/client";
import {
  SPECIAL_ACCESS_TABLE, dedupeAccessRows, filterAccessUsers, type SpecialAccessRow,
} from "@/lib/special-access";

type ProfileRow = { id: string; full_name: string; nic: string; role: string };

export function AdminSpecialAccessPanel() {
  const { show, node } = useNotice();
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [rows, setRows] = useState<SpecialAccessRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState("");
  const [confirmUser, setConfirmUser] = useState<ProfileRow | null>(null);
  const [busy, setBusy] = useState("");

  async function load() {
    try {
      const sb = await authedClient();
      const us = await sb.from("profiles").select("id,full_name,nic,role").order("full_name");
      if (!us.error && us.data) setUsers(us.data as unknown as ProfileRow[]);
      const acc = await sb.from(SPECIAL_ACCESS_TABLE).select("*").order("created_at", { ascending: false });
      if (acc.error) {
        setDbError(acc.error.message);
        setRows([]);
      } else {
        setDbError("");
        setRows(dedupeAccessRows((acc.data ?? []) as unknown as SpecialAccessRow[]));
      }
    } catch (e) {
      setDbError((e as Error).message);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byUser = useMemo(() => {
    const map: Record<string, SpecialAccessRow> = {};
    rows.forEach((r) => (map[r.user_id] = r));
    return map;
  }, [rows]);

  const filtered = useMemo(() => filterAccessUsers(users, q), [users, q]);
  const granted = useMemo(() => rows.filter((r) => r.status === "active"), [rows]);

  async function authenticate(u: ProfileRow) {
    setConfirmUser(null);
    setBusy(u.id);
    const existing = byUser[u.id];
    const err = existing
      ? await dbUpdate(SPECIAL_ACCESS_TABLE, { id: existing.id }, { status: "active", full_name: u.full_name, nic: u.nic })
      : await dbUpsert(
          SPECIAL_ACCESS_TABLE,
          { user_id: u.id, nic: u.nic, full_name: u.full_name, status: "active" },
          "user_id"
        );
    await load();
    setBusy("");
    show(
      err
        ? `⚠ ${err} — special-download-access.sql run කරලා තියෙනවද බලන්න`
        : `✅ ${u.full_name} — Download With Special අවසර දුන්නා`
    );
  }

  async function setEnabled(r: SpecialAccessRow, active: boolean) {
    setBusy(r.user_id);
    setRows((xs) => xs.map((x) => (x.id === r.id ? { ...x, status: active ? "active" : "disabled" } : x)));
    const err = await dbUpdate(SPECIAL_ACCESS_TABLE, { id: r.id }, { status: active ? "active" : "disabled" });
    if (err) show(`⚠ ${err}`);
    else show(active ? "✅ Enabled — button එක ආයෙ පේනවා" : "⏸ Disabled — button එක හැංගුවා");
    await load();
    setBusy("");
  }

  async function remove(r: SpecialAccessRow) {
    setBusy(r.user_id);
    setRows((xs) => xs.filter((x) => x.id !== r.id));
    const err = await dbDelete(SPECIAL_ACCESS_TABLE, { id: r.id });
    show(err ? `⚠ ${err}` : "🗑️ අවසර ඉවත් කළා — ආයෙ add කරන්න පුළුවන්");
    await load();
    setBusy("");
  }

  return (
    <div className="card p-5 mt-6">
      {node}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-extrabold text-slate-900 flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-600" /> Download With Special — අවසර
          </h2>
          <p className="text-[12px] text-slate-500 mt-1 max-w-2xl leading-relaxed">
            මෙතනින් authenticate කරන users ලට විතරයි සාමාජික/චන්ද හිමි පිටුවල{" "}
            <b className="text-slate-700">Download With Special</b> button එක පේන්නේ. එයාලා sign in වෙලා ඉන්නත් ඕනෑ.
            Sign in වෙලා අවසර නැති අයට button එක පේන්නෙම නෑ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 text-[11px] font-bold">
            {granted.length} active
          </span>
          <span className="rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1 text-[11px] font-bold">
            {rows.length} total
          </span>
        </div>
      </div>

      {dbError && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[11.5px] text-rose-700">
          <b>Table එක හමු වුණේ නෑ:</b> {dbError}
          <div className="text-rose-600/80 mt-1">Supabase → SQL Editor එකේ <code>special-download-access.sql</code> run කරන්න.</div>
        </div>
      )}

      {/* authentic කරපු අය */}
      {rows.length > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Authenticated users
          </div>
          <div className="divide-y divide-slate-100 max-h-[240px] overflow-y-auto">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-bold text-slate-800 truncate">{r.full_name || "—"}</div>
                  <div className="text-[11px] text-slate-500 tabular-nums">{r.nic || "—"}</div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                    r.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {r.status === "active" ? "Active" : "Disabled"}
                </span>
                <button
                  onClick={() => void setEnabled(r, r.status !== "active")}
                  disabled={busy === r.user_id}
                  className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {r.status === "active" ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => void remove(r)}
                  disabled={busy === r.user_id}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-100 disabled:opacity-50 inline-flex items-center gap-1"
                >
                  <Trash2 size={11} /> Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* users ලැයිස්තුව */}
      <div className="mt-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="field !pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sign in වී ඇති user කෙනෙක් නම හෝ NIC අනුව සොයන්න…"
          />
        </div>

        <div className="mt-3 rounded-2xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Sign in වූ users ({filtered.length})
          </div>
          <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
            {loading && (
              <div className="px-4 py-8 text-center text-[12px] text-slate-500">
                <Loader2 size={16} className="inline animate-spin mr-1.5" /> Loading…
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-[12px] text-slate-500">කිසිම user කෙනෙක් හමු වුණේ නෑ</div>
            )}
            {!loading &&
              filtered.map((u) => {
                const acc = byUser[u.id];
                const active = acc?.status === "active";
                return (
                  <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-bold text-slate-800 truncate">{u.full_name || "—"}</div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {u.nic || "—"} · {u.role || "member"}
                      </div>
                    </div>
                    {active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-[10.5px] font-bold">
                        <CheckCircle2 size={11} /> Authenticated
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmUser(u)}
                        disabled={busy === u.id}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 text-white px-3 py-1.5 text-[11px] font-bold hover:bg-indigo-500 disabled:opacity-50"
                      >
                        <UserPlus size={12} /> Add User
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* F28 වගේම confirm modal */}
      {confirmUser && (
        <AdminModal
          title="Do You Want to Authenticate?"
          sub="මේ user ට Download With Special අවසර දෙන්නද?"
          onClose={() => setConfirmUser(null)}
        >
          <div className="px-7 pb-7 pt-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[13px] font-extrabold text-slate-900">{confirmUser.full_name || "—"}</div>
              <div className="text-[11.5px] text-slate-500 tabular-nums mt-0.5">
                {confirmUser.nic || "—"} · {confirmUser.role || "member"}
              </div>
            </div>
            <p className="mt-3 text-[11.5px] text-slate-500 leading-relaxed flex items-start gap-2">
              <Lock size={13} className="mt-0.5 shrink-0" />
              Authenticate කළාම මේ user sign in වෙලා ඉද්දී සාමාජික/චන්ද හිමි පිටුවල “Download With Special” button එක පේනවා.
              එයාට වෙන්නේ සර්ච් කරපු ප්‍රතිඵල විතරක් PDF එකක් විදිහට බාගන්න පමණයි.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmUser(null)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-[12.5px] font-bold text-slate-600 hover:bg-slate-50"
              >
                <X size={13} /> No
              </button>
              <button
                onClick={() => void authenticate(confirmUser)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-[12.5px] font-bold text-white hover:bg-emerald-500"
              >
                <CheckCircle2 size={13} /> Yes, Authenticate
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
