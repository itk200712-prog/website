"use client";

// ============================================================================
// F28 — සමිතියේ ගිනුම් (Profit & Loss) — selected members ට පමනක් පෙනෙන අංශය
//   Tab 1: F28 members (Add Member → name/NIC list → "Do You Want to Authenticate?" No/Yes)
//          + Disable / Enable / Delete (deleted කෙනෙක් ආයෙත් authenticate කරන්න පුළුවන්)
//   Tab 2: F28 posts (ලාබ-අලාබ documents/images දාන තැන) — authenticated members ට පේනවා
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Image as ImageIcon, Lock, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { AdminModal, AdminTopbar, dbDelete, dbInsert, dbUpdate, dbUpsert, useNotice } from "@/components/admin";
import { authedClient } from "@/lib/supabase/client";
import { uploadSiteImage } from "@/lib/supabase/storage";

interface F28Member {
  id: string;
  user_id: string;
  nic: string;
  full_name: string;
  status: "active" | "disabled";
}
interface F28Item {
  id: string;
  title: string;
  description: string;
  file_url: string;
}
interface UserRow {
  id: string;
  full_name: string;
  nic: string;
  role: string;
}

export default function AdminF28Page() {
  const { show, node } = useNotice();
  const [tab, setTab] = useState<"members" | "posts">("members");
  const [members, setMembers] = useState<F28Member[]>([]);
  const [items, setItems] = useState<F28Item[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState("");
  const [confirmUser, setConfirmUser] = useState<UserRow | null>(null);
  const [photo, setPhoto] = useState<string>("");

  async function load() {
    const sb = await authedClient();
    const ms = await sb.from("f28_members").select("*").order("created_at", { ascending: false });
    if (!ms.error && ms.data) setMembers(ms.data as unknown as F28Member[]);
    const ps = await sb.from("f28_items").select("*").order("created_at", { ascending: false });
    if (!ps.error && ps.data) setItems(ps.data as unknown as F28Item[]);
  }
  useEffect(() => {
    (async () => {
      const sb = await authedClient();
      const us = await sb.from("profiles").select("id,full_name,nic,role").order("full_name");
      if (!us.error && us.data) setUsers(us.data as unknown as UserRow[]);
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users.filter((u) => !s || (u.full_name || "").toLowerCase().includes(s) || (u.nic || "").toLowerCase().includes(s));
  }, [q, users]);

  const inF28 = useMemo(() => {
    const map: Record<string, F28Member> = {};
    members.forEach((m) => (map[m.user_id] = m));
    return map;
  }, [members]);

  async function authenticate(u: UserRow) {
    setConfirmUser(null);
    const existing = inF28[u.id];
    let err: string | null;
    if (existing) {
      // දැනටම තියෙනවා (disabled නම්) → active කරනවා; deleted නම් පහළ ඇතුලත් කිරීම වැඩ කරනවා
      err = await dbUpdate("f28_members", { id: existing.id }, { status: "active" });
    } else {
      err = await dbUpsert("f28_members", { user_id: u.id, nic: u.nic, full_name: u.full_name, status: "active" }, "user_id");
    }
    await load();
    show(err ? `⚠ ${err} — SQL (f28 tables) run කරලා තියෙනවද බලන්න` : `✅ ${u.full_name} — F28 access එකට ඇතුලත් කළා`);
  }

  async function setEnabled(m: F28Member, active: boolean) {
    setMembers((xs) => xs.map((x) => (x.id === m.id ? { ...x, status: active ? "active" : "disabled" } : x)));
    const err = await dbUpdate("f28_members", { id: m.id }, { status: active ? "active" : "disabled" });
    if (err) show(`⚠ ${err}`);
    else show(active ? "✅ Enabled — දැන් ආයෙ පේනවා" : "⏸ Disabled — තාවකාලිකව නෑ");
    await load();
  }

  async function remove(m: F28Member) {
    setMembers((xs) => xs.filter((x) => x.id !== m.id));
    const err = await dbDelete("f28_members", { id: m.id });
    show(err ? `⚠ ${err}` : "🗑️ Removed — ආයෙ add කරන්න පුළුවන්");
    await load();
  }

  async function uploadF28File(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    show("⏳ upload වෙමින්...");
    const res = await uploadSiteImage(f, "f28");
    if (res && res.url) {
      setPhoto(res.url);
      show("✅ file එක upload වුණා — Post කරන්න");
    } else show(`⚠ ${res && res.error ? res.error : "upload failed"}`);
  }

  return (
    <div>
      <AdminTopbar title="F28 — සමිතියේ ගිනුම් (Profit & Loss)" sub="තෝරාගත් සාමාජිකයන්ට පමනක් පෙනෙන ලාබ-අලාබ අංශය" />
      {node}

      {/* tabs */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab("members")} className={`btn ${tab === "members" ? "btn-primary" : "btn-outline"}`}>
          <UserPlus size={15} /> F28 Members ({members.length})
        </button>
        <button onClick={() => setTab("posts")} className={`btn ${tab === "posts" ? "btn-primary" : "btn-outline"}`}>
          <FileSpreadsheet size={15} /> F28 Posts ({items.length})
        </button>
      </div>

      {tab === "members" ? (
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2"><Lock size={17} /> Authenticate කරපු සාමාජිකයන්</h2>
              <p className="text-slate-500 text-[12.5px] mt-1">
                මෙතන ඉන්න අයට විතරක් login වූ පසු &quot;F28&quot; option එක පේනවා. Delete → ආයෙ add කරන්න පුළුවන්. Disable → තාවකාලිකව නෑ.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setAddOpen(true)}><Plus size={16} /> Add Member</button>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-slate-400 text-[11px] uppercase tracking-wider">
                  <th className="pb-2">Name</th><th className="pb-2">NIC</th><th className="pb-2">Status</th><th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="py-2.5 font-semibold text-slate-800">{m.full_name}</td>
                    <td className="py-2.5 text-slate-500">{m.nic}</td>
                    <td className="py-2.5">
                      {m.status === "active"
                        ? <span className="badge-green rounded-full px-2.5 py-0.5 text-[10px] font-bold">Active</span>
                        : <span className="badge-amber rounded-full px-2.5 py-0.5 text-[10px] font-bold">Disabled</span>}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button className="btn btn-outline !py-1 !px-2.5 !text-[11px]" onClick={() => setEnabled(m, m.status !== "active")}>
                          {m.status === "active" ? "⏸ Disable" : "✅ Enable"}
                        </button>
                        <button
                          className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-600"
                          onClick={() => remove(m)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-slate-400">තවම කවුරුත් නෑ — &quot;Add Member&quot; එබා ඇතුලත් කරන්න</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <div className="card p-6">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2"><FileSpreadsheet size={17} /> අලුත් F28 post එකක්</h2>
            <p className="text-slate-500 text-[12.5px] mt-1">ලාබ-අලාබ document/image එකක් දාන්න — authenticate කරපු අයට පමනක් පේනවා.</p>
            <form
              className="space-y-3 mt-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const err = await dbInsert("f28_items", {
                  title: String(fd.get("title")),
                  description: String(fd.get("description") || ""),
                  file_url: photo,
                });
                (e.currentTarget as HTMLFormElement).reset();
                setPhoto("");
                await load();
                show(err ? `⚠ ${err} — SQL (f28 tables) run කරලා තියෙනවද බලන්න` : "✅ F28 post එක දැම්මා");
              }}
            >
              <div>
                <label className="field-label">Title *</label>
                <input name="title" required className="field" placeholder="e.g. 2025 වසරේ ලාබ අලාබ වාර්තාව" />
              </div>
              <div>
                <label className="field-label">Description</label>
                <textarea name="description" rows={3} className="field" placeholder="කෙටි විස්තරයක්..." />
              </div>
              <div>
                <label className="field-label">File / Image (Optional)</label>
                <div className="flex items-center gap-3">
                  {photo && <img src={photo} alt="preview" className="w-12 h-12 rounded-xl object-cover border border-slate-200" />}
                  <label className="btn btn-outline cursor-pointer">
                    <ImageIcon size={14} /> {photo ? "Change File" : "Upload File"}
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={uploadF28File} />
                  </label>
                </div>
              </div>
              <button type="submit" className="btn btn-primary w-full"><Plus size={15} /> Post to F28</button>
            </form>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-extrabold text-slate-900">දැනට ඇති posts</h2>
            <div className="mt-4 space-y-3">
              {items.map((it) => (
                <div key={it.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 p-3.5">
                  {it.file_url
                    ? <img src={it.file_url} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-200" />
                    : <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center"><FileSpreadsheet size={18} className="text-slate-400" /></div>}
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-800 text-[13px] truncate">{it.title}</div>
                    <div className="text-slate-500 text-[11.5px] line-clamp-2">{it.description}</div>
                  </div>
                  <button
                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-600 shrink-0"
                    onClick={async () => {
                      setItems((xs) => xs.filter((x) => x.id !== it.id));
                      const err = await dbDelete("f28_items", { id: it.id });
                      if (err) show(`⚠ ${err}`);
                      await load();
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {items.length === 0 && <p className="text-slate-400 text-[13px] py-6 text-center">තවම posts නෑ</p>}
            </div>
          </div>
        </div>
      )}

      {/* ================= Add Member modal — name + NIC list ================= */}
      {addOpen && (
        <AdminModal title="Add Member — F28" sub="registered සාමාජිකයන් අතරින් තෝරන්න" onClose={() => setAddOpen(false)} wide>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="field !pl-9"
              placeholder="Select — නම හෝ NIC එකෙන් හොයන්න..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="mt-3 max-h-80 overflow-y-auto rounded-2xl border border-slate-100 divide-y divide-slate-50">
            {filtered.map((u) => {
              const cur = inF28[u.id];
              return (
                <button
                  key={u.id}
                  type="button"
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-indigo-50/50"
                  onClick={() => setConfirmUser(u)}
                >
                  <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-black shrink-0">
                    {(u.full_name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-800 text-[13px] truncate">{u.full_name}</div>
                    <div className="text-slate-500 text-[11.5px]">NIC: {u.nic} {u.role !== "member" ? `· ${u.role}` : ""}</div>
                  </div>
                  {cur && (
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cur.status === "active" ? "badge-green" : "badge-amber"}`}>
                      {cur.status === "active" ? "Active" : "Disabled"}
                    </span>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && <p className="p-6 text-center text-slate-400 text-[13px]">කවුරුත් හමු නොවුණා</p>}
          </div>
        </AdminModal>
      )}

      {/* ================= Do You Want to Authenticate? ================= */}
      {confirmUser && (
        <AdminModal title="Do You Want to Authenticate?" sub={`${confirmUser.full_name} (NIC: ${confirmUser.nic}) — F28 access එකට`} onClose={() => setConfirmUser(null)}>
          <div className="flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-[12.5px] text-amber-800">
            <CheckCircle2 size={18} className="shrink-0" />
            Yes දුන්නොත් මේ සාමාජිකයාට login වූ පසු &quot;F28&quot; option එක පේනවා. No දුන්නොත් කිසිවක් පේන්නෑ.
          </div>
          <div className="flex gap-2.5 mt-5">
            <button className="btn btn-outline flex-1" onClick={() => setConfirmUser(null)}>
              <X size={15} /> No
            </button>
            <button className="btn btn-primary flex-1" onClick={() => void authenticate(confirmUser)}>
              <CheckCircle2 size={15} /> Yes
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
