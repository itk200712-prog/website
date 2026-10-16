"use client";

// ============================================================================
// Registered Members — All User & Admin Accounts (password display included)
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Pencil, Search, Trash2, UsersRound } from "lucide-react";
import { AdminModal, AdminTopbar, dbDelete, dbUpdate, useNotice } from "@/components/admin";
import { authedClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { decodePw } from "@/lib/auth";
import { REGISTERED_USERS } from "@/lib/seed";

type UserRow = (typeof REGISTERED_USERS)[number];

export default function AdminMembersPage() {
  const { show, node } = useNotice();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<UserRow[]>([...REGISTERED_USERS]);
  const [editFor, setEditFor] = useState<UserRow | null>(null);
  const [loaded, setLoaded] = useState(false);

  // DB (profiles) එකෙන් load — sample data නෙමෙයි, ඇත්ත accounts ම
  async function load() {
    if (!isSupabaseConfigured()) { setLoaded(true); return; }
    try {
      const { data } = await authedClient().then((c) => c.from("profiles").select("*"));
      if (data && data.length > 0) {
        setRows(
          (data as unknown as Record<string, string>[]).map((r) => ({
            id: r.id,
            full_name: r.full_name ?? "",
            nic: r.nic ?? "",
            phone: r.phone ?? "",
            role: (r.role ?? "member") as UserRow["role"],
            joined_date: r.created_at ? new Date(r.created_at).toLocaleDateString() : "—",
            password_display: r.password_display ?? "",
            auth_email: r.auth_email ?? "",
          })) as UserRow[]
        );
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
              Super Admin: You can manage both Administrator and Registered Member accounts.
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
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold text-slate-800">{r.full_name}</td>
                  <td className="tabular-nums text-slate-600">{r.nic}</td>
                  <td className="tabular-nums text-slate-600">{r.phone}</td>
                  {/* ✅ user requirement: current password එක පෙන්වන්න ඕන */}
                  <td>
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
                  </td>
                  <td>
                    {r.role === "superadmin" ? (
                      <span className="badge-amber rounded-full px-2.5 py-1 text-[10.5px] font-bold inline-flex items-center gap-1">
                        <Eye size={11} /> Super Admin
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-900 text-white px-2.5 py-1 text-[10.5px] font-bold inline-flex items-center gap-1">
                        <Eye size={11} /> Admin
                      </span>
                    )}
                  </td>
                  <td className="tabular-nums text-slate-500">{r.joined_date}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <button
                        className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-700"
                        onClick={() => setEditFor(r)}
                      >
                        <Pencil size={14} />
                      </button>
                      {r.role !== "superadmin" && (
                        <button
                          className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-600"
                          onClick={async () => {
                            setRows((rs) => rs.filter((x) => x.id !== r.id));
                            const err = await dbDelete("profiles", r.id ? { id: r.id } : { nic: r.nic });
                            await load();
                            show(err ? `⚠ ${err}` : "✅ Deleted");
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editFor && (
        <AdminModal title="Edit Member" sub={`${editFor.full_name} — update කර Save ඔබන්න`} onClose={() => setEditFor(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const patch = {
                full_name: String(fd.get("full_name")),
                phone: String(fd.get("phone")),
                nic: String(fd.get("nic")),
                auth_email: String(fd.get("auth_email")),
                role: String(fd.get("role")),
              };
              const err = await dbUpdate("profiles", { id: editFor.id }, patch);
              setEditFor(null);
              await load();
              show(err ? `⚠ ${err}` : "✅ Member updated");
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
              <select name="role" className="field" defaultValue={editFor.role}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </div>
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
