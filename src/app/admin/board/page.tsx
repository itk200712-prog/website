"use client";

// ============================================================================
// Board of Directors Management — add / edit / reorder / delete
// (edit pencil එක → live edit modal; DB load + photo upload සමඟ)
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Pencil, Plus, Search, Trash2, Upload, UserPlus, UsersRound } from "lucide-react";
import { AdminModal, AdminTopbar, dbDelete, dbInsert, dbUpdate, useNotice } from "@/components/admin";
import { authedClient, createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { uploadSiteImage } from "@/lib/supabase/storage";
import { BOARD } from "@/lib/seed";
import type { BoardMember } from "@/lib/types";

type Row = BoardMember & { id?: string };

const CATS = [
  { key: "all", label: "All" },
  { key: "chairman", label: "Chairman" },
  { key: "vice-chairman", label: "Vice Chairman" },
  { key: "director", label: "Directors" },
  { key: "officer", label: "Officers" },
];

const PILL: Record<BoardMember["category"], string> = {
  chairman: "badge-amber",
  "vice-chairman": "badge-blue",
  director: "badge-green",
  officer: "badge-red",
};

export default function AdminBoardPage() {
  const { show, node } = useNotice();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [modal, setModal] = useState(false);
  const [editFor, setEditFor] = useState<Row | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [members, setMembers] = useState<Row[]>([...BOARD]);
  const [loaded, setLoaded] = useState(false);

  // DB එකෙන් load — seed නෙමෙයි, saved data ම පෙන්වන්න
  async function load() {
    if (!isSupabaseConfigured()) { setLoaded(true); return; }
    try {
      const { data } = await (await authedClient()).from("board_members").select("*").order("order");
      if (data && data.length > 0) setMembers(data as unknown as Row[]);
    } catch { /* ignore */ }
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return members.filter(
      (m) =>
        (cat === "all" || m.category === cat) &&
        (!s || m.name_en.toLowerCase().includes(s) || m.name_si.includes(q.trim()) || m.email.toLowerCase().includes(s))
    );
  }, [q, cat, members]);

  function openAdd() {
    setEditFor(null);
    setPhoto(null);
    setModal(true);
  }
  function openEdit(m: Row) {
    setEditFor(m);
    setPhoto(m.photo ?? null);
    setModal(true);
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const r = await uploadSiteImage(f, "board");
    setUploading(false);
    if (r && r.url) {
      setPhoto(r.url);
      show("✅ Photo upload වුණා — Save ඔබන්න");
    } else {
      show(`⚠ ${r && r.error ? r.error : "upload failed"}`);
    }
  }

  async function submitMember(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const row = {
      order: Number(fd.get("order")) || members.length + 1,
      category: String(fd.get("category")) as BoardMember["category"],
      name_en: String(fd.get("name_en")),
      name_si: String(fd.get("name_si")),
      position_en: String(fd.get("position_en")),
      position_si: String(fd.get("position_si")),
      qualification: String(fd.get("qualification")),
      phone: String(fd.get("phone")),
      email: String(fd.get("email")),
      address: String(fd.get("address")),
      photo,
    };
    let err: string | null;
    if (editFor) {
      const match = editFor.id ? { id: editFor.id } : { name_en: editFor.name_en };
      err = await dbUpdate("board_members", match, row);
    } else {
      err = await dbInsert("board_members", row as unknown as Record<string, unknown>);
    }
    setModal(false);
    await load();
    show(err ? `⚠ ${err}` : editFor ? "✅ Board member updated" : "✅ Board member added");
  }

  async function removeMember(m: Row) {
    setMembers((xs) => xs.filter((x) => (m.id ? x.id !== m.id : x.name_en !== m.name_en)));
    const err = await dbDelete("board_members", m.id ? { id: m.id } : { name_en: m.name_en });
    await load();
    show(err ? `⚠ ${err}` : "✅ Deleted");
  }

  return (
    <div>
      <AdminTopbar title="Board of Directors Management" sub="Add, edit, reorder, and manage Board of Directors profiles, photos, and designations" />
      {node}

      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <UsersRound size={20} className="text-indigo-700" /> Board of Directors Management
            </h2>
            <p className="text-slate-500 text-[12px] mt-1">
              Manage leadership profiles, qualifications, and designations displayed on the official website.
            </p>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add Board Member
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-5">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="field !pl-10" placeholder="Search by name, position, or email..." />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATS.map((c) => (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={`rounded-full px-4 py-2 text-[12px] font-bold border ${
                  cat === c.key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mt-6">
          {filtered.map((m) => (
            <div key={`${m.order}-${m.name_en}`} className="rounded-2xl border border-slate-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {m.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photo} alt={m.name_en} className="w-11 h-11 rounded-2xl object-cover" />
                  ) : (
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center text-[12px] font-black">
                      {m.name_en.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </div>
                  )}
                  <div>
                    <span className={`${PILL[m.category]} rounded-full px-2.5 py-0.5 text-[9.5px] font-bold`}>
                      {m.category === "officer" ? "Administrative Officer" : m.category.replace("-", " ")}
                    </span>
                    <div className="font-extrabold text-slate-900 text-[13.5px] mt-1 leading-snug">{m.name_en}</div>
                    <div className="text-slate-500 text-[11.5px]">{m.position_en}</div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 font-semibold">Order: {m.order}</div>
              </div>
              <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-[11px] text-slate-600">
                🎓 {m.qualification}
              </div>
              <div className="mt-2.5 space-y-1 text-[11.5px] text-slate-600">
                <div>📞 {m.phone}</div>
                <div>✉ {m.email}</div>
              </div>
              <div className="flex items-center justify-between mt-3.5">
                <div className="text-[11.5px] text-slate-400">{m.name_si}</div>
                <div className="flex gap-1.5">
                  <button
                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-700"
                    title="Edit member"
                    onClick={() => openEdit(m)}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-600"
                    title="Delete member"
                    onClick={() => removeMember(m)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {loaded && filtered.length === 0 && (
          <p className="text-center text-slate-400 text-[13px] mt-8">Members කෙනෙක් නැහැ — "Add Board Member" ඔබලා එකතු කරන්න.</p>
        )}
      </div>

      {modal && (
        <AdminModal
          title={editFor ? "Edit Board Member" : "Add Board Member"}
          sub={editFor ? `${editFor.name_en} — details update කර Save ඔබන්න` : "Add one or more leaders to the official board page"}
          onClose={() => setModal(false)}
          wide
        >
          <form key={editFor ? `edit-${editFor.id ?? editFor.name_en}` : "add"} onSubmit={submitMember} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label">Full Name (Sinhala) *</label>
                <input name="name_si" required className="field" defaultValue={editFor?.name_si ?? ""} placeholder="උදා: H.H.D නිමල් පෙරේරා" />
              </div>
              <div>
                <label className="field-label">Full Name (English) *</label>
                <input name="name_en" required className="field" defaultValue={editFor?.name_en ?? ""} placeholder="e.g. Emal Priyantha Herath" />
              </div>
              <div>
                <label className="field-label">Position (Sinhala) *</label>
                <input name="position_si" required className="field" defaultValue={editFor?.position_si ?? ""} placeholder="උදා: සභාපති / අධ්‍යක්ෂ" />
              </div>
              <div>
                <label className="field-label">Position (English) *</label>
                <input name="position_en" required className="field" defaultValue={editFor?.position_en ?? ""} placeholder="e.g. Chairman / Director" />
              </div>
              <div>
                <label className="field-label">Category / Role Tier</label>
                <select name="category" className="field" defaultValue={editFor?.category ?? "director"}>
                  <option value="chairman">Chairman (සභාපති)</option>
                  <option value="vice-chairman">Vice Chairman (උප සභාපති)</option>
                  <option value="director">Board Director (අධ්‍යක්ෂ)</option>
                  <option value="officer">Administrative Officer (නිලධාරී)</option>
                </select>
              </div>
              <div>
                <label className="field-label">Display Order (Rank)</label>
                <input name="order" type="number" className="field" defaultValue={editFor?.order ?? members.length + 1} />
              </div>
            </div>
            <div>
              <label className="field-label">Qualifications / Honors</label>
              <input name="qualification" className="field" defaultValue={editFor?.qualification ?? ""} placeholder="e.g. B.Com. (Hons) — University of Kelaniya" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label">Phone Number</label>
                <input name="phone" className="field" defaultValue={editFor?.phone ?? ""} placeholder="e.g. 071 229 1011" />
              </div>
              <div>
                <label className="field-label">Email Address</label>
                <input name="email" className="field" defaultValue={editFor?.email ?? ""} placeholder="e.g. chairman@mpcs.lk" />
              </div>
            </div>
            <div>
              <label className="field-label">Address</label>
              <input name="address" className="field" defaultValue={editFor?.address ?? ""} placeholder="e.g. කුරුණෑගල පාර, හෙට්ටිපොල, ශ්‍රී ලංකා" />
            </div>
            <div>
              <label className="field-label">Profile Photo (Optional)</label>
              <div className="flex items-center gap-3">
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="preview" className="w-12 h-12 rounded-xl object-cover border border-slate-200" />
                )}
                <label className="btn btn-outline cursor-pointer">
                  <Upload size={14} /> {uploading ? "Uploading…" : photo ? "Change Photo" : "Upload from Device"}
                  <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">
                {editFor ? <><Pencil size={15} /> Save Changes</> : <><UserPlus size={16} /> Add Member</>}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
