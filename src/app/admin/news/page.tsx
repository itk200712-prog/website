"use client";

// ============================================================================
// News & Notices — Create New Announcement + list management
// ============================================================================

import { useState } from "react";
import { Eye, Newspaper, Pencil, Pin, Plus, Search, Trash2 } from "lucide-react";
import { AdminModal, AdminTopbar, dbInsert, useNotice } from "@/components/admin";
import { uploadSiteImage } from "@/lib/supabase/storage";
import { NEWS } from "@/lib/seed";
import type { NewsItem } from "@/lib/types";

const TABS = ["all", "vacancy", "notice", "tender", "general"];

export default function AdminNewsPage() {
  const { show, node } = useNotice();
  const [modal, setModal] = useState(false);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [items, setItems] = useState<NewsItem[]>([...NEWS]);

  const filtered = items.filter(
    (n) =>
      (tab === "all" || n.category === tab) &&
      (!q || n.title_en.toLowerCase().includes(q.toLowerCase()) || n.desc_en.toLowerCase().includes(q.toLowerCase()))
  );

  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const r = await uploadSiteImage(f, "news");
    setUploading(false);
    if (r && r.url) { setPhoto(r.url); show("✅ Photo upload වුණා — Add ඔබන්න"); }
    else show(`⚠ ${r && r.error ? r.error : "upload failed"}`);
  }

  async function addAnnouncement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const row: NewsItem = {
      id: `news-${Date.now()}`,
      category: String(fd.get("category")) as NewsItem["category"],
      badge_text: String(fd.get("badge")) || null,
      title_en: String(fd.get("title_en")),
      title_si: String(fd.get("title_si")),
      desc_en: String(fd.get("desc_en")),
      desc_si: String(fd.get("desc_si")),
      date: new Date().toISOString().slice(0, 10),
      image: photo || String(fd.get("image")) || "/images/news/notice.jpg",
      pinned: fd.get("pinned") === "on",
      published: fd.get("published") === "on",
    };
    setItems((xs) => [row, ...xs]);
    const err = await dbInsert("news", row as unknown as Record<string, unknown>);
    setModal(false);
    setPhoto(null);
    show(err ? `⚠ ${err}` : "✅ Announcement added");
  }

  return (
    <div>
      <AdminTopbar title="News & Notices" sub="Manage official notices, driver / job vacancies, and public announcements" />
      {node}

      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <Newspaper size={20} className="text-indigo-700" /> News &amp; Notices
          </h2>
          <button className="btn btn-primary" onClick={() => setModal(true)}>
            <Plus size={16} /> Add Announcement
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-5">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="field !pl-10" placeholder="Search notices by headline or content..." />
          </div>
          <div className="flex flex-wrap gap-2">
            {TABS.map((x) => (
              <button
                key={x}
                onClick={() => setTab(x)}
                className={`rounded-full px-4 py-2 text-[12px] font-bold border ${tab === x ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"}`}
              >
                {x[0].toUpperCase() + x.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2 mt-6">
          {filtered.map((n) => (
            <div key={n.id} className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="h-28 bg-gradient-to-br from-indigo-900 to-slate-800 relative">
                <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                  <span className="badge-blue rounded-full px-2.5 py-0.5 text-[9.5px] font-bold uppercase">{n.category}</span>
                  {n.pinned && <span className="badge-pinned rounded-full px-2.5 py-0.5 text-[9.5px] font-bold">📌 Pinned</span>}
                  {n.published && <span className="badge-green rounded-full px-2.5 py-0.5 text-[9.5px] font-bold">Published</span>}
                </div>
                <div className="absolute bottom-2.5 right-3 text-white/50 text-[10px]">{n.date}</div>
              </div>
              <div className="p-4">
                <div className="font-extrabold text-slate-900 text-[14px] leading-snug">{n.title_en}</div>
                <p className="text-slate-500 text-[11.5px] mt-1.5 leading-relaxed line-clamp-2">{n.desc_en}</p>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex gap-1">
                    <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-amber-600" onClick={() => show(n.pinned ? "Unpinned" : "Pinned to homepage top")}>
                      <Pin size={13} />
                    </button>
                    <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500" onClick={() => show("Preview")}>
                      <Eye size={13} />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button className="btn btn-outline !py-1 !px-2.5 !text-[11px]" onClick={() => show("Edit announcement")}>
                      <Pencil size={12} /> Edit
                    </button>
                    <button
                      className="w-8 h-8 rounded-lg border border-red-200 flex items-center justify-center text-red-500"
                      onClick={() => setItems((xs) => xs.filter((x) => x.id !== n.id))}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <AdminModal title="Create New Announcement" onClose={() => setModal(false)} wide>
          <form onSubmit={addAnnouncement} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label">Category *</label>
                <select name="category" className="field" defaultValue="notice">
                  <option value="vacancy">Job Vacancy (රැකියා නිවේදන)</option>
                  <option value="notice">Special Notice (විශේෂ නිවේදන)</option>
                  <option value="tender">Tender (ටෙන්ඩර්)</option>
                  <option value="general">General (සාමාන්‍ය)</option>
                </select>
              </div>
              <div>
                <label className="field-label">Badge Text (Optional)</label>
                <input name="badge" className="field" placeholder="e.g. Job Vacancy / Urgent" />
              </div>
            </div>
            <div>
              <label className="field-label">Headline / Title (Sinhala) *</label>
              <input name="title_si" required className="field" placeholder="උදා: බර වාහන රියදුරන් බඳවා ගැනීම පිළිබඳ නිවේදනය" />
            </div>
            <div>
              <label className="field-label">Headline / Title (English)</label>
              <input name="title_en" className="field" placeholder="e.g. Call for Applications: Heavy Vehicle Driver Vacancies" />
            </div>
            <div>
              <label className="field-label">Full Notice Description (Sinhala) *</label>
              <textarea name="desc_si" required rows={4} className="field" placeholder="සම්පූර්ණ නිවේදන විස්තර..." />
            </div>
            <div>
              <label className="field-label">Full Notice Description (English)</label>
              <textarea name="desc_en" rows={4} className="field" placeholder="Full notice requirements, benefits, and application guidelines in English..." />
            </div>
            <div>
              <label className="field-label">Notice Banner Image</label>
              <div className="flex gap-2.5">
                <label className="btn btn-outline flex-1 !justify-start cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
                  {photo && <img src={photo} alt="preview" className="w-9 h-9 rounded-lg object-cover" />}
                  ⬆ Choose Image File (jpg, .png, .webp)
                </label>
                <input name="image" className="field flex-1" placeholder="or enter image path / URL" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-700">
                <input type="checkbox" name="pinned" className="accent-indigo-700 w-4 h-4" /> Pin this notice to top of homepage
              </label>
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-700">
                <input type="checkbox" name="published" defaultChecked className="accent-indigo-700 w-4 h-4" /> Publish immediately (Visible on website)
              </label>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">✓ Add Announcement</button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
