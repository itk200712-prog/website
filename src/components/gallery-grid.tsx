"use client";

// ============================================================================
// Gallery grid — photo + Title + Description + ✅ Like & Comment (sign-in required)
// ============================================================================

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Heart, ImageIcon, LogIn, Send, X } from "lucide-react";
import { CommentImageIcon as MessageSquare } from "@/components/site-icons";
import { useLang } from "@/lib/i18n";
import type { GalleryComment, GalleryItem } from "@/lib/types";
import { authedClient } from "@/lib/supabase/client";

const ASPECT: Record<string, string> = {
  "4:3": "4 / 3",
  "16:9": "16 / 9",
  "1:1": "1 / 1",
  "3:2": "3 / 2",
};

export type Me = { id: string; name: string; role?: string; avatar?: string } | null;

export function useMe(): Me {
  const [me, setMe] = useState<Me>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sb = await authedClient();
        const { data: u } = await sb.auth.getUser();
        if (!u?.user) return;
        let prof = (await sb.from("profiles").select("full_name, role, avatar_url").eq("id", u.user.id).maybeSingle()).data as
          | { full_name?: string; role?: string; avatar_url?: string }
          | null;
        if (!prof)
          prof = (await sb.from("profiles").select("full_name, role").eq("id", u.user.id).maybeSingle()).data as {
            full_name?: string;
            role?: string;
          } | null;
        if (alive)
          setMe({
            id: u.user.id,
            name: prof?.full_name || u.user.email || "Member",
            role: prof?.role,
            avatar: prof?.avatar_url || "",
          });
      } catch {
        /* not logged in */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return me;
}

// ============================================================================
// Sign-in prompt — professional popup (Like / Comment කරන්න sign-in අවශ්‍ය විට)
// ============================================================================
function SignInPrompt({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useLang();
  const si = lang === "si";
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;
  const next =
    typeof window !== "undefined" ? encodeURIComponent(window.location.pathname + window.location.search) : "";

  // ✅ createPortal — card එකේ overflow-hidden / transform වලින් කැපෙන්නේ නෑ
  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center px-4 no-print" role="dialog" aria-modal="true">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] cursor-default" />
      <div className="relative w-full max-w-[380px] overflow-hidden rounded-3xl bg-white shadow-[0_40px_90px_-20px_rgba(15,23,42,0.6)] ring-1 ring-slate-900/10 pop-in">
        {/* gradient head */}
        <div className="relative bg-gradient-to-br from-indigo-700 via-indigo-600 to-fuchsia-600 px-6 pt-7 pb-12 text-center text-white">
          <button
            onClick={onClose}
            className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition"
            aria-label="Close"
          >
            <X size={15} />
          </button>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur">
            <Heart size={26} className="fill-white/90 text-white/90" />
          </div>
        </div>

        {/* body card */}
        <div className="relative z-10 -mt-8 px-5 pb-5">
          <div className="rounded-2xl bg-white p-5 text-center shadow-[0_16px_40px_-24px_rgba(15,23,42,0.5)] ring-1 ring-slate-100">
            <h3 className="text-[16px] font-extrabold leading-tight text-slate-900">
              {si ? "Sign In අවශ්‍යයි" : "Sign in required"}
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
              {si
                ? "ඡායාරූප Like කිරීමට සහ අදහස් (Comments) දැමීමට කරුණාකර ඔබේ ගිණුමට පිවිසෙන්න."
                : "Please sign in to your account to like photos and post comments."}
            </p>

            <div className="mt-4 grid gap-2">
              <a
                href={`/signin${next ? `?next=${next}` : ""}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[12.5px] font-extrabold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700"
              >
                <LogIn size={15} /> {si ? "Sign In වන්න" : "Sign In"}
              </a>
              <button
                onClick={onClose}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12.5px] font-bold text-slate-600 transition hover:bg-slate-50"
              >
                {si ? "පසුව" : "Not now"}
              </button>
            </div>

            <p className="mt-3 text-[10.5px] leading-relaxed text-slate-400">
              {si
                ? "ගිණුමක් නැද්ද? පිවිසුම් පිටුවේ “ලියාපදිංචි වන්න” තෝරන්න."
                : "No account yet? Choose “Register” on the sign-in page."}
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ============================================================================
// Like + Comment block — cards සහ lightbox දෙකේම use කරන්න
// ============================================================================
export function GallerySocial({
  item,
  me,
  onLike,
  onComment,
  compact = false,
}: {
  item: GalleryItem;
  me: Me;
  onLike: (newCount: number) => void;
  onComment: (c: GalleryComment) => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [needSignin, setNeedSignin] = useState(false);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    try {
      const map = JSON.parse(localStorage.getItem("mpcs_liked_gallery") || "{}");
      setLiked(!!map[item.id]);
    } catch {
      /* ignore */
    }
  }, [item.id]);

  async function toggleLike() {
    if (!me) {
      setNeedSignin(true);
      return;
    }
    const newCount = Math.max(0, (item.likes ?? 0) + (liked ? -1 : 1));
    setLiked(!liked);
    onLike(newCount);
    try {
      const map = JSON.parse(localStorage.getItem("mpcs_liked_gallery") || "{}");
      if (!liked) map[item.id] = true;
      else delete map[item.id];
      localStorage.setItem("mpcs_liked_gallery", JSON.stringify(map));
    } catch {
      /* ignore */
    }
    try {
      const sb = await authedClient();
      await sb.from("gallery_items").update({ likes: newCount }).eq("id", item.id);
    } catch {
      /* offline — count local එක පෙන්වයි */
    }
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!me) {
      setNeedSignin(true);
      return;
    }
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    const c: GalleryComment = {
      id: `tmp-${Date.now()}`,
      author: me.name,
      text: t,
      created_at: new Date().toISOString(),
    };
    onComment(c);
    setText("");
    try {
      const sb = await authedClient();
      await sb.from("gallery_comments").insert({ item_id: item.id, author: me.name, text: t });
    } catch {
      /* DB RLS — SQL block එක run කරලා නැත්නම් local එකේ පෙන්වයි */
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="flex items-center gap-4 text-[12.5px] text-slate-500">
        <button
          type="button"
          onClick={toggleLike}
          className={`flex items-center gap-1.5 font-semibold transition-colors ${liked ? "text-rose-600" : "hover:text-rose-600"}`}
        >
          <Heart size={15} className={liked ? "fill-rose-500 text-rose-500" : ""} />
          {item.likes ?? 0} Likes
        </button>
        <span className="flex items-center gap-1.5">
          <MessageSquare size={15} /> {(item.comments?.length ?? 0)} Comments
        </span>
      </div>

      <SignInPrompt open={needSignin} onClose={() => setNeedSignin(false)} />

      {/* comments list */}
      {(item.comments?.length ?? 0) > 0 && (
        <div className={`mt-3 space-y-2 ${compact ? "" : ""}`}>
          {item.comments.map((c) => (
            <div key={c.id} className="rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-[9px] font-black shrink-0">
                  {c.author.trim().charAt(0).toUpperCase() || "?"}
                </div>
                <div className="text-[11.5px] font-bold text-slate-800">{c.author}</div>
                <div className="text-[9.5px] text-slate-400 ml-auto">
                  {new Date(c.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="text-[12px] text-slate-600 mt-1 leading-relaxed">{c.text}</div>
            </div>
          ))}
        </div>
      )}

      {/* comment form */}
      <form onSubmit={postComment} className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={me ? "ඔබේ අදහස ලියන්න..." : "Comment කරන්න Sign In වන්න..."}
          className="field !py-2.5 !text-[12.5px] flex-1"
          onFocus={() => {
            if (!me) setNeedSignin(true);
          }}
        />
        <button type="submit" disabled={busy || !text.trim()} className="btn btn-primary !py-2 !px-4 !text-[12px]">
          <Send size={13} />
        </button>
      </form>
    </div>
  );
}

// like/comment state එකට helper — parent එකේ items update කරන්න
export function updateItem(items: GalleryItem[], id: string, patch: Partial<GalleryItem>): GalleryItem[] {
  return items.map((g) => (g.id === id ? { ...g, ...patch } : g));
}

export function GalleryGrid({ items: initial }: { items: GalleryItem[] }) {
  const [items, setItems] = useState<GalleryItem[]>(initial);
  const [open, setOpen] = useState<GalleryItem | null>(null);
  const me = useMe();

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  const idx = open ? items.findIndex((x) => x.id === open.id) : -1;
  const current = open ? items.find((x) => x.id === open.id) ?? open : null;

  return (
    <>
      {items.length === 0 ? (
        <div className="card p-12 text-center">
          <ImageIcon size={44} className="mx-auto text-slate-300" />
          <p className="mt-4 font-extrabold text-slate-800 text-lg">Photo Gallery එක තවම හිස්</p>
          <p className="mt-1.5 text-slate-500 text-[13px]">Admin → Gallery එකෙන් ඡායාරූප upload කළ පසු මෙහි පෙන්වයි.</p>
        </div>
      ) : (
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-6">
        {items.map((g) => (
          <figure key={g.id} className="card card-hover overflow-hidden mb-6 break-inside-avoid inline-block w-full">
            <button
              className="w-full block relative bg-slate-800"
              style={{ aspectRatio: ASPECT[g.aspect] ?? "4 / 3" }}
              onClick={() => setOpen(g)}
            >
              {g.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.image} alt={g.title} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/25">
                  <ImageIcon size={44} />
                </div>
              )}
              <span className="absolute top-3 right-3 badge-amber rounded-full px-2.5 py-0.5 text-[10px] font-bold">
                {g.aspect}
              </span>
            </button>
            <figcaption className="p-5">
              <h3 className="font-extrabold text-slate-900 leading-snug">{g.title}</h3>
              <p className="text-slate-500 text-[12.5px] mt-1.5 leading-relaxed">{g.description}</p>
              <div className="mt-3.5 border-t border-slate-100 pt-3">
                <GallerySocial
                  item={g}
                  me={me}
                  onLike={(n) => setItems((xs) => updateItem(xs, g.id, { likes: n }))}
                  onComment={(c) =>
                    setItems((xs) => updateItem(xs, g.id, { comments: [...(xs.find((x) => x.id === g.id)?.comments ?? []), c] }))
                  }
                  compact
                />
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
      )}

      {/* lightbox — title + description + like/comment */}
      {current && (
        <div
          className="fixed inset-0 z-[90] bg-slate-900/80 flex items-center justify-center p-4 no-print"
          onClick={() => setOpen(null)}
        >
          <div className="card max-w-3xl w-full p-0 overflow-hidden max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="relative bg-slate-800" style={{ aspectRatio: ASPECT[current.aspect] ?? "4 / 3" }}>
              {current.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.image} alt={current.title} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/25">
                  <ImageIcon size={64} />
                </div>
              )}
              <button
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center transition"
                onClick={() => setOpen(null)}
              >
                <X size={18} />
              </button>
              {items.length > 1 && (
                <>
                  <button
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/25 hover:bg-white/45 text-white flex items-center justify-center text-xl font-black transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(items[(idx - 1 + items.length) % items.length]);
                    }}
                    aria-label="Previous"
                  >
                    ‹
                  </button>
                  <button
                    className="absolute right-16 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/25 hover:bg-white/45 text-white flex items-center justify-center text-xl font-black transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(items[(idx + 1) % items.length]);
                    }}
                    aria-label="Next"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            <div className="p-6">
              <h3 className="text-xl font-extrabold text-slate-900">{current.title}</h3>
              <p className="text-slate-500 text-[13.5px] mt-2 leading-relaxed">{current.description}</p>
              <div className="mt-4 border-t border-slate-100 pt-4">
                <GallerySocial
                  item={current}
                  me={me}
                  onLike={(n) => setItems((xs) => updateItem(xs, current.id, { likes: n }))}
                  onComment={(c) =>
                    setItems((xs) =>
                      updateItem(xs, current.id, { comments: [...(xs.find((x) => x.id === current.id)?.comments ?? []), c] })
                    )
                  }
                />
              </div>
              <div className="flex items-center gap-4 mt-4 text-[12.5px] text-slate-500 border-t border-slate-100 pt-4">
                <span className="badge-amber rounded-full px-2.5 py-0.5 text-[10px] font-bold">{current.aspect}</span>
                <button onClick={() => setOpen(null)} className="btn btn-outline !py-1.5 !px-4 !text-[11.5px] ml-auto">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// admin comments delete එකට
export async function deleteGalleryComment(id: string): Promise<void> {
  try {
    const sb = await authedClient();
    await sb.from("gallery_comments").delete().eq("id", id);
  } catch {
    /* ignore */
  }
}
