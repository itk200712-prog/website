"use client";

// ============================================================================
// Administrators — add admins (login එක්ක) + section permissions (සමහර sections පමණක් edit)
// ============================================================================

import { useEffect, useState } from "react";
import { Lock, Pencil, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { logActivity } from "@/lib/activity";
import { AdminModal, AdminTopbar, dbDelete, dbUpdate, useNotice, SECTION_KEYS } from "@/components/admin";
import { authedClient, createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { nicToEmail } from "@/lib/auth";
import { encodePw } from "@/lib/auth";
import {
  canChangeRole, canDeleteAccount, canEditAccount, isRootAdmin, pickRootAdminId,
} from "@/lib/root-admin";
import { REGISTERED_USERS } from "@/lib/seed";

type AdminRow = {
  id: string;
  full_name: string;
  nic: string;
  phone: string;
  auth_email: string;
  role: string;
  sections: string;
  joined_date?: string;
  is_root_admin?: boolean;
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
  // 🔐 දැනට login වී ඇති admin + original (root) superadmin
  const [actor, setActor] = useState<{ id: string; role: string } | null>(null);
  const [rootId, setRootId] = useState("");

  async function load() {
    if (!isSupabaseConfigured()) {
      const demo = REGISTERED_USERS.filter((u) => (u.role as string) !== "member").map((u) => ({
        id: u.id, full_name: u.full_name, nic: u.nic, phone: u.phone, auth_email: u.auth_email, role: u.role, sections: "",
        joined_date: u.joined_date, is_root_admin: Boolean((u as { is_root_admin?: boolean }).is_root_admin),
      })) as AdminRow[];
      const rid = pickRootAdminId(demo);
      setRootId(rid);
      setActor(rid ? { id: rid, role: "superadmin" } : null);
      setRows(demo);
      setLoaded(true);
      return;
    }
    try {
      const sb = await authedClient();
      const { data: u } = await sb.auth.getUser();
      const actorId = u?.user?.id ?? "";
      const { data } = await sb
        .from("profiles")
        .select("id,full_name,nic,phone,auth_email,role,sections,joined_date")
        .neq("role", "member");
      if (data) {
        let adminRows = data as unknown as AdminRow[];
        try {
          const { data: flags, error: flagErr } = await sb.from("profiles").select("id,is_root_admin").eq("is_root_admin", true);
          if (!flagErr && flags && flags.length > 0) {
            const flagged = new Set((flags as { id: string }[]).map((f) => String(f.id)));
            adminRows = adminRows.map((r) => ({ ...r, is_root_admin: flagged.has(String(r.id)) }));
          }
        } catch { /* column නැත්නම් seed/පැරණිම එක අනුව */ }
        const rid = pickRootAdminId(adminRows);
        setRootId(rid);
        const me = adminRows.find((r) => r.id === actorId);
        if (me) setActor({ id: String(me.id), role: String(me.role) });
        else {
          const { data: prof } = await sb.from("profiles").select("id,role").eq("id", actorId).maybeSingle();
          setActor(prof ? { id: String((prof as { id: string }).id), role: String((prof as { role: string }).role) } : null);
        }
        setRows(adminRows);
      }
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
    if (!canEditAccount(actor, r, rootId)) {
      show("⚠ වෙනත් admin ගිණුම් edit කරන්න පුළුවන් Original Super Admin ට විතරයි");
      return;
    }
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
      if (!canEditAccount(actor, editFor, rootId)) {
        show("⚠ වෙනත් admin ගිණුම් edit කරන්න පුළුවන් Original Super Admin ට විතරයි");
        return;
      }
      // Role/sections වෙනස් කරන්න පුළුවන් Original Super Admin ට විතරයි — නැත්නම් නම/දුරකථනය විතරයි
      const actorIsRoot = isRootAdmin(actor, rootId);
      const patch: Record<string, unknown> = {
        full_name: String(fd.get("full_name")),
        phone: String(fd.get("phone")),
      };
      if (actorIsRoot) {
        if (canChangeRole(actor, editFor, rootId)) patch.role = String(fd.get("role") ?? editFor.role);
        if (editFor.id !== actor?.id) patch.sections = csv;
      }
      const err = await dbUpdate("profiles", { id: editFor.id }, patch);
      setModal(false);
      await load();
      show(err ? `⚠ ${err}` : "✅ Administrator updated");
      return;
    }
    // අලුත් admin කෙනෙක් — login එක්ක create කරන්න
    if (String(fd.get("role")) === "superadmin" && !isRootAdmin(actor, rootId)) {
      show("⚠ Super Admin ගිණුම් හදන්න පුළුවන් Original Super Admin ට විතරයි");
      return;
    }
    const password = String(fd.get("password"));
    // signUp එකකින් browser session එක අලුත් user ට මාරු විය හැක — profile එක
    // දාන්න කලින් නිර්මාණය කරන admin ගේ session එක ආපසු ගන්නයි මේක තියාගන්නේ.
    const creatorSb = await authedClient();
    const { data: creatorSession } = await creatorSb.auth.getSession();
    const savedSession = creatorSession.session
      ? { access_token: creatorSession.session.access_token, refresh_token: creatorSession.session.refresh_token }
      : null;
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
      // නිර්මාණය කරන admin විදිහටම profile එක දාන්න session එක restore කරනවා
      const adminSb = await authedClient();
      if (savedSession) await adminSb.auth.setSession(savedSession);
      // ✅ direct upsert (AUTHED) — profile row නැත්නම් හැදෙනවා, තියෙනවා නම් update වෙනවා
      const { error: upErr } = await adminSb.from("profiles").upsert({
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
    if (!canDeleteAccount(actor, r, rootId)) {
      show(r.id === rootId ? "⚠ Original Super Admin ගිණුම මකන්න බෑ" : "⚠ Admin ගිණුම් මකන්න පුළුවන් Original Super Admin ට විතරයි");
      return;
    }
    if (!confirm(`"${r.full_name}" ගේ admin ගිණුම (${r.role}) සම්පූර්ණයෙන්ම මකන්නද? Login එකත් නැති වෙනවා.`)) return;
    setRows((xs) => xs.filter((x) => x.id !== r.id));
    const sb = await authedClient();
    // ✅ පළවෙන් RPC — profile + login account දෙකම මකනවා (SQL function එක තියෙනවා නම්)
    const { error: rpcErr } = await sb.rpc("delete_admin", { uid: r.id });
    if (!rpcErr) {
      void logActivity("DELETE", `administrator removed — ${r.full_name} (${r.role}) + login account`);
      await load();
      show("✅ Removed — login account එකත් ඉවත් කළා");
      return;
    }
    // fallback: profiles row එක විතරක් (SQL function එක නැත්නම්)
    const err = await dbDelete("profiles", { id: r.id });
    if (!err) void logActivity("DELETE", `administrator profile removed — ${r.full_name} (${r.role})`);
    await load();
    show(err
      ? `⚠ ${err} — Supabase SQL Editor එකේ schema.sql එක run කරලා නැත්නම් ඒක දාන්න`
      : "✅ Removed (profile එක විතරයි — login account එකත් ඉවත් වෙන්න schema.sql එක run කරන්න)");
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
              Admin කෙනෙක්ට අවශ්‍ය sections පමණක් තෝරන්න. වෙනත් admin ගිණුම් edit/delete කරන්න පුළුවන් මුල සිටම සිටි ⭐ Original Super Admin ට විතරයි.
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
                  {r.role}{rootId && r.id === rootId ? " · ⭐ Original" : ""}
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
                {canEditAccount(actor, r, rootId) ? (
                  <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-700" title="Edit sections" onClick={() => openEdit(r)}>
                    <Pencil size={13} />
                  </button>
                ) : (
                  <span className="w-8 h-8 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-300" title="වෙනත් admin ගිණුම් edit කරන්න පුළුවන් Original Super Admin ට විතරයි">
                    <Lock size={12} />
                  </span>
                )}
                {canDeleteAccount(actor, r, rootId) ? (
                  <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-600" title="Remove" onClick={() => remove(r)}>
                    <Trash2 size={13} />
                  </button>
                ) : (
                  <span className="w-8 h-8 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-300" title={r.id === rootId ? "Original Super Admin ගිණුම මකන්න බෑ" : "Admin ගිණුම් මකන්න පුළුවන් Original Super Admin ට විතරයි"}>
                    <Lock size={12} />
                  </span>
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
                <select
                  name="role"
                  className="field"
                  defaultValue={editFor?.role ?? "admin"}
                  disabled={editFor ? !canChangeRole(actor, editFor, rootId) : false}
                >
                  <option value="admin">Admin (limited sections)</option>
                  <option value="superadmin" disabled={!editFor && !isRootAdmin(actor, rootId)}>
                    Super Admin (all access){!editFor && !isRootAdmin(actor, rootId) ? " — Original Super Admin ට විතරයි" : ""}
                  </option>
                </select>
                {editFor && !canChangeRole(actor, editFor, rootId) && (
                  <p className="text-slate-400 text-[10.5px] mt-1.5">🔒 Role එක වෙනස් කරන්න පුළුවන් Original Super Admin ට විතරයි.</p>
                )}
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
                      disabled={editFor ? editFor.role === "superadmin" || !isRootAdmin(actor, rootId) : false}
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
