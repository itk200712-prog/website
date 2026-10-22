"use client";

// ============================================================================
// News & Notices — add / edit / delete / pin (සේරම DB එකට save වෙනවා)
// ============================================================================

import { useEffect, useState } from "react";
import { Eye, Pencil, Pin, Plus, Search, Trash2, Upload } from "lucide-react";
import { AdminModal, AdminTopbar, dbDelete, dbInsert, dbUpdate, useNotice } from "@/components/admin";
import { MediaDetailsStrip, MediaSizeBadge } from "@/components/media-info";
import { authedClient, createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { uploadSiteImage } from "@/lib/supabase/storage";
import { NEWS } from "@/lib/seed";
import type { NewsItem } from "@/lib/types";

export default function AdminNewsPage() {
  const { show, node } = useNotice();
  const [modal, setModal] = useState(false);
  const [editFor, setEditFor] = useState<NewsItem | null>(null);
  const [preview, setPreview] = useState<NewsItem | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<NewsItem[]>([...NEWS]);
  const [q, setQ] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function load() {
    if (!isSupabaseConfigured()) { setLoaded(true); return; }
    try {
      const { data } = await (await authedClient()).from("news").select("*").order("date", { ascending: false });
      if (data) setItems(data as unknown as NewsItem[]);
    } catch { /* ignore */ }
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  function openAdd() { setEditFor(null); setPhoto(null); setModal(true); }
  function openEdit(n: NewsItem) { setEditFor(n); setPhoto(n.image || null); setModal(true); }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const r = await uploadSiteImage(f, "news");
    setUploading(false);
    if (r && r.url) { setPhoto(r.url); show("✅ Photo upload වුණා — Save ඔබන්න"); }
    else show(`⚠ ${r && r.error ? r.error : "upload failed"}`);
  }

  async function submitItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const row = {
      id: editFor?.id ?? `news-${Date.now()}`,
      category: String(fd.get("category")) as NewsItem["category"],
      badge_text: String(fd.get("badge")) || null,
      title_en: String(fd.get("title_en")),
      title_si: String(fd.get("title_si")),
      desc_en: String(fd.get("desc_en")),
      desc_si: String(fd.get("desc_si")),
      date: editFor?.date ?? new Date().toISOString().slice(0, 10),
      image: photo || String(fd.get("image")) || "",
      pinned: fd.get("pinned") === "on",
      published: fd.get("published") === "on",
    };
    const err = editFor
      ? await dbUpdate("news", { id: editFor.id }, row)
      : await dbInsert("news", row as unknown as Record<string, unknown>);
    setModal(false);
    setPhoto(null);
    await load();
    show(err ? `⚠ ${err}` : editFor ? "✅ Announcement updated" : "✅ Announcement added");
  }

  async function removeItem(n: NewsItem) {
    setItems((xs) => xs.filter((x) => x.id !== n.id));
    const err = await dbDelete("news", { id: n.id });
    await load();
    show(err ? `⚠ ${err}` : "✅ Deleted");
  }

  async function togglePin(n: NewsItem) {
    setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, pinned: !x.pinned } : x)));
    const err = await dbUpdate("news", { id: n.id }, { pinned: !n.pinned });
    show(err ? `⚠ ${err}` : n.pinned ? "✅ Unpinned" : "✅ Pinned to homepage top");
    await load();
  }

  const filtered = items.filter(
    (n) => !q.trim() || n.title_en.toLowerCase().includes(q.toLowerCase()) || n.title_si.includes(q.trim())
  );

  return (
    <div>
      <AdminTopbar title="News & Notices Management" sub="Publish announcements, tenders, and vacancies on the official website" />
      {node}

      <div className="card p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} className="field !pl-10" placeholder="Search announcements..." />
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add Announcement
        </button>
      </div>

      <div className="space-y-4 mt-5">
        {filtered.map((n) => (
          <div key={n.id} className="card p-5 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1 min-w-[260px]">
              {n.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={n.image} alt={n.title_en} className="w-16 h-16 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-800 text-white/30 flex items-center justify-center shrink-0 text-[10px]">NEWS</div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge-blue rounded-full px-2 py-0.5 text-[9.5px] font-bold">{n.category}</span>
                  {n.pinned && <span className="badge-amber rounded-full px-2 py-0.5 text-[9.5px] font-bold">PINNED</span>}
                  <span className="text-slate-400 text-[10px]">{n.date}</span>
                </div>
                <div className="font-extrabold text-slate-900 text-[14px] mt-1">{n.title_en}</div>
                <div className="text-slate-500 text-[11.5px]">{n.title_si}</div>
                {n.image && (
                  <div className="mt-2">
                    <MediaSizeBadge src={n.image} variant="light" showName />
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button className="btn btn-outline !py-1.5 !px-3 !text-[11.5px]" title="Preview" onClick={() => setPreview(n)}>
                <Eye size={13} />
              </button>
              <button className="btn btn-outline !py-1.5 !px-3 !text-[11.5px]" title={n.pinned ? "Unpin" : "Pin to top"} onClick={() => togglePin(n)}>
                <Pin size={13} /> {n.pinned ? "Unpin" : "Pin"}
              </button>
              <button className="btn btn-outline !py-1.5 !px-3 !text-[11.5px]" onClick={() => openEdit(n)}>
                <Pencil size={13} /> Edit
              </button>
              <button className="btn btn-outline !py-1.5 !px-3 !text-[11.5px] !text-red-600 !border-red-200" onClick={() => removeItem(n)}>
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>
        ))}
        {loaded && filtered.length === 0 && (
          <p className="text-center text-slate-400 text-[13px]">News නෑ — "Add Announcement" ඔබලා එකතු කරන්න.</p>
        )}
      </div>

      {preview && (
        <AdminModal title={preview.title_en} sub={preview.title_si} onClose={() => setPreview(null)}>
          {preview.image && (
            <div className="relative mb-4 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.image} alt="" className="max-h-64 w-full object-cover" />
              <MediaSizeBadge src={preview.image} showName className="absolute bottom-3 right-3" />
            </div>
          )}
          <p className="text-slate-600 text-[13.5px] leading-relaxed">{preview.desc_en}</p>
          <p className="text-slate-500 text-[13px] leading-relaxed mt-3">{preview.desc_si}</p>
          {preview.image && <MediaDetailsStrip src={preview.image} className="mt-4" />}
          <div className="flex justify-end pt-4">
            <button className="btn btn-outline" onClick={() => setPreview(null)}>Close</button>
          </div>
        </AdminModal>
      )}

      {modal && (
        <AdminModal
          title={editFor ? "Edit Announcement" : "Add Announcement"}
          sub={editFor ? `${editFor.title_en} — update කර Save ඔබන්න` : "News, notices, tenders, vacancies"}
          onClose={() => { setModal(false); setPhoto(null); }}
          wide
        >
          <form key={editFor ? `edit-${editFor.id}` : "add"} onSubmit={submitItem} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label">Category</label>
                <select name="category" className="field" defaultValue={editFor?.category ?? "notice"}>
                  <option value="notice">Notice</option>
                  <option value="vacancy">Vacancy</option>
                  <option value="tender">Tender</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div>
                <label className="field-label">Badge Text (Optional)</label>
                <input name="badge" className="field" defaultValue={editFor?.badge_text ?? ""} placeholder="e.g. NEW" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label">Title (English) *</label>
                <input name="title_en" required className="field" defaultValue={editFor?.title_en ?? ""} />
              </div>
              <div>
                <label className="field-label">Title (Sinhala) *</label>
                <input name="title_si" required className="field" defaultValue={editFor?.title_si ?? ""} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label">Description (English)</label>
                <textarea name="desc_en" rows={3} className="field" defaultValue={editFor?.desc_en ?? ""} />
              </div>
              <div>
                <label className="field-label">Description (Sinhala)</label>
                <textarea name="desc_si" rows={3} className="field" defaultValue={editFor?.desc_si ?? ""} />
              </div>
            </div>
            <div>
              <label className="field-label">Cover Photo</label>
              <div className="flex items-center gap-3">
                {photo && (
                  <span className="flex shrink-0 flex-col items-center gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt="preview" className="w-14 h-14 rounded-xl object-cover border border-slate-200" />
                    <MediaSizeBadge src={photo} variant="light" />
                  </span>
                )}
                <label className="btn btn-outline cursor-pointer">
                  <Upload size={14} /> {uploading ? "Uploading…" : photo ? "Change Photo" : "Upload from Device"}
                  <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
                </label>
              </div>
              <input name="image" className="field mt-2.5" defaultValue={editFor?.image ?? ""} placeholder="or enter image path / URL" />
            </div>
            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-700">
                <input type="checkbox" name="pinned" defaultChecked={editFor?.pinned ?? false} /> Pinned to homepage top
              </label>
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-700">
                <input type="checkbox" name="published" defaultChecked={editFor?.published ?? true} /> Published (public එකේ පේනවා)
              </label>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" className="btn btn-outline" onClick={() => { setModal(false); setPhoto(null); }}>Cancel</button>
              <button type="submit" className="btn btn-primary">{editFor ? <><Pencil size={15} /> Save Changes</> : "✓ Add Announcement"}</button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
