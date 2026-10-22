"use client";

// ============================================================================
// Gallery Moderation — add / edit / delete + photo upload (save වෙන විදියට)
// ============================================================================

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Eye, Heart, ImageIcon, Images, Pencil, Plus, Reply, Search, ThumbsUp, Trash2, Upload } from "lucide-react";
import { CommentImageIcon as MessageSquare } from "@/components/site-icons";
import { AspectShape, MediaSizeBadge } from "@/components/media-info";
import { GALLERY_ASPECT_OPTIONS } from "@/lib/media-info";
import { buildGalleryCommentTree, groupGalleryItems, normalizeGalleryCount, type GalleryAlbum } from "@/lib/gallery-social";
import { AdminModal, AdminTopbar, dbDelete, dbInsert, dbInsertMany, dbUpdate, useNotice } from "@/components/admin";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { deleteSiteImage, uploadSiteImage } from "@/lib/supabase/storage";
import { GALLERY } from "@/lib/seed";
import type { GalleryComment, GalleryItem } from "@/lib/types";

export default function AdminGalleryPage() {
  const { show, node } = useNotice();
  const [modal, setModal] = useState(false);
  const [editFor, setEditFor] = useState<GalleryItem | null>(null);
  const [editAlbumFor, setEditAlbumFor] = useState<GalleryAlbum | null>(null);
  const [openAlbumKey, setOpenAlbumKey] = useState("");
  const [query, setQuery] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  // එකම tagline එක යටතේ upload කරන photos — ගණනට සීමාවක් නෑ (Add mode එකේදී විතරයි)
  const [batchPhotos, setBatchPhotos] = useState<string[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [items, setItems] = useState<GalleryItem[]>(() => (isSupabaseConfigured() ? [] : [...GALLERY]));
  const [loaded, setLoaded] = useState(false);

  // DB එකෙන් load — ✅ comments gallery_comments table එකෙන්
  // ⚠ DB එක හිස් නම් හිස් ලැයිස්තුවම තබනවා. කලින් seed (default) photos 3
  //    එහෙමම පෙනුණු නිසා ඒවා delete කරද්දී DB row එකක් නැතුව
  //    "row එක හමු නොවුණා/permission නෑ" කියලා වැටුණා.
  async function load() {
    if (!isSupabaseConfigured()) { setLoaded(true); return; }
    try {
      const { data, error } = await createClient().from("gallery_items").select("*");
      if (error) {
        setItems([]);
        show(`⚠ Gallery load බැරි වුණා: ${error.message}`);
        setLoaded(true);
        return;
      }
      const { data: cm } = await createClient().from("gallery_comments").select("*").order("created_at", { ascending: true });
      setItems(
        ((data ?? []) as unknown as GalleryItem[]).map((g) => ({
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
    } catch {
      setItems([]);
    }
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditFor(null);
    setEditAlbumFor(null);
    setPhoto(null);
    setBatchPhotos([]);
    setBatchProgress(null);
    setModal(true);
  }
  function openEdit(g: GalleryItem) {
    setEditFor(g);
    setEditAlbumFor(null);
    setPhoto(g.image || null);
    setBatchPhotos([]);
    setBatchProgress(null);
    setModal(true);
  }
  function openEditAlbum(album: GalleryAlbum) {
    setEditAlbumFor(album);
    setEditFor(null);
    setPhoto(album.cover.image || null);
    setBatchPhotos([]);
    setBatchProgress(null);
    setModal(true);
  }

  function closeModal() {
    if (uploading || saving) return;
    setModal(false);
    setEditFor(null);
    setEditAlbumFor(null);
    setPhoto(null);
    setBatchPhotos([]);
    setBatchProgress(null);
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

  // කැමති ඕනෑම ගණනක් photos තෝරලා එකම tagline (Title) එක යටතේ upload කරයි.
  // සීමාවක් නෑ — එකවර ගොඩක් තෝරන්නත්, වරින් වර තෝරලා එකතු කරන්නත් පුළුවන්.
  // වේගය සඳහා එකවර 3 බැගින් parallel upload වේ; progress එකත් පේනවා.
  async function onBatchPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length || uploading) return;
    const files = picked;
    setUploading(true);
    setBatchProgress({ done: 0, total: files.length });
    const urls: string[] = [];
    let failed = 0;
    let firstError = "";
    const CONCURRENCY = 3;
    for (let i = 0; i < files.length; i += CONCURRENCY) {
      const chunk = files.slice(i, i + CONCURRENCY);
      const results = await Promise.all(chunk.map((f) => uploadSiteImage(f, "gallery")));
      for (const r of results) {
        if (r?.url) urls.push(r.url);
        else {
          failed++;
          if (!firstError && r?.error) firstError = r.error;
        }
      }
      setBatchProgress({ done: Math.min(files.length, i + chunk.length), total: files.length });
    }
    setUploading(false);
    setBatchProgress(null);
    if (urls.length) {
      setBatchPhotos((prev) => [...prev, ...urls]);
      setPhoto(null);
      show(
        failed
          ? `✅ Photos ${urls.length}ක් upload වුණා · ⚠ ${failed}ක් බැරි වුණා${firstError ? ` (${firstError})` : ""} — එකම Title එකෙන් Save කරන්න`
          : `✅ Photos ${urls.length}ක් upload වුණා — එකම Title එකෙන් Save කරන්න`
      );
    } else {
      show(`⚠ Photos upload වුණේ නෑ${firstError ? `: ${firstError}` : ""}`);
    }
  }

  async function submitItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (uploading || saving) return;
    const fd = new FormData(e.currentTarget);

    // Album details edit — Tagline / Description / Aspect එක album එකේ
    // photos ඔක්කෝටම එකවර apply වෙනවා (එක එක photo එක වෙනම edit කරන්න ඕන නෑ).
    if (editAlbumFor) {
      const albumTitle = String(fd.get("title")).trim() || editAlbumFor.cover.title || "Photo Album";
      const albumDescription = String(fd.get("description"));
      const albumAspect = String(fd.get("aspect")) as GalleryItem["aspect"];
      setSaving(true);
      let albumErr: string | null = null;
      let updated = 0;
      for (const p of editAlbumFor.photos) {
        albumErr = await dbUpdate(
          "gallery_items",
          { id: p.id },
          {
            id: p.id,
            title: albumTitle,
            description: albumDescription,
            aspect: albumAspect,
            image: p.image,
            likes: normalizeGalleryCount(p.likes),
            views: normalizeGalleryCount(p.views),
          }
        );
        if (albumErr) break;
        updated++;
      }
      setSaving(false);
      await load();
      if (albumErr) {
        show(updated > 0 ? `⚠ Photos ${updated}ක් update වුණා, ඉතිරිය බැරි වුණා: ${albumErr}` : `⚠ ${albumErr}`);
        return;
      }
      setModal(false);
      setEditAlbumFor(null);
      setPhoto(null);
      setBatchPhotos([]);
      setBatchProgress(null);
      show("✅ Album tagline & description updated");
      return;
    }

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
    setSaving(true);
    let err: string | null = null;
    let addedCount = 1;
    if (editFor) {
      err = await dbUpdate("gallery_items", { id: editFor.id }, row);
    } else if (batchPhotos.length > 0) {
      // එකම tagline (Title) එක යටතේ photos ඔක්කොම save කරයි — ගණන කීය වුණත්
      // request එක බර වැඩි නොවෙන්න rows 50 බැගින් chunks වලින් යවයි.
      // මැද chunk එකක් fail වුණොත් ඉතිරි photos ටික modal එකේම තියලා ආයේ Save කරන්න පුළුවන්.
      const stamp = Date.now();
      const rows = batchPhotos.map((url, i) => ({ ...row, id: `gal-${stamp}-${i + 1}`, image: url }));
      addedCount = 0;
      for (let i = 0; i < rows.length; i += 50) {
        const chunk = rows.slice(i, i + 50);
        const chunkErr = await dbInsertMany("gallery_items", chunk as unknown as Record<string, unknown>[]);
        if (chunkErr) {
          err = chunkErr;
          setBatchPhotos(rows.slice(i).map((r) => r.image));
          break;
        }
        addedCount += chunk.length;
      }
    } else {
      err = await dbInsert("gallery_items", row as unknown as Record<string, unknown>);
    }
    setSaving(false);
    await load();
    if (err) {
      // වැරදුණොත් modal එක වහන්නේ නෑ — ලියපු දේවල්/upload photos නැති නොවෙන්න
      show(
        addedCount > 0
          ? `⚠ Photos ${addedCount}ක් save වුණා, ඉතිරිය බැරි වුණා: ${err} — ඉතිරි ටික ආයේ Save ඔබන්න`
          : `⚠ ${err}`
      );
      return;
    }
    setModal(false);
    setEditFor(null);
    setEditAlbumFor(null);
    setPhoto(null);
    setBatchPhotos([]);
    setBatchProgress(null);
    show(
      editFor
        ? "✅ Gallery item updated"
        : addedCount > 1
          ? `✅ Photos ${addedCount}ක් එක Album එකක් විදිහට add වුණා (public එකේ View More එකෙන් පේනවා)`
          : "✅ Gallery item added (public එකේ පේනවා)"
    );
  }

  async function removeItem(g: GalleryItem) {
    if (deletingId) return;
    setDeletingId(g.id);
    try {
      if (!isSupabaseConfigured()) {
        setItems((xs) => xs.filter((x) => x.id !== g.id));
        show("✅ Deleted");
        return;
      }

      // පරණ default/stale image එකක් DB එකේ row එකක් නැතුව ලැයිස්තුවේ
      // ඉතිරි වෙලා තිබුණොත් ඒක delete error එකක් නොවේ — ලැයිස්තුවෙන් අයින් කරනවා.
      // (row එක ඇත්තටම තියෙනවා නම් විතරක් DB delete එකට යනවා; එතකොට
      //  permission ප්‍රශ්නයක් තිබුණොත් ඒක හරියටම error එකක් විදිහට පේනවා.)
      const { data: existing, error: existingError } = await createClient()
        .from("gallery_items")
        .select("id")
        .eq("id", g.id)
        .maybeSingle();
      if (!existingError && !existing) {
        setItems((xs) => xs.filter((x) => x.id !== g.id));
        show("✅ Deleted — පරණ default image එක අයින් කළා");
        return;
      }

      const err = await dbDelete("gallery_items", { id: g.id });
      if (!err) {
        setItems((xs) => xs.filter((x) => x.id !== g.id));
        // Upload කරපු file එක වෙන photo එකකටත් පාවිච්චි වෙන්නේ නැත්නම් storage එකෙනුත් අයින් කරනවා
        if (g.image && !items.some((x) => x.id !== g.id && x.image === g.image)) {
          await deleteSiteImage(g.image);
        }
      }
      await load();
      show(err ? `⚠ ${err}` : "✅ Deleted");
    } finally {
      setDeletingId("");
    }
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

  const allAlbums = groupGalleryItems(items);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const albums = !normalizedQuery
    ? allAlbums
    : allAlbums.filter((album) =>
        [
          album.cover.title,
          album.cover.description,
          ...album.photos.flatMap((p) => [p.title, p.description, ...(p.comments ?? []).flatMap((c) => [c.author, c.text])]),
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedQuery)
      );

  return (
    <div>
      <AdminTopbar title="Gallery Moderation" sub="Albums විදිහට බලන්න — album එක open කරලා ඇතුළේ photos edit/delete සහ comments moderate කරන්න." />
      {node}

      <div className="card p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="field !pl-10"
            placeholder="Search albums, taglines or comments..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add Gallery Item
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {albums.map((album) => {
          const isOpen = openAlbumKey === album.key;
          const cover = album.cover;
          const multi = album.photos.length > 1;
          return (
            <section
              key={album.key}
              className={`card overflow-hidden ${isOpen ? "lg:col-span-2 ring-2 ring-indigo-200" : ""}`}
            >
              <div className={`grid ${isOpen ? "md:grid-cols-[340px_minmax(0,1fr)]" : "sm:grid-cols-[240px_minmax(0,1fr)]"}`}>
                <button
                  type="button"
                  className="relative block min-h-[220px] w-full bg-slate-900 text-left"
                  onClick={() => setOpenAlbumKey(isOpen ? "" : album.key)}
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? "Close" : "Open"} album ${cover.title}`}
                >
                  {cover.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover.image} alt={cover.title} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-white/30">
                      <ImageIcon size={46} />
                    </span>
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-slate-950/10" />
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-slate-950/75 px-3 py-1 text-[10.5px] font-extrabold text-white backdrop-blur-sm">
                    <Images size={12} /> {album.photos.length} {album.photos.length === 1 ? "Photo" : "Photos"}
                  </span>
                  <MediaSizeBadge src={cover.image} aspect={cover.aspect} showName className="absolute right-3 top-3" />
                  <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[10.5px] font-extrabold text-slate-800">
                    {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {isOpen ? "Close Album" : "Open Album"}
                  </span>
                </button>

                <div className="flex min-w-0 flex-col p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700">
                      {multi ? "Photo Album" : "Gallery Photo"}
                    </span>
                    <span className="h-px flex-1 bg-gradient-to-r from-indigo-200 to-transparent" />
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-extrabold text-indigo-700">
                      {album.photos.length} {album.photos.length === 1 ? "Photo" : "Photos"}
                    </span>
                  </div>

                  <button type="button" className="mt-2 text-left" onClick={() => setOpenAlbumKey(isOpen ? "" : album.key)}>
                    <h3 className="text-[20px] font-black leading-snug text-slate-950">
                      {cover.title?.trim() || "Untitled Album"}
                    </h3>
                  </button>
                  <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-slate-500">
                    {cover.description?.trim() || "No description added yet. Edit Album එකෙන් professional description එකක් එකතු කරන්න."}
                  </p>

                  <div className="mt-5 grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-center">
                    <div className="px-2 py-3">
                      <div className="flex items-center justify-center gap-1 text-[13px] font-black text-slate-800">
                        <Heart size={13} className="fill-rose-500 text-rose-500" /> {album.totalLikes.toLocaleString()}
                      </div>
                      <div className="mt-0.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Likes</div>
                    </div>
                    <div className="px-2 py-3">
                      <div className="flex items-center justify-center gap-1 text-[13px] font-black text-slate-800">
                        <Eye size={13} className="text-indigo-600" /> {album.totalViews.toLocaleString()}
                      </div>
                      <div className="mt-0.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Views</div>
                    </div>
                    <div className="px-2 py-3">
                      <div className="flex items-center justify-center gap-1 text-[13px] font-black text-slate-800">
                        <MessageSquare size={13} className="text-emerald-600" /> {album.totalComments.toLocaleString()}
                      </div>
                      <div className="mt-0.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Comments</div>
                    </div>
                  </div>

                  {multi && (
                    <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
                      {album.photos.slice(0, 5).map((p, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={p.id}
                          src={p.image}
                          alt=""
                          className={`h-10 w-12 rounded-lg object-cover ${i === 0 ? "ring-2 ring-indigo-500" : "opacity-75"}`}
                        />
                      ))}
                      {album.photos.length > 5 && (
                        <span className="flex h-10 items-center rounded-lg bg-slate-100 px-2 text-[10px] font-extrabold text-slate-500">
                          +{album.photos.length - 5}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-auto flex flex-wrap gap-2 pt-5">
                    <button type="button" className="btn btn-primary !px-4 !py-2 !text-[12px]" onClick={() => setOpenAlbumKey(isOpen ? "" : album.key)}>
                      {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      {isOpen ? "Close Album" : multi ? "Open Album" : "Manage Photo"}
                    </button>
                    <button type="button" className="btn btn-outline !px-4 !py-2 !text-[12px]" onClick={() => openEditAlbum(album)}>
                      <Pencil size={14} /> Edit Album
                    </button>
                  </div>
                  <p className="mt-2 text-[10.5px] leading-relaxed text-slate-400">
                    Album එක open කළාම ඇතුළේ තියෙන හැම photo එකක්ම වෙන වෙනම Edit / Delete කරන්න පුළුවන්.
                  </p>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-slate-200 bg-slate-50/80 p-4 sm:p-6">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 max-w-3xl">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700">
                        Album Content · Manage Photos
                      </div>
                      <h4 className="mt-1 text-[18px] font-black text-slate-950">{cover.title?.trim() || "Untitled Album"}</h4>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
                        {cover.description?.trim() || "මේ album එකට තවම description එකක් දාලා නෑ."}
                      </p>
                    </div>
                    <button type="button" className="btn btn-outline !px-3.5 !py-2 !text-[11.5px]" onClick={() => setOpenAlbumKey("")}>
                      <ChevronUp size={14} /> Close
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {album.photos.map((g, photoIdx) => (
                      <article key={g.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                        <div className="relative h-52 bg-slate-900">
                          {g.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={g.image} alt={g.title} className="absolute inset-0 h-full w-full object-cover" />
                          ) : (
                            <span className="absolute inset-0 flex items-center justify-center text-white/30">
                              <ImageIcon size={38} />
                            </span>
                          )}
                          <span className="absolute left-3 top-3 rounded-full bg-slate-950/75 px-2.5 py-1 text-[10px] font-extrabold text-white">
                            Photo {photoIdx + 1}{multi ? ` / ${album.photos.length}` : ""}
                          </span>
                          <MediaSizeBadge src={g.image} aspect={g.aspect} className="absolute right-3 top-3" />
                        </div>

                        <div className="p-4">
                          {(g.title !== cover.title || g.description !== cover.description) && (
                            <div className="mb-3">
                              {g.title !== cover.title && <div className="text-[13px] font-extrabold text-slate-900">{g.title}</div>}
                              {g.description !== cover.description && g.description && (
                                <div className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">{g.description}</div>
                              )}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-3.5 text-[11px] font-semibold text-slate-500">
                            <span className="flex items-center gap-1">
                              <ThumbsUp size={12} className="text-rose-500" /> {normalizeGalleryCount(g.likes).toLocaleString()} Likes
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye size={12} className="text-indigo-500" /> {normalizeGalleryCount(g.views).toLocaleString()} Views
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare size={12} className="text-emerald-500" /> {(g.comments?.length ?? 0).toLocaleString()} Comments
                            </span>
                          </div>

                          <div className="mt-4 flex gap-2">
                            <button type="button" className="btn btn-outline flex-1 !py-2 !text-[11.5px]" onClick={() => openEdit(g)}>
                              <Pencil size={13} /> Edit Photo
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline flex-1 !border-red-200 !py-2 !text-[11.5px] !text-red-600 disabled:opacity-50"
                              disabled={deletingId === g.id}
                              onClick={() => void removeItem(g)}
                            >
                              <Trash2 size={13} /> {deletingId === g.id ? "Deleting…" : "Delete Photo"}
                            </button>
                          </div>

                          <div className="mt-4 border-t border-slate-100 pt-3">
                            <div className="text-[10.5px] font-black uppercase tracking-[0.14em] text-slate-400">
                              Comments ({g.comments?.length ?? 0})
                            </div>
                            {(g.comments?.length ?? 0) === 0 ? (
                              <div className="mt-1.5 text-[11.5px] italic text-slate-400">No comments on this photo.</div>
                            ) : (
                              <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
                                {buildGalleryCommentTree(g.comments ?? []).map((commentNode) => (
                                  <div key={commentNode.id} className="space-y-1.5">
                                    {renderAdminComment(commentNode, false)}
                                    {commentNode.replies.map((r) => renderAdminComment(r, true))}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })}
        {loaded && items.length === 0 && (
          <p className="text-center text-slate-400 text-[13px] lg:col-span-2">Gallery එක හිස් — "Add Gallery Item" ඔබලා ඡායාරූප එකතු කරන්න.</p>
        )}
        {loaded && items.length > 0 && albums.length === 0 && (
          <p className="text-center text-slate-400 text-[13px] lg:col-span-2">Search එකට ගැලපෙන album එකක් හමු නොවුණා.</p>
        )}
      </div>

      {modal && (
        <AdminModal
          title={editAlbumFor ? "Edit Album Details" : editFor ? "Edit Gallery Item" : "Add New Gallery Item"}
          sub={
            editAlbumFor
              ? `Photos ${editAlbumFor.photos.length}ටම එකම tagline & description එක apply වෙනවා`
              : editFor
                ? `${editFor.title} — update කර Save ඔබන්න`
                : "Photo එකක් — හෝ කැමති ගණනක් photos එකම Album එකක් විදිහට — upload කරලා save කරන්න"
          }
          onClose={closeModal}
        >
          <form
            key={editAlbumFor ? `album-${editAlbumFor.key}` : editFor ? `edit-${editFor.id}` : "add"}
            onSubmit={submitItem}
            className="space-y-4"
          >
            <div>
              <label className="field-label">
                {editAlbumFor ? "Album Title / Tagline" : editFor ? "Photo Title / Tagline (Optional)" : "Album Title / Tagline (Optional)"}
              </label>
              <input
                name="title"
                className="field"
                defaultValue={editAlbumFor?.cover.title ?? editFor?.title ?? ""}
                placeholder="e.g. 50th Anniversary Celebration"
              />
              <p className="mt-1 text-[10.5px] text-slate-400">
                {editAlbumFor
                  ? "මේ tagline එක album එකේ photos ඔක්කෝටම පාවිච්චි වෙනවා."
                  : "කෙටි, පැහැදිලි tagline එකක් දාන්න — public card එකේ පේන්නේ මේකයි."}
              </p>
            </div>
            <div>
              <label className="field-label">Aspect Ratio · පින්තූර හැඩය</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {GALLERY_ASPECT_OPTIONS.map((option, i) => (
                  <label key={option.value} className="cursor-pointer">
                    <input
                      type="radio"
                      name="aspect"
                      value={option.value}
                      defaultChecked={
                        editAlbumFor
                          ? editAlbumFor.cover.aspect === option.value
                          : editFor
                            ? editFor.aspect === option.value
                            : i === 0
                      }
                      className="peer sr-only"
                    />
                    <span className="flex h-full flex-col items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-white px-2.5 py-3 text-center text-slate-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 peer-checked:border-indigo-700 peer-checked:bg-indigo-700 peer-checked:text-white peer-checked:shadow-lg peer-checked:shadow-indigo-600/20 peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-200">
                      <AspectShape aspect={option.value} />
                      <span className="text-[12px] font-black leading-tight">
                        {option.value} · {option.nameEn}
                      </span>
                      <span className="text-[9.5px] font-semibold leading-tight opacity-70">{option.hintSi}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-400">
                Card එකේ පෙන්වන හැඩය මෙතනින් තෝරන්න. Photo එකේ ඇත්ත pixel size එක card එකෙයි View එකෙයි වෙනම professional විදිහට පේනවා.
              </p>
            </div>
            <div>
              <label className="field-label">
                {editAlbumFor ? "Album Description" : editFor ? "Description (Optional)" : "Album Description (Optional)"}
              </label>
              <textarea
                name="description"
                rows={4}
                className="field"
                defaultValue={editAlbumFor?.cover.description ?? editFor?.description ?? ""}
                placeholder="Album එක ගැන කෙටි, වැදගත් විස්තරයක් ලියන්න..."
              />
              <p className="mt-1 text-[10.5px] text-slate-400">
                Public album card එකේ සහ View More popup එකේ මේ description එක පේනවා.
              </p>
            </div>
            {editAlbumFor && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3.5">
                <div className="flex items-center gap-3">
                  {editAlbumFor.cover.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={editAlbumFor.cover.image} alt="" className="h-14 w-14 rounded-xl border border-white object-cover shadow-sm" />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800 text-white/40">
                      <ImageIcon size={22} />
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="text-[12px] font-extrabold text-slate-800">Photos {editAlbumFor.photos.length}ක්ම update වෙනවා</div>
                    <div className="mt-0.5 text-[10.5px] leading-relaxed text-slate-500">
                      එක එක photo එක වෙනම වෙනස් කරන්න ඕන නම් album එක open කරලා ඒ photo එකේ Edit Photo ඔබන්න.
                    </div>
                    <div className="mt-2">
                      <MediaSizeBadge src={editAlbumFor.cover.image} aspect={editAlbumFor.cover.aspect} variant="light" showName />
                    </div>
                  </div>
                </div>
              </div>
            )}
            {!editAlbumFor && (
            <div>
              <label className="field-label">Gallery Photo *</label>
              <div className="flex items-center gap-3">
                {photo && (
                  <span className="flex shrink-0 flex-col items-center gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt="preview" className="w-14 h-14 rounded-xl object-cover border border-slate-200" />
                    <MediaSizeBadge src={photo} variant="light" />
                  </span>
                )}
                <label className={`btn btn-outline ${uploading || saving ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
                  <Upload size={14} /> {uploading ? "Uploading…" : photo ? "Change Photo" : "Upload from Device"}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading || saving} onChange={onPhoto} />
                </label>
              </div>
              <input name="image" className="field mt-2.5" defaultValue={editFor?.image ?? ""} placeholder="or enter image path / URL" />
              {!editFor && (
                <div className="mt-3 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/60 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="text-[12px] font-extrabold text-slate-800">
                      එකවර Photos ඕනෑම ගණනක් — එකම Tagline එකෙන්
                      <span className="block text-[10.5px] font-medium text-slate-500">
                        උඩ Title එකම මේ photos ඔක්කෝටම වැටෙනවා. Public පැත්තේ වෙන් වෙන්ව නෙවෙයි — ප්‍රධාන photo එකයි “View More” එකයි එක්ක එක Album card එකක් විදිහට පේනවා. ගණනට සීමාවක් නෑ.
                      </span>
                    </div>
                    <label className={`btn btn-outline !py-2 !text-[12px] ${uploading || saving ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
                      <Upload size={14} />{" "}
                      {batchProgress
                        ? `Uploading ${batchProgress.done}/${batchProgress.total}…`
                        : uploading
                          ? "Uploading…"
                          : batchPhotos.length
                            ? "Add More Photos"
                            : "Upload Photos (Any Number)"}
                      <input type="file" accept="image/*" multiple className="hidden" disabled={uploading || saving} onChange={onBatchPhotos} />
                    </label>
                  </div>
                  {batchPhotos.length > 0 && (
                    <div className="mt-3">
                      <div className="flex max-h-56 flex-wrap gap-2.5 overflow-y-auto pr-1">
                        {batchPhotos.map((src, i) => (
                          <span
                            key={`${src}-${i}`}
                            className="relative inline-flex w-[7.25rem] shrink-0 flex-col gap-1.5 rounded-2xl border border-white bg-white/85 p-1.5 shadow-sm"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt={`batch ${i + 1}`} className="h-20 w-full rounded-xl border border-slate-200 object-cover" />
                            <MediaSizeBadge src={src} variant="light" className="self-center" />
                            <button
                              type="button"
                              title="Remove"
                              disabled={uploading || saving}
                              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white disabled:opacity-50"
                              onClick={() => setBatchPhotos((xs) => xs.filter((_, j) => j !== i))}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 text-[11px] font-bold text-indigo-700">
                        Photos {batchPhotos.length}ක් — Save කළාම එකම Title එකෙන් එක Album එකක් විදිහට add වෙනවා
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}
            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" className="btn btn-outline" disabled={uploading || saving} onClick={closeModal}>Cancel</button>
              <button type="submit" className="btn btn-primary disabled:opacity-60" disabled={uploading || saving}>
                {saving ? "Saving…" : editAlbumFor ? <><Pencil size={15} /> Save Album Details</> : editFor ? <><Pencil size={15} /> Save Changes</> : batchPhotos.length > 1 ? `✓ Add ${batchPhotos.length} Gallery Items` : "✓ Add Gallery Item"}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
