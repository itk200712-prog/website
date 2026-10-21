"use client";

// ============================================================================
// Gallery Moderation — add / edit / delete + photo upload (save වෙන විදියට)
// ============================================================================

import { useEffect, useState } from "react";
import { Eye, Heart, ImageIcon, Pencil, Plus, Reply, Search, ThumbsUp, Trash2, Upload } from "lucide-react";
import { CommentImageIcon as MessageSquare } from "@/components/site-icons";
import { buildGalleryCommentTree, normalizeGalleryCount } from "@/lib/gallery-social";
import { AdminModal, AdminTopbar, dbDelete, dbInsert, dbInsertMany, dbUpdate, useNotice } from "@/components/admin";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { uploadSiteImage } from "@/lib/supabase/storage";
import { GALLERY } from "@/lib/seed";
import type { GalleryComment, GalleryItem } from "@/lib/types";

export default function AdminGalleryPage() {
  const { show, node } = useNotice();
  const [modal, setModal] = useState(false);
  const [editFor, setEditFor] = useState<GalleryItem | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  // එකම tagline එක යටතේ එකවර upload කරන photos 2–3 (Add mode එකේදී විතරයි)
  const [batchPhotos, setBatchPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<GalleryItem[]>([...GALLERY]);
  const [loaded, setLoaded] = useState(false);

  // DB එකෙන් load — ✅ comments gallery_comments table එකෙන්
  async function load() {
    if (!isSupabaseConfigured()) { setLoaded(true); return; }
    try {
      const { data } = await createClient().from("gallery_items").select("*");
      const { data: cm } = await createClient().from("gallery_comments").select("*").order("created_at", { ascending: true });
      if (data && data.length > 0) {
        setItems(
          (data as unknown as GalleryItem[]).map((g) => ({
            ...g,
            comments: (cm ?? [])
              .filter((c: { item_id: string }) => c.item_id === g.id)
              .map((c: { id: string; author: string; text: string; created_at: string; parent_id?: string | null; likes?: number }) => ({
                id: String(c.id),
                author: String(c.author ?? ""),
                text: String(c.text ?? ""),
                created_at: String(c.created_at ?? ""),
                parent_id: c.parent_id ? String(c.parent_id) : null,
                likes: normalizeGalleryCount(c.likes),
              })),
            likes: normalizeGalleryCount(g.likes),
            views: normalizeGalleryCount(g.views),
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
    setBatchPhotos([]);
    setModal(true);
  }
  function openEdit(g: GalleryItem) {
    setEditFor(g);
    setPhoto(g.image || null);
    setBatchPhotos([]);
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

  // එකවර photos 2–3ක් තෝරලා එකම tagline (Title) එක යටතේ upload කරයි
  async function onBatchPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;
    const files = picked.slice(0, 3);
    if (picked.length > 3) show("⚠ එකවර ගත හැක්කේ photos 3ක් විතරයි — මුල් 3 විතරක් ගත්තා");
    setUploading(true);
    const urls: string[] = [];
    for (const f of files) {
      const r = await uploadSiteImage(f, "gallery");
      if (r?.url) urls.push(r.url);
    }
    setUploading(false);
    if (urls.length) {
      setBatchPhotos(urls);
      setPhoto(null);
      show(`✅ Photos ${urls.length}ක් upload වුණා — එකම Title එකෙන් Save කරන්න`);
    } else {
      show("⚠ Photos upload වුණේ නෑ");
    }
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
      likes: normalizeGalleryCount(editFor?.likes),
      views: normalizeGalleryCount(editFor?.views),
    };
    let err: string | null;
    let addedCount = 1;
    if (editFor) {
      err = await dbUpdate("gallery_items", { id: editFor.id }, row);
    } else if (batchPhotos.length > 0) {
      // එකම tagline (Title) එක යටතේ photos ඔක්කොම එකවර save කරයි
      const rows = batchPhotos.map((url, i) => ({ ...row, id: `gal-${Date.now()}-${i + 1}`, image: url }));
      addedCount = rows.length;
      err = await dbInsertMany("gallery_items", rows as unknown as Record<string, unknown>[]);
    } else {
      err = await dbInsert("gallery_items", row as unknown as Record<string, unknown>);
    }
    setModal(false);
    setPhoto(null);
    setBatchPhotos([]);
    await load();
    show(
      err
        ? `⚠ ${err}`
        : editFor
          ? "✅ Gallery item updated"
          : addedCount > 1
            ? `✅ Gallery items ${addedCount}ක් එකම tagline එකෙන් add වුණා (public එකේ පේනවා)`
            : "✅ Gallery item added (public එකේ පේනවා)"
    );
  }

  async function removeItem(g: GalleryItem) {
    setItems((xs) => xs.filter((x) => x.id !== g.id));
    const err = await dbDelete("gallery_items", { id: g.id });
    await load();
    show(err ? `⚠ ${err}` : "✅ Deleted");
  }

  function renderAdminComment(c: GalleryComment, isReply: boolean) {
    return (
      <div
        key={c.id}
        className={`flex items-start gap-2 rounded-xl px-3 py-2 ${
          isReply ? "bg-white border border-slate-200/80 ml-6" : "bg-slate-50 border border-slate-100"
        }`}
      >
        <div className="text-[12px] text-slate-600 flex-1">
          {isReply && (
            <span className="mr-1.5 inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-100 px-2 py-px text-[9px] font-bold text-indigo-600 align-middle">
              <Reply size={9} /> Reply
            </span>
          )}
          <strong>{c.author}:</strong> {c.text}
          <span className="ml-2 inline-flex items-center gap-1 text-[10.5px] font-semibold text-rose-500">
            <Heart size={10} className="fill-rose-400 text-rose-400" /> {normalizeGalleryCount(c.likes).toLocaleString()}
          </span>
        </div>
        <button
          className="shrink-0 w-6 h-6 rounded-full bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors"
          title={isReply ? "Delete reply" : "Delete comment (replies ද මැකේ)"}
          onClick={async () => {
            await createClient().from("gallery_comments").delete().eq("id", c.id);
            await load();
            show(isReply ? "✅ Reply deleted" : "✅ Comment deleted");
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    );
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
                    <span className="flex items-center gap-1"><ThumbsUp size={12} /> {normalizeGalleryCount(g.likes).toLocaleString()} Likes</span>
                    <span className="flex items-center gap-1"><Eye size={12} /> {normalizeGalleryCount(g.views).toLocaleString()} Views</span>
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
                  {buildGalleryCommentTree(g.comments ?? []).map((node) => (
                    <div key={node.id} className="space-y-1.5">
                      {renderAdminComment(node, false)}
                      {node.replies.map((r) => renderAdminComment(r, true))}
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
          sub={editFor ? `${editFor.title} — update කර Save ඔබන්න` : "Photo එකක් — හෝ photos 2–3ක් එකම tagline එකෙන් — upload කරලා save කරන්න"}
          onClose={() => { setModal(false); setPhoto(null); setBatchPhotos([]); }}
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
              {!editFor && (
                <div className="mt-3 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/60 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="text-[12px] font-extrabold text-slate-800">
                      එකවර Photos 2–3ක් — එකම Tagline එකෙන්
                      <span className="block text-[10.5px] font-medium text-slate-500">
                        උඩ Title එකම මේ photos ඔක්කෝටම වැටෙනවා. (එකවර උපරිම 3යි)
                      </span>
                    </div>
                    <label className="btn btn-outline cursor-pointer !py-2 !text-[12px]">
                      <Upload size={14} /> {uploading ? "Uploading…" : "Upload 2–3 Photos"}
                      <input type="file" accept="image/*" multiple className="hidden" onChange={onBatchPhotos} />
                    </label>
                  </div>
                  {batchPhotos.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2.5">
                      {batchPhotos.map((src, i) => (
                        <span key={`${src}-${i}`} className="relative inline-block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={`batch ${i + 1}`} className="h-16 w-16 rounded-xl border border-slate-200 object-cover" />
                          <button
                            type="button"
                            title="Remove"
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white"
                            onClick={() => setBatchPhotos((xs) => xs.filter((_, j) => j !== i))}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <span className="text-[11px] font-bold text-indigo-700">
                        Photos {batchPhotos.length}ක් — Save කළාම එකම Title එකෙන් add වෙනවා
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" className="btn btn-outline" onClick={() => { setModal(false); setPhoto(null); setBatchPhotos([]); }}>Cancel</button>
              <button type="submit" className="btn btn-primary">
                {editFor ? <><Pencil size={15} /> Save Changes</> : batchPhotos.length > 1 ? `✓ Add ${batchPhotos.length} Gallery Items` : "✓ Add Gallery Item"}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
