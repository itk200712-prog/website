"use client";

// ============================================================================
// Registered Members — All User & Admin Accounts (password display included)
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Lock, Pencil, Search, Trash2, UsersRound } from "lucide-react";
import { AdminModal, AdminTopbar, dbDelete, dbUpdate, useNotice } from "@/components/admin";
import { authedClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { decodePw } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import {
  canChangeRole, canDeleteAccount, canEditAccount, canResetPassword, canViewPassword, pickRootAdminId,
} from "@/lib/root-admin";
import { REGISTERED_USERS } from "@/lib/seed";
import type { RegisteredUser } from "@/lib/types";

type UserRow = RegisteredUser;

export default function AdminMembersPage() {
  const { show, node } = useNotice();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<UserRow[]>([...REGISTERED_USERS]);
  const [editFor, setEditFor] = useState<UserRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  // 🔐 දැනට login වී ඇති admin + original (root) superadmin ගේ id එක
  const [actor, setActor] = useState<{ id: string; role: string } | null>(null);
  const [rootId, setRootId] = useState("");

  // DB (profiles) එකෙන් load — sample data නෙමෙයි, ඇත්ත accounts ම.
  // ආරක්‍ෂිත admin passwords browser එකට ගේන්නෙත් root ට සහ තමන්ට විතරයි.
  async function load() {
    if (!isSupabaseConfigured()) {
      const demo = REGISTERED_USERS as UserRow[];
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
      const { data } = await sb.from("profiles").select("id,full_name,nic,phone,role,auth_email,joined_date");
      if (data && data.length > 0) {
        let baseRows = (data as unknown as Record<string, string>[]).map((r) => ({
          id: r.id,
          full_name: r.full_name ?? "",
          nic: r.nic ?? "",
          phone: r.phone ?? "",
          role: (r.role ?? "member") as UserRow["role"],
          joined_date: r.joined_date ? new Date(r.joined_date).toLocaleDateString() : "—",
          password_display: "",
          auth_email: r.auth_email ?? "",
          is_root_admin: false,
        })) as UserRow[];

        // is_root_admin column එක තියෙනවා නම් ලකුණ ගන්නවා (නැත්නම් seed/පැරණිම superadmin අනුව)
        try {
          const { data: flags, error: flagErr } = await sb.from("profiles").select("id,is_root_admin").eq("is_root_admin", true);
          if (!flagErr && flags && flags.length > 0) {
            const flagged = new Set((flags as { id: string }[]).map((f) => String(f.id)));
            baseRows = baseRows.map((r) => ({ ...r, is_root_admin: flagged.has(String(r.id)) }));
          }
        } catch { /* column නැත්නම් fallback එක ඇති */ }

        const rid = pickRootAdminId(baseRows);
        setRootId(rid);
        const me = baseRows.find((r) => r.id === actorId);
        setActor(me ? { id: String(me.id), role: String(me.role) } : actorId ? { id: actorId, role: "" } : null);

        const pwMap = new Map<string, string>();
        try {
          let pwQuery = sb.from("profiles").select("id,password_display");
          const actorIsRoot = Boolean(actorId && actorId === rid);
          if (!actorIsRoot) {
            pwQuery = (actorId ? pwQuery.or(`role.eq.member,id.eq.${actorId}`) : pwQuery.eq("role", "member")) as typeof pwQuery;
          }
          const { data: pw } = await pwQuery;
          for (const p of (pw ?? []) as { id: string; password_display?: string }[]) {
            pwMap.set(String(p.id), p.password_display ?? "");
          }
        } catch { /* passwords නැතිව ලැයිස්තුව පෙන්වයි */ }

        setRows(baseRows.map((r) => ({ ...r, password_display: pwMap.get(String(r.id)) ?? "" })));
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) => r.full_name.toLowerCase().includes(s) || r.nic.toLowerCase().includes(s) || r.phone.includes(s)
    );
  }, [q, rows]);

  const editingCanChangeRole = editFor ? canChangeRole(actor, editFor, rootId) : false;
  const editingCanReset = editFor ? canResetPassword(actor, editFor, rootId) : false;

  return (
    <div>
      <AdminTopbar title="Registered Members" sub="Review and manage member records, moderate gallery discussions, and configure communication preferences." />
      {node}

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <UsersRound size={20} className="text-indigo-700" /> All User &amp; Admin Accounts
              <span className="badge-blue rounded-full px-2.5 py-0.5 text-[11px] font-bold">{rows.length}</span>
            </h2>
            <p className="text-slate-500 text-[12px] mt-1">
              Member ගිණුම් ඕනෑම admin කෙනෙක්ට කළමනාකරණය කරන්න පුළුවන්. Admin ගිණුම් edit/reset/delete කරන්න පුළුවන් මුල සිටම සිටි Original Super Admin ට විතරයි.
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="field !pl-10" placeholder="Search members by name, NIC, or phone..." />
          </div>
        </div>

        <div className="scroll-x mt-5">
          <table className="table-x">
            <thead>
              <tr>
                <th>FULL NAME</th>
                <th>NIC NUMBER</th>
                <th>PHONE</th>
                <th>PASSWORD</th>
                <th>ROLE</th>
                <th>JOINED DATE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const canViewPw = canViewPassword(actor, r, rootId);
                const canEdit = canEditAccount(actor, r, rootId);
                const canDelete = canDeleteAccount(actor, r, rootId);
                const isRootRow = Boolean(rootId && r.id === rootId);
                return (
                <tr key={r.id}>
                  <td className="font-semibold text-slate-800">{r.full_name}</td>
                  <td className="tabular-nums text-slate-600">{r.nic}</td>
                  <td className="tabular-nums text-slate-600">{r.phone}</td>
                  {/* 🔐 Password: member ලාගේ ඕන admin කෙනෙක්ට; admin ලාගේ root ට/තමන්ට විතරයි */}
                  <td>
                    {canViewPw ? (
                      <div className="flex items-center gap-2">
                        <code className="rounded-lg bg-slate-100 px-2.5 py-1 text-[12px] tabular-nums">
                          {visible[r.id] ? decodePw(r.password_display) || "••••••" : "••••••••"}
                        </code>
                        <button
                          className="text-slate-400 hover:text-indigo-700"
                          onClick={() => setVisible((v) => ({ ...v, [r.id]: !v[r.id] }))}
                          title="Show / hide password"
                        >
                          {visible[r.id] ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-400" title="Admin password එක බලන්න පුළුවන් Original Super Admin ට විතරයි">
                        <code className="rounded-lg bg-slate-100 px-2.5 py-1 text-[12px]">••••••••</code>
                        <Lock size={13} />
                        <span className="text-[10px] font-semibold">Protected</span>
                      </div>
                    )}
                  </td>
                  <td>
                    {r.role === "superadmin" ? (
                      <span className="badge-amber rounded-full px-2.5 py-1 text-[10.5px] font-bold inline-flex items-center gap-1">
                        Super Admin{isRootRow ? " · ⭐ Original" : ""}
                      </span>
                    ) : r.role === "admin" ? (
                      <span className="rounded-full bg-slate-900 text-white px-2.5 py-1 text-[10.5px] font-bold inline-flex items-center gap-1">
                        Admin
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 text-slate-600 px-2.5 py-1 text-[10.5px] font-bold inline-flex items-center gap-1">
                        Member
                      </span>
                    )}
                  </td>
                  <td className="tabular-nums text-slate-500">{r.joined_date}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {canEdit ? (
                        <button
                          className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-700"
                          title="Edit"
                          onClick={() => setEditFor(r)}
                        >
                          <Pencil size={14} />
                        </button>
                      ) : (
                        <span
                          className="w-8 h-8 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-300"
                          title="වෙනත් admin ගිණුම් edit කරන්න පුළුවන් Original Super Admin ට විතරයි"
                        >
                          <Lock size={13} />
                        </span>
                      )}
                      {canDelete ? (
                        <button
                          className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-600"
                          title="Delete account"
                          onClick={async () => {
                            if (!confirm(`"${r.full_name}" ගේ ගිණුම (${r.role}) සම්පූර්ණයෙන්ම මකන්නද? Login එකත් නැති වෙනවා.`)) return;
                            // ✅ delete_admin RPC — profile + login account දෙකම මකනවා (DB එකෙත් root නීතිය බලනවා)
                            let err: string | null = null;
                            let loginRemoved = false;
                            if (r.id) {
                              const sb = await authedClient();
                              const { error: rpcErr } = await sb.rpc("delete_admin", { uid: r.id });
                              if (!rpcErr) loginRemoved = true;
                              else err = await dbDelete("profiles", { id: r.id });
                            } else {
                              err = await dbDelete("profiles", { nic: r.nic });
                            }
                            await load();
                            show(err
                              ? `⚠ ${err} — Supabase SQL Editor එකේ schema.sql එක run කරලා නැත්නම් ඒක දාන්න`
                              : loginRemoved
                                ? "✅ Deleted — login account එකත් ඉවත් කළා"
                                : "✅ Profile එක ඉවත් කළා (login account එක ඉවත් වෙන්න schema.sql එකේ delete_admin function එක අවශ්‍යයි)");
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <span
                          className="w-8 h-8 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-300"
                          title={isRootRow ? "Original Super Admin ගිණුම මකන්න බෑ" : "Admin ගිණුම් මකන්න පුළුවන් Original Super Admin ට විතරයි"}
                        >
                          <Lock size={13} />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editFor && (
        <AdminModal title="Edit Member" sub={`${editFor.full_name} — update කර Save ඔබන්න`} onClose={() => setEditFor(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!canEditAccount(actor, editFor, rootId)) {
                show("⚠ මේ ගිණුම edit කරන්න ඔබට අවසර නෑ — Admin ගිණුම් Original Super Admin ට විතරයි");
                return;
              }
              const fd = new FormData(e.currentTarget);
              const newPw = String(fd.get("new_password") ?? "");
              if (newPw && !editingCanReset) {
                show("⚠ මේ ගිණුමේ password එක reset කරන්න ඔබට අවසර නෑ");
                return;
              }
              if (newPw && newPw.length < 8) {
                show("⚠ අලුත් password එක අකුරු 8කටවත් වැඩි වෙන්න ඕනේ");
                return;
              }
              const patch: Record<string, unknown> = {
                full_name: String(fd.get("full_name")),
                phone: String(fd.get("phone")),
                nic: String(fd.get("nic")),
                auth_email: String(fd.get("auth_email")),
              };
              // Role එක වෙනස් කරන්න පුළුවන් Original Super Admin ට විතරයි
              if (editingCanChangeRole) patch.role = String(fd.get("role"));
              const err = await dbUpdate("profiles", { id: editFor.id }, patch);
              if (err) {
                show(`⚠ ${err}`);
                return;
              }
              if (newPw) {
                try {
                  const sb = await authedClient();
                  const { data: sess } = await sb.auth.getSession();
                  const token = sess?.session?.access_token ?? "";
                  const res = await fetch("/api/admin-reset-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ targetId: editFor.id, newPassword: newPw }),
                  });
                  const j = (await res.json().catch(() => null)) as { ok?: boolean; reason?: string } | null;
                  if (!res.ok || !j?.ok) {
                    const reasonText =
                      j?.reason === "protected_admin"
                        ? "Admin ගිණුම්වල password reset කරන්න පුළුවන් Original Super Admin ට විතරයි"
                        : j?.reason === "server_not_configured"
                          ? "Server setup එක අඩුයි — Vercel එකේ SUPABASE_SERVICE_ROLE_KEY env එක අවශ්‍යයි"
                          : j?.reason === "weak_password"
                            ? "Password එක දුර්වලයි — අකුරු 8කට වැඩි එකක් දාන්න"
                            : "Password reset එක අසාර්ථක වුණා";
                    setEditFor(null);
                    await load();
                    show(`⚠ විස්තර save වුණා, නමුත් ${reasonText}`);
                    return;
                  }
                  void logActivity("PASSWORD_RESET", `password reset — ${editFor.full_name} (${editFor.role})`);
                } catch {
                  setEditFor(null);
                  await load();
                  show("⚠ විස්තර save වුණා, නමුත් password reset එක යවන්න බැරි වුණා — network එක බලන්න");
                  return;
                }
              }
              setEditFor(null);
              await load();
              show(newPw ? "✅ Updated — අලුත් password එකෙන් දැන් login වෙන්න පුළුවන්" : "✅ Member updated");
            }}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label">Full Name</label>
                <input name="full_name" required className="field" defaultValue={editFor.full_name} />
              </div>
              <div>
                <label className="field-label">NIC</label>
                <input name="nic" required className="field" defaultValue={editFor.nic} />
              </div>
              <div>
                <label className="field-label">Phone</label>
                <input name="phone" className="field" defaultValue={editFor.phone} />
              </div>
              <div>
                <label className="field-label">Email</label>
                <input name="auth_email" className="field" defaultValue={editFor.auth_email} />
              </div>
            </div>
            <div>
              <label className="field-label">Role</label>
              <select name="role" className="field" defaultValue={editFor.role} disabled={!editingCanChangeRole}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Super Admin</option>
              </select>
              {!editingCanChangeRole && (
                <p className="text-slate-400 text-[10.5px] mt-1.5">🔒 Role එක වෙනස් කරන්න පුළුවන් Original Super Admin ට විතරයි.</p>
              )}
            </div>
            {editingCanReset ? (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3.5 py-3">
                <label className="field-label">Reset login password (වෙනස් කරන්න ඕන නම් විතරක් පුරවන්න)</label>
                <input name="new_password" type="text" autoComplete="new-password" className="field" placeholder="අකුරු 8කට වැඩි අලුත් password එකක්…" />
                <p className="text-slate-400 text-[10.5px] mt-1.5">Save කළාම පරණ password එක වැඩ කරන්නේ නෑ — අලුත් එක අදාළ කෙනාට කියන්න.</p>
              </div>
            ) : editFor.role !== "member" ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11.5px] text-amber-800">
                🔒 Admin ගිණුම්වල password reset කරන්න පුළුවන් Original Super Admin ට විතරයි.
                {actor?.id === editFor.id ? " ඔබේම password එක වෙනස් කරන්න Admin → Profile යන්න." : ""}
              </p>
            ) : null}
            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" className="btn btn-outline" onClick={() => setEditFor(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
