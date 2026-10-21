"use client";

// ============================================================================
// Gallery grid — photo + Title + Description + Likes/Views + Comments/Replies
// Like/View: හැමෝටම (වරකට 1) · Comment/Reply ලියන්න: sign-in අවශ්‍යයි
// කැමති ගාණක් Likes/Views එකතු කරන Boost එක: SUPERADMIN ලට විතරයි (RPC වලිනුත්)
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Heart, ImageIcon, LogIn, Plus, Reply, Send, Shuffle, X } from "lucide-react";
import { CommentImageIcon as MessageSquare } from "@/components/site-icons";
import { useLang } from "@/lib/i18n";
import type { GalleryComment, GalleryItem } from "@/lib/types";
import {
  buildGalleryCommentTree,
  clampBoostAmount,
  countGalleryComments,
  normalizeGalleryCount,
  randomGalleryViews,
  updateGalleryCommentLikes,
} from "@/lib/gallery-social";
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
                ? "අදහසක් (Comment) හෝ පිළිතුරක් (Reply) ලියන්න කරුණාකර ඔබේ ගිණුමට පිවිසෙන්න. Like කරන්න sign-in ඕන නෑ."
                : "Please sign in to write a comment or reply. Liking does not need sign-in."}
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
const PHOTO_LIKE_KEY = "mpcs_liked_gallery";
const COMMENT_LIKE_KEY = "mpcs_liked_gallery_comments";
const VIEW_KEY = "mpcs_gallery_viewed";

function readBoolMap(storage: Storage, key: string): Record<string, boolean> {
  try {
    const parsed = JSON.parse(storage.getItem(key) || "{}") as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function writeBoolMap(storage: Storage, key: string, map: Record<string, boolean>) {
  try {
    storage.setItem(key, JSON.stringify(map));
  } catch {
    /* private mode — ignore */
  }
}

export function GallerySocial({
  item,
  me,
  onLike,
  onViews = () => {},
  onComment,
  onCommentLike = () => {},
  compact = false,
  trackView = false,
}: {
  item: GalleryItem;
  me: Me;
  onLike: (newCount: number) => void;
  onViews?: (newCount: number) => void;
  onComment: (c: GalleryComment) => void;
  onCommentLike?: (commentId: string, newCount: number) => void;
  compact?: boolean;
  /** Lightbox එකේ විතරක් true — photo එක open කළාම view +1 (session එකට වරක්) */
  trackView?: boolean;
}) {
  const { lang } = useLang();
  const si = lang === "si";
  const isSuper = me?.role === "superadmin";
  const [text, setText] = useState("");
  const [needSignin, setNeedSignin] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [likedComments, setLikedComments] = useState<Record<string, boolean>>({});
  const [commentLikeBusy, setCommentLikeBusy] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [posting, setPosting] = useState("");
  const [boostAmounts, setBoostAmounts] = useState<Record<string, string>>({});
  const [boostBusy, setBoostBusy] = useState("");
  const [notice, setNotice] = useState("");
  const viewTrackedRef = useRef<Set<string>>(new Set());

  const likes = normalizeGalleryCount(item.likes);
  const views = normalizeGalleryCount(item.views);
  const tree = buildGalleryCommentTree(item.comments ?? []);
  const totalComments = countGalleryComments(item.comments);

  useEffect(() => {
    try {
      setLiked(!!readBoolMap(localStorage, PHOTO_LIKE_KEY)[item.id]);
    } catch {
      /* ignore */
    }
  }, [item.id]);

  useEffect(() => {
    try {
      setLikedComments(readBoolMap(localStorage, COMMENT_LIKE_KEY));
    } catch {
      /* ignore */
    }
  }, []);

  async function rpcPhoto(likesDelta: number, viewsDelta: number): Promise<{ likes: number; views: number }> {
    const sb = await authedClient();
    const { data, error } = await sb.rpc("gallery_bump_photo", {
      p_item_id: item.id,
      p_likes_delta: likesDelta,
      p_views_delta: viewsDelta,
    });
    if (error) throw new Error(error.message);
    const obj = (data ?? {}) as { likes?: unknown; views?: unknown };
    return { likes: normalizeGalleryCount(obj.likes), views: normalizeGalleryCount(obj.views) };
  }

  /** RPC එකෙන් බැරි වුණොත් (§17 SQL එක තාම run නැති DB එකක) signed-in direct fallback */
  async function bumpPhoto(
    likesDelta: number,
    viewsDelta: number,
    nextLikes: number,
    nextViews: number
  ): Promise<{ likes: number; views: number }> {
    try {
      return await rpcPhoto(likesDelta, viewsDelta);
    } catch (first) {
      if (!me) throw first;
      const sb = await authedClient();
      let res = await sb.from("gallery_items").update({ likes: nextLikes, views: nextViews }).eq("id", item.id);
      if (res.error && viewsDelta !== 0) {
        res = await sb.from("gallery_items").update({ likes: nextLikes }).eq("id", item.id);
      }
      if (res.error) throw new Error(res.error.message);
      return { likes: nextLikes, views: nextViews };
    }
  }

  // 👁 Lightbox එකේ photo එක open කළාම view +1 (එක session එකකට photo එකකට වරක්)
  useEffect(() => {
    if (!trackView) return;
    let already = false;
    try {
      const map = readBoolMap(sessionStorage, VIEW_KEY);
      already = !!map[item.id];
      if (!already) {
        map[item.id] = true;
        writeBoolMap(sessionStorage, VIEW_KEY, map);
      }
    } catch {
      already = viewTrackedRef.current.has(item.id);
      viewTrackedRef.current.add(item.id);
    }
    if (already) return;
    onViews(views + 1);
    void (async () => {
      try {
        const r = await rpcPhoto(0, 1);
        onViews(r.views);
      } catch {
        /* SQL §17 එක නැති DB එකක local count එක විතරයි */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, trackView]);

  async function toggleLike() {
    if (likeBusy) return;
    const wasLiked = liked;
    const nextLiked = !wasLiked;
    const newCount = Math.max(0, likes + (nextLiked ? 1 : -1));
    setLikeBusy(true);
    setLiked(nextLiked);
    onLike(newCount);
    try {
      const map = readBoolMap(localStorage, PHOTO_LIKE_KEY);
      if (nextLiked) map[item.id] = true;
      else delete map[item.id];
      writeBoolMap(localStorage, PHOTO_LIKE_KEY, map);
    } catch {
      /* ignore */
    }
    try {
      const r = await bumpPhoto(nextLiked ? 1 : -1, 0, newCount, views);
      onLike(r.likes);
      onViews(r.views);
    } catch {
      setLiked(wasLiked);
      onLike(likes);
      try {
        const map = readBoolMap(localStorage, PHOTO_LIKE_KEY);
        if (wasLiked) map[item.id] = true;
        else delete map[item.id];
        writeBoolMap(localStorage, PHOTO_LIKE_KEY, map);
      } catch {
        /* ignore */
      }
      setNotice(si ? "⚠ Like එක save වුණේ නෑ — පොඩ්ඩක් ඉඳලා ආයේ බලන්න" : "⚠ Could not save the like — please try again");
    }
    setLikeBusy(false);
  }

  async function toggleCommentLike(c: GalleryComment) {
    if (c.id.startsWith("tmp-") || commentLikeBusy === c.id) return;
    const wasLiked = !!likedComments[c.id];
    const nextLiked = !wasLiked;
    const oldCount = normalizeGalleryCount(c.likes);
    const newCount = Math.max(0, oldCount + (nextLiked ? 1 : -1));
    setCommentLikeBusy(c.id);
    setLikedComments((prev) => ({ ...prev, [c.id]: nextLiked }));
    onCommentLike(c.id, newCount);
    try {
      const map = readBoolMap(localStorage, COMMENT_LIKE_KEY);
      if (nextLiked) map[c.id] = true;
      else delete map[c.id];
      writeBoolMap(localStorage, COMMENT_LIKE_KEY, map);
    } catch {
      /* ignore */
    }
    try {
      const sb = await authedClient();
      const { data, error } = await sb.rpc("gallery_bump_comment_likes", {
        p_comment_id: c.id,
        p_delta: nextLiked ? 1 : -1,
      });
      if (error) throw new Error(error.message);
      if (typeof data === "number") onCommentLike(c.id, normalizeGalleryCount(data));
    } catch {
      // RPC නැති පරණ DB එකක admin/superadmin ට විතරක් direct fallback එකක්
      let saved = false;
      if (me && (isSuper || me.role === "admin")) {
        try {
          const sb = await authedClient();
          const { error } = await sb.from("gallery_comments").update({ likes: newCount }).eq("id", c.id);
          saved = !error;
        } catch {
          saved = false;
        }
      }
      if (!saved) {
        setLikedComments((prev) => ({ ...prev, [c.id]: wasLiked }));
        onCommentLike(c.id, oldCount);
        setNotice(
          si
            ? "⚠ Comment Like එක save වුණේ නෑ (Gallery §17 SQL block එක run කරලා නැත්නම් ඒක run කරන්න)"
            : "⚠ Could not save the comment like (run the Gallery §17 SQL block if not done)"
        );
      }
    }
    setCommentLikeBusy("");
  }

  async function submitComment(parentId: string | null, raw: string, clear: () => void) {
    if (!me) {
      setNeedSignin(true);
      return;
    }
    const t = raw.trim();
    if (!t) return;
    const busyKey = parentId ? `reply-${parentId}` : "comment";
    if (posting === busyKey) return;
    setPosting(busyKey);
    setNotice("");
    try {
      const sb = await authedClient();
      let res = await sb
        .from("gallery_comments")
        .insert({ item_id: item.id, author: me.name, text: t, parent_id: parentId, likes: 0 })
        .select("id,author,text,created_at,parent_id,likes")
        .single();
      if (res.error && !parentId) {
        // §17 SQL එක run නැති පරණ DB එකක top-level comment එක පරණ columns වලින්
        res = await sb
          .from("gallery_comments")
          .insert({ item_id: item.id, author: me.name, text: t })
          .select("id,author,text,created_at")
          .single();
      }
      if (res.error || !res.data) throw new Error(res.error?.message || "comment failed");
      const r = res.data as unknown as {
        id: string;
        author?: string;
        text?: string;
        created_at?: string;
        parent_id?: string | null;
        likes?: number;
      };
      onComment({
        id: String(r.id),
        author: String(r.author ?? me.name),
        text: String(r.text ?? t),
        created_at: String(r.created_at ?? new Date().toISOString()),
        parent_id: r.parent_id ? String(r.parent_id) : parentId,
        likes: normalizeGalleryCount(r.likes),
      });
      clear();
      if (parentId) setReplyToId(null);
    } catch {
      setNotice(
        si
          ? "⚠ Comment/Reply එක save වුණේ නෑ (Gallery §17 SQL block එක run කරලා නැත්නම් ඒක run කරන්න)"
          : "⚠ Could not save the comment/reply (run the Gallery §17 SQL block if not done)"
      );
    }
    setPosting("");
  }

  function boostAmount(key: string): number {
    return clampBoostAmount(boostAmounts[key] ?? "");
  }

  async function boostPhotoLikes() {
    const amount = boostAmount("photo");
    if (!amount) {
      setNotice(si ? "⚠ එකතු කරන්න ඕන Likes ගාණ ලියන්න (1–100000)" : "⚠ Enter how many likes to add (1–100000)");
      return;
    }
    setBoostBusy("photo-likes");
    const next = likes + amount;
    onLike(next);
    try {
      const r = await bumpPhoto(amount, 0, next, views);
      onLike(r.likes);
      onViews(r.views);
      setBoostAmounts((prev) => ({ ...prev, photo: "" }));
      setNotice(`✅ +${amount.toLocaleString()} Likes එකතු වුණා`);
    } catch {
      onLike(likes);
      setNotice(si ? "⚠ Boost එක save වුණේ නෑ" : "⚠ Boost could not be saved");
    }
    setBoostBusy("");
  }

  async function boostRandomViews() {
    const amount = randomGalleryViews();
    setBoostBusy("photo-views");
    const next = views + amount;
    onViews(next);
    try {
      const r = await bumpPhoto(0, amount, likes, next);
      onViews(r.views);
      onLike(r.likes);
      setNotice(`🎲 Random Views +${amount.toLocaleString()} එකතු වුණා`);
    } catch {
      onViews(views);
      setNotice(si ? "⚠ Random Views save වුණේ නෑ" : "⚠ Random views could not be saved");
    }
    setBoostBusy("");
  }

  async function boostComment(c: GalleryComment) {
    const key = `c-${c.id}`;
    const amount = boostAmount(key);
    if (!amount) {
      setNotice(si ? "⚠ එකතු කරන්න ඕන Likes ගාණ ලියන්න (1–100000)" : "⚠ Enter how many likes to add (1–100000)");
      return;
    }
    setBoostBusy(key);
    const oldCount = normalizeGalleryCount(c.likes);
    const next = oldCount + amount;
    onCommentLike(c.id, next);
    try {
      const sb = await authedClient();
      const { data, error } = await sb.rpc("gallery_bump_comment_likes", {
        p_comment_id: c.id,
        p_delta: amount,
      });
      if (error) {
        // RPC නැති DB එකක superadmin direct fallback (admin_write policy එකෙන්)
        const { error: upErr } = await sb.from("gallery_comments").update({ likes: next }).eq("id", c.id);
        if (upErr) throw new Error(upErr.message);
      } else if (typeof data === "number") {
        onCommentLike(c.id, normalizeGalleryCount(data));
      }
      setBoostAmounts((prev) => ({ ...prev, [key]: "" }));
      setNotice(`✅ Comment එකට +${amount.toLocaleString()} Likes එකතු වුණා`);
    } catch {
      onCommentLike(c.id, oldCount);
      setNotice(si ? "⚠ Comment Boost එක save වුණේ නෑ" : "⚠ Comment boost could not be saved");
    }
    setBoostBusy("");
  }

  function commentActions(c: GalleryComment, rootId: string) {
    const likedC = !!likedComments[c.id];
    const boostKey = `c-${c.id}`;
    return (
      <>
        <div className="mt-2 flex flex-wrap items-center gap-3.5 text-[11.5px] text-slate-500">
          <button
            type="button"
            onClick={() => void toggleCommentLike(c)}
            disabled={commentLikeBusy === c.id}
            className={`flex items-center gap-1 font-semibold transition-colors disabled:opacity-50 ${likedC ? "text-rose-600" : "hover:text-rose-600"}`}
          >
            <Heart size={13} className={likedC ? "fill-rose-500 text-rose-500" : ""} />
            {normalizeGalleryCount(c.likes).toLocaleString()} Likes
          </button>
          <button
            type="button"
            onClick={() => {
              if (!me) {
                setNeedSignin(true);
                return;
              }
              setReplyToId(replyToId === rootId ? null : rootId);
            }}
            className="flex items-center gap-1 font-semibold hover:text-indigo-700 transition-colors"
          >
            <Reply size={13} /> Reply
          </button>
        </div>
        {isSuper && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-fuchsia-200 bg-fuchsia-50/80 px-2 py-1.5">
            <span className="text-[10px] font-black uppercase tracking-wide text-fuchsia-700">👑 Superadmin</span>
            <input
              type="number"
              min={1}
              max={100000}
              value={boostAmounts[boostKey] ?? ""}
              onChange={(e) => setBoostAmounts((prev) => ({ ...prev, [boostKey]: e.target.value }))}
              placeholder={si ? "ගාණ" : "Amount"}
              className="w-[78px] rounded-lg border border-fuchsia-200 bg-white px-2 py-1 text-[11px] outline-none focus:border-fuchsia-400"
            />
            <button
              type="button"
              onClick={() => void boostComment(c)}
              disabled={boostBusy === boostKey}
              className="rounded-lg bg-fuchsia-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-fuchsia-700 disabled:opacity-50"
            >
              <Plus size={11} className="inline" /> Likes
            </button>
          </div>
        )}
      </>
    );
  }

  function commentCard(c: GalleryComment, rootId: string, isReply: boolean) {
    return (
      <div
        key={c.id}
        className={`rounded-xl px-3.5 py-2.5 ${
          isReply ? "bg-white border border-slate-200/80" : "bg-slate-50 border border-slate-100"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-[9px] font-black shrink-0">
            {c.author.trim().charAt(0).toUpperCase() || "?"}
          </div>
          <div className="text-[11.5px] font-bold text-slate-800">{c.author}</div>
          {isReply && (
            <span className="rounded-full bg-indigo-50 border border-indigo-100 px-2 py-px text-[9px] font-bold text-indigo-600">
              Reply
            </span>
          )}
          <div className="text-[9.5px] text-slate-400 ml-auto">{new Date(c.created_at).toLocaleDateString()}</div>
        </div>
        <div className="text-[12px] text-slate-600 mt-1 leading-relaxed">{c.text}</div>
        {commentActions(c, rootId)}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 text-[12.5px] text-slate-500">
        <button
          type="button"
          onClick={() => void toggleLike()}
          disabled={likeBusy}
          className={`flex items-center gap-1.5 font-semibold transition-colors disabled:opacity-50 ${liked ? "text-rose-600" : "hover:text-rose-600"}`}
        >
          <Heart size={15} className={liked ? "fill-rose-500 text-rose-500" : ""} />
          {likes.toLocaleString()} Likes
        </button>
        <span className="flex items-center gap-1.5">
          <MessageSquare size={15} /> {totalComments.toLocaleString()} Comments
        </span>
        <span className="flex items-center gap-1.5">
          <Eye size={15} /> {views.toLocaleString()} Views
        </span>
      </div>

      {/* 👑 Superadmin විතරක් දකින Boost panel එක — photo likes + random views */}
      {isSuper && (
        <div className="mt-3 rounded-xl border border-fuchsia-200 bg-fuchsia-50/70 px-3 py-2.5">
          <div className="text-[10.5px] font-black uppercase tracking-wider text-fuchsia-700">
            👑 Superadmin Boost — Photo
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={100000}
              value={boostAmounts.photo ?? ""}
              onChange={(e) => setBoostAmounts((prev) => ({ ...prev, photo: e.target.value }))}
              placeholder={si ? "Likes ගාණ" : "Likes amount"}
              className="w-[110px] rounded-lg border border-fuchsia-200 bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-fuchsia-400"
            />
            <button
              type="button"
              onClick={() => void boostPhotoLikes()}
              disabled={boostBusy === "photo-likes"}
              className="rounded-lg bg-fuchsia-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-fuchsia-700 disabled:opacity-50"
            >
              <Plus size={12} className="inline" /> Likes
            </button>
            <button
              type="button"
              onClick={() => void boostRandomViews()}
              disabled={boostBusy === "photo-views"}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Shuffle size={12} className="inline" /> Random Views (25–250)
            </button>
          </div>
        </div>
      )}

      {notice && <div className="mt-2 text-[11.5px] font-semibold text-indigo-700">{notice}</div>}

      <SignInPrompt open={needSignin} onClose={() => setNeedSignin(false)} />

      {/* comments + replies (එක මට්ටමේ threads) */}
      {tree.length > 0 && (
        <div className="mt-3 space-y-3">
          {tree.map((node) => (
            <div key={node.id}>
              {commentCard(node, node.id, false)}
              {node.replies.length > 0 && (
                <div className="ml-6 sm:ml-8 mt-2 space-y-2 border-l-2 border-indigo-100 pl-3">
                  {node.replies.map((r) => commentCard(r, node.id, true))}
                </div>
              )}
              {replyToId === node.id && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitComment(node.id, replyText, () => setReplyText(""));
                  }}
                  className="mt-2 ml-6 sm:ml-8 flex gap-2"
                >
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={si ? `${node.author} ට reply එකක් ලියන්න...` : `Reply to ${node.author}...`}
                    className="field !py-2 !text-[12px] flex-1"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={posting === `reply-${node.id}` || !replyText.trim()}
                    className="btn btn-primary !py-2 !px-3.5 !text-[12px]"
                  >
                    <Send size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyToId(null);
                      setReplyText("");
                    }}
                    className="btn btn-outline !py-2 !px-3 !text-[12px]"
                  >
                    {si ? "එපා" : "Cancel"}
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {/* comment form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitComment(null, text, () => setText(""));
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={me ? "ඔබේ අදහස ලියන්න..." : "Comment කරන්න Sign In වන්න..."}
          className="field !py-2.5 !text-[12.5px] flex-1"
          onFocus={() => {
            if (!me) setNeedSignin(true);
          }}
        />
        <button type="submit" disabled={posting === "comment" || !text.trim()} className="btn btn-primary !py-2 !px-4 !text-[12px]">
          <Send size={13} />
        </button>
      </form>
      {compact && <span className="hidden" />}
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
                  onViews={(n) => setItems((xs) => updateItem(xs, g.id, { views: n }))}
                  onComment={(c) =>
                    setItems((xs) => updateItem(xs, g.id, { comments: [...(xs.find((x) => x.id === g.id)?.comments ?? []), c] }))
                  }
                  onCommentLike={(commentId, n) =>
                    setItems((xs) =>
                      updateItem(xs, g.id, {
                        comments: updateGalleryCommentLikes(xs.find((x) => x.id === g.id)?.comments ?? [], commentId, n),
                      })
                    )
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
                  onViews={(n) => setItems((xs) => updateItem(xs, current.id, { views: n }))}
                  onComment={(c) =>
                    setItems((xs) =>
                      updateItem(xs, current.id, { comments: [...(xs.find((x) => x.id === current.id)?.comments ?? []), c] })
                    )
                  }
                  onCommentLike={(commentId, n) =>
                    setItems((xs) =>
                      updateItem(xs, current.id, {
                        comments: updateGalleryCommentLikes(xs.find((x) => x.id === current.id)?.comments ?? [], commentId, n),
                      })
                    )
                  }
                  trackView
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
