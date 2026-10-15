"use client";

// ============================================================================
// Gallery Moderation — add / edit / delete + photo upload (save වෙන විදියට)
// ============================================================================

import { useEffect, useState } from "react";
import { ImageIcon, MessageSquare, Pencil, Plus, Search, ThumbsUp, Trash2, Upload } from "lucide-react";
import { AdminModal, AdminTopbar, dbDelete, dbInsert, dbUpdate, useNotice } from "@/components/admin";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { uploadSiteImage } from "@/lib/supabase/storage";
import { GALLERY } from "@/lib/seed";
import type { GalleryItem } from "@/lib/types";

export default function AdminGalleryPage() {
  const { show, node } = useNotice();
  const [modal, setModal] = useState(false);
  const [editFor, setEditFor] = useState<GalleryItem | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<GalleryItem[]>([...GALLERY]);
  const [loaded, setLoaded] = useState(false);

  // DB එකෙන් load — comments field එක table එකේ නැති නිසා [] default
  async function load() {
    if (!isSupabaseConfigured()) { setLoaded(true); return; }
    try {
      const { data } = await createClient().from("gallery_items").select("*");
      if (data && data.length > 0) {
        setItems(
          (data as unknown as GalleryItem[]).map((g) => ({
            ...g,
            comments: Array.isArray(g.comments) ? g.comments : [],
            likes: typeof g.likes === "number" ? g.likes : 0,
          }))
        );
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditFor(null);
    setPhoto(null);
    setModal(true);
  }
  function openEdit(g: GalleryItem) {
    setEditFor(g);
    setPhoto(g.image || null);
    setModal(true);
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const r = await uploadSiteImage(f, "gallery");
    setUploading(false);
    if (r && r.url) { setPhoto(r.url); show("✅ Photo upload වුණා — Save ඔබන්න"); }
    else show(`⚠ ${r && r.error ? r.error : "upload failed"}`);
  }

  async function submitItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // table columns ට පමණයි — comments column එක නැති නිසා insert fail නොවෙන්න
    const row = {
      id: editFor?.id ?? `gal-${Date.now()}`,
      title: String(fd.get("title")) || `Photo ${items.length + 1}`,
      description: String(fd.get("description")),
      aspect: String(fd.get("aspect")) as GalleryItem["aspect"],
      image: photo || String(fd.get("image")) || "",
      likes: editFor?.likes ?? 0,
    };
    let err: string | null;
    if (editFor) {
      err = await dbUpdate("gallery_items", { id: editFor.id }, row);
    } else {
      err = await dbInsert("gallery_items", row as unknown as Record<string, unknown>);
    }
    setModal(false);
    setPhoto(null);
    await load();
    show(err ? `⚠ ${err}` : editFor ? "✅ Gallery item updated" : "✅ Gallery item added (public එකේ පේනවා)");
  }

  async function removeItem(g: GalleryItem) {
    setItems((xs) => xs.filter((x) => x.id !== g.id));
    const err = await dbDelete("gallery_items", { id: g.id });
    await load();
    show(err ? `⚠ ${err}` : "✅ Deleted");
  }

  return (
    <div>
      <AdminTopbar title="Gallery Moderation" sub="Review and manage member records, moderate gallery discussions, and configure communication preferences." />
      {node}

      <div className="card p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="field !pl-10" placeholder="Search gallery posts or comments..." />
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add Gallery Item
        </button>
      </div>

      <div className="space-y-5 mt-5">
        {items.map((g) => (
          <div key={g.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                {g.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.image} alt={g.title} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-slate-800 text-white/30 flex items-center justify-center shrink-0">
                    <ImageIcon size={26} />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-[15px]">{g.title}</span>
                    <span className="badge-amber rounded-full px-2 py-0.5 text-[9.5px] font-bold">{g.aspect}</span>
                  </div>
                  <div className="text-slate-500 text-[11.5px] mt-0.5">{g.description}</div>
                  <div className="flex items-center gap-3.5 mt-1.5 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1"><ThumbsUp size={12} /> {(g.likes ?? 0)} Likes</span>
                    <span className="flex items-center gap-1"><MessageSquare size={12} /> {(g.comments?.length ?? 0)} Comments</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button className="btn btn-outline !py-1.5 !px-3 !text-[11.5px]" onClick={() => openEdit(g)}>
                  <Pencil size={13} /> Edit
                </button>
                <button
                  className="btn btn-outline !py-1.5 !px-3 !text-[11.5px] !text-red-600 !border-red-200"
                  onClick={() => removeItem(g)}
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Comments:</div>
              {(g.comments?.length ?? 0) === 0 ? (
                <div className="text-slate-400 text-[11.5px] italic mt-1">No comments on this post.</div>
              ) : (
                <div className="space-y-1.5 mt-1.5">
                  {g.comments.map((c) => (
                    <div key={c.id} className="text-[12px] text-slate-600">
                      <strong>{c.author}:</strong> {c.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loaded && items.length === 0 && (
          <p className="text-center text-slate-400 text-[13px]">Gallery එක හිස් — "Add Gallery Item" ඔබලා ඡායාරූප එකතු කරන්න.</p>
        )}
      </div>

      {modal && (
        <AdminModal
          title={editFor ? "Edit Gallery Item" : "Add New Gallery Item"}
          sub={editFor ? `${editFor.title} — update කර Save ඔබන්න` : "Photo එකක් upload කරලා save කරන්න"}
          onClose={() => { setModal(false); setPhoto(null); }}
        >
          <form key={editFor ? `edit-${editFor.id}` : "add"} onSubmit={submitItem} className="space-y-4">
            <div>
              <label className="field-label">Photo Title / Identifier (Optional)</label>
              <input name="title" className="field" defaultValue={editFor?.title ?? ""} placeholder="e.g. AGM 2026 or leave blank for auto-id" />
            </div>
            <div>
              <label className="field-label">Aspect Ratio</label>
              <div className="flex flex-wrap gap-2">
                {(["4:3", "16:9", "1:1", "3:2"] as const).map((a, i) => (
                  <label key={a} className="cursor-pointer">
                    <input
                      type="radio"
                      name="aspect"
                      value={a}
                      defaultChecked={editFor ? editFor.aspect === a : i === 0}
                      className="peer sr-only"
                    />
                    <span className="inline-block rounded-xl border border-slate-200 px-5 py-2 text-[13px] font-bold text-slate-600 peer-checked:bg-indigo-700 peer-checked:text-white peer-checked:border-indigo-700">
                      {a}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="field-label">Description (Optional)</label>
              <textarea name="description" rows={3} className="field" defaultValue={editFor?.description ?? ""} placeholder="Enter a description for this photo..." />
            </div>
            <div>
              <label className="field-label">Gallery Photo *</label>
              <div className="flex items-center gap-3">
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="preview" className="w-14 h-14 rounded-xl object-cover border border-slate-200" />
                )}
                <label className="btn btn-outline cursor-pointer">
                  <Upload size={14} /> {uploading ? "Uploading…" : photo ? "Change Photo" : "Upload from Device"}
                  <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
                </label>
              </div>
              <input name="image" className="field mt-2.5" defaultValue={editFor?.image ?? ""} placeholder="or enter image path / URL" />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" className="btn btn-outline" onClick={() => { setModal(false); setPhoto(null); }}>Cancel</button>
              <button type="submit" className="btn btn-primary">
                {editFor ? <><Pencil size={15} /> Save Changes</> : "✓ Add Gallery Item"}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
