"use client";

// ============================================================================
// Administrators — add admins (login එක්ක) + section permissions (සමහර sections පමණක් edit)
// ============================================================================

import { useEffect, useState } from "react";
import { Pencil, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { logActivity } from "@/lib/activity";
import { AdminModal, AdminTopbar, dbDelete, dbUpdate, useNotice, SECTION_KEYS } from "@/components/admin";
import { authedClient, createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { nicToEmail } from "@/lib/auth";
import { encodePw } from "@/lib/auth";
import { REGISTERED_USERS } from "@/lib/seed";

type AdminRow = {
  id: string;
  full_name: string;
  nic: string;
  phone: string;
  auth_email: string;
  role: string;
  sections: string;
};

const SECTION_LABELS: Record<string, string> = {
  members: "Registered Members",
  administrators: "Administrators",
  applications: "Membership Applications",
  data: "Data & Live Metrics",
  board: "Board of Directors",
  news: "News & Notices",
  gallery: "Gallery Moderation",
  messages: "Messages & Inquiries",
  businesses: "Businesses & Services",
  fuel: "Fuel Prices",
  f28: "F28 (සමිතියේ ගිනුම්)",
  settings: "System Settings",
};

export default function AdminAdministratorsPage() {
  const { show, node } = useNotice();
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [modal, setModal] = useState(false);
  const [editFor, setEditFor] = useState<AdminRow | null>(null);
  const [sections, setSections] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    if (!isSupabaseConfigured()) {
      setRows(REGISTERED_USERS.filter((u) => (u.role as string) !== "member").map((u) => ({
        id: u.id, full_name: u.full_name, nic: u.nic, phone: u.phone, auth_email: u.auth_email, role: u.role, sections: "",
      })));
      setLoaded(true);
      return;
    }
    try {
      const { data } = await authedClient().then((c) => c.from("profiles").select("*").neq("role", "member"));
      if (data) setRows(data as unknown as AdminRow[]);
    } catch { /* ignore */ }
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditFor(null);
    setSections([]);
    setModal(true);
  }
  function openEdit(r: AdminRow) {
    setEditFor(r);
    setSections((r.sections || "").split(",").map((s) => s.trim()).filter(Boolean));
    setModal(true);
  }

  const toggle = (k: string) =>
    setSections((xs) => (xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k]));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const csv = sections.join(",");
    if (editFor) {
      const err = await dbUpdate("profiles", { id: editFor.id }, {
        full_name: String(fd.get("full_name")),
        phone: String(fd.get("phone")),
        role: String(fd.get("role")),
        sections: csv,
      });
      setModal(false);
      await load();
      show(err ? `⚠ ${err}` : "✅ Administrator updated");
      return;
    }
    // අලුත් admin කෙනෙක් — login එක්ක create කරන්න
    const password = String(fd.get("password"));
    // ✅ LOGIN FIX: account එක හැදිය යුත්තේ nic@members.mpcs.lk එකෙන් (loginWithNic එකට ගැලපෙන්න)
    const email = nicToEmail(String(fd.get("nic")));
    const sb = createClient();
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error && !/already registered/i.test(error.message || "")) {
      show(`⚠ ${error.message}`);
      return;
    }
    let uid = data?.user?.id;
    if (!uid && error && /already registered/i.test(error.message || "")) {
      show(`⚠ මේ email එකෙන් account එකක් තියෙනවා — වෙන email එකක් දාන්න`);
      return;
    }
    if (uid) {
      // ✅ direct upsert (AUTHED) — profile row නැත්නම් හැදෙනවා, තියෙනවා නම් update වෙනවා
      const { error: upErr } = await (await authedClient()).from("profiles").upsert({
        id: uid,
        full_name: String(fd.get("full_name")),
        nic: String(fd.get("nic")),
        phone: String(fd.get("phone")),
        auth_email: email, // nic@members.mpcs.lk (login එක මේකෙන් වැඩ කරනවා)
        role: String(fd.get("role")),
        sections: csv,
        password_display: encodePw(password),
      }, { onConflict: "id" });
      if (!upErr) void logActivity("INSERT", `administrator created — ${String(fd.get("full_name"))} (${String(fd.get("role"))}) sections=${csv || "all"}`);
      if (upErr) show(`⚠ ${upErr.message}`);
      else if (data.user && !data.user.email_confirmed_at) {
        show("⚠ Admin එක හැදුණා — නමුත් Supabase \"Confirm email\" ON නිසා login නැවතෙනවා! Dashboard: Authentication → Providers → Email → Confirm email OFF කරන්න");
      } else {
        show("✅ Administrator created — දැන් NIC + password එකෙන් login වෙනවා!");
      }
    }
    setModal(false);
    await load();
  }

  async function remove(r: AdminRow) {
    if (r.role === "superadmin") return;
    setRows((xs) => xs.filter((x) => x.id !== r.id));
    const sb = await authedClient();
    // ✅ පළවෙන් RPC — profile + login account දෙකම මකනවා (SQL function එක තියෙනවා නම්)
    const { error: rpcErr } = await sb.rpc("delete_admin", { uid: r.id });
    void logActivity("DELETE", `administrator removed — ${r.full_name} (${r.role}) + login account`);
    if (!rpcErr) {
      await load();
      show("✅ Removed — login account එකත් ඉවත් කළා");
      return;
    }
    // fallback: profiles row එක විතරක් (SQL function එක නැත්නම්)
    const err = await dbDelete("profiles", { id: r.id });
    await load();
    show(err
      ? `⚠ ${err} — Supabase SQL Editor එකේ delete_admin function එක run කරලා නැත්නම් ඒක දාන්න`
      : "✅ Removed (profile එක විතරයි — login account එක ඉවත් කරන්න SQL function එක දාන්න)");
  }

  return (
    <div>
      <AdminTopbar title="Administrators" sub="Add admins with login access and choose which sections each admin can edit" />
      {node}

      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <ShieldCheck size={20} className="text-indigo-700" /> Administrators & Section Permissions
            </h2>
            <p className="text-slate-500 text-[12px] mt-1">
              Admin කෙනෙක්ට අවශ්‍ය sections පමණක් තෝරන්න — එයාට login වෙලා ඒ sections විතරක් edit කරන්න පුළුවන්.
            </p>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add Administrator
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-6">
          {rows.map((r) => (
            <div key={r.id ?? r.nic} className="rounded-2xl border border-slate-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center text-[11px] font-black">
                    {(r.full_name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-900 text-[13px]">{r.full_name}</div>
                    <div className="text-slate-500 text-[11px]">{r.auth_email}</div>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${r.role === "superadmin" ? "badge-amber" : "badge-blue"}`}>
                  {r.role}
                </span>
              </div>
              <div className="mt-2.5 text-[11px] text-slate-500">NIC: {r.nic} · {r.phone}</div>
              <div className="mt-2 text-[10.5px] text-slate-500">
                <span className="font-bold text-slate-600">Sections:</span>{" "}
                {r.role === "superadmin" || !r.sections ? (
                  <span className="text-emerald-600 font-semibold">All (full access)</span>
                ) : (
                  r.sections.split(",").map((s) => SECTION_LABELS[s] ?? s).join(", ") || "—"
                )}
              </div>
              <div className="flex gap-1.5 mt-3.5 justify-end">
                <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-700" title="Edit sections" onClick={() => openEdit(r)}>
                  <Pencil size={13} />
                </button>
                {r.role !== "superadmin" && (
                  <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-600" title="Remove" onClick={() => remove(r)}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {loaded && rows.length === 0 && (
          <p className="text-center text-slate-400 text-[13px] mt-8">Administrators නෑ — "Add Administrator" ඔබන්න.</p>
        )}
      </div>

      {modal && (
        <AdminModal
          title={editFor ? "Edit Administrator" : "Add Administrator"}
          sub={editFor ? `${editFor.full_name} — sections තෝරා Save ඔබන්න` : "Login එක්ක admin කෙනෙක් create කරන්න + එයාට edit කරන්න පුළුවන් sections තෝරන්න"}
          onClose={() => setModal(false)}
          wide
        >
          <form key={editFor ? `edit-${editFor.id}` : "add"} onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label">Full Name *</label>
                <input name="full_name" required className="field" defaultValue={editFor?.full_name ?? ""} />
              </div>
              <div>
                <label className="field-label">NIC *</label>
                <input name="nic" required className="field" disabled={!!editFor} defaultValue={editFor?.nic ?? ""} />
              </div>
              <div>
                <label className="field-label">Phone</label>
                <input name="phone" className="field" defaultValue={editFor?.phone ?? ""} />
              </div>
              <div>
                <label className="field-label">Role</label>
                <select name="role" className="field" defaultValue={editFor?.role ?? "admin"} disabled={editFor?.role === "superadmin"}>
                  <option value="admin">Admin (limited sections)</option>
                  <option value="superadmin">Super Admin (all access)</option>
                </select>
              </div>
            </div>
            {!editFor && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label">Login Email * (NIC@members.mpcs.lk)</label>
                  <input name="email" type="email" required className="field" placeholder="e.g. perera@members.mpcs.lk" />
                </div>
                <div>
                  <label className="field-label">Password *</label>
                  <input name="password" type="text" required className="field" placeholder="e.g. Admin@123" />
                </div>
              </div>
            )}

            <div>
              <label className="field-label">Editable Sections (sections මොනවද edit කරන්න පුළුවන්)</label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mt-2">
                {SECTION_KEYS.map((k) => (
                  <label key={k} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 cursor-pointer hover:border-indigo-300">
                    <input
                      type="checkbox"
                      checked={sections.includes(k)}
                      onChange={() => toggle(k)}
                      disabled={editFor?.role === "superadmin"}
                    />
                    <span className="text-[11.5px] font-semibold text-slate-700">{SECTION_LABELS[k] ?? k}</span>
                  </label>
                ))}
              </div>
              <p className="text-slate-400 text-[10.5px] mt-2">
                කිසිවක් නොතෝරා තැබුවොත් full access ලැබේ. උදාහරනයක් ලෙස &quot;Board of Directors&quot; පමණක් තෝරා ඇති admin කෙනෙකුට board details edit කිරීම පමණක් හැක.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">
                {editFor ? "Save Changes" : <><UserPlus size={16} /> Create Administrator</>}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
