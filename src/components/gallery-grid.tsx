"use client";

// ============================================================================
// Gallery grid — photo + Title + Description හැම විටම user ට පේනවා ✅
// ============================================================================

import { useState } from "react";
import { Heart, ImageIcon, MessageSquare, X } from "lucide-react";
import type { GalleryItem } from "@/lib/types";

const ASPECT: Record<GalleryItem["aspect"], string> = {
  "4:3": "4 / 3",
  "16:9": "16 / 9",
  "1:1": "1 / 1",
  "3:2": "3 / 2",
};

export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const [open, setOpen] = useState<GalleryItem | null>(null);
  const idx = open ? items.findIndex((x) => x.id === open.id) : -1;
  const [liked, setLiked] = useState<Record<string, boolean>>({});

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
            {/* ✅ title + description හැම විටම පේනවා */}
            <figcaption className="p-5">
              <h3 className="font-extrabold text-slate-900 leading-snug">{g.title}</h3>
              <p className="text-slate-500 text-[12.5px] mt-1.5 leading-relaxed">{g.description}</p>
              <div className="flex items-center gap-4 mt-3.5 text-[12px] text-slate-500">
                <button
                  className="flex items-center gap-1.5 hover:text-rose-600"
                  onClick={() => setLiked((l) => ({ ...l, [g.id]: !l[g.id] }))}
                >
                  <Heart size={14} className={liked[g.id] ? "fill-rose-500 text-rose-500" : ""} />
                  {(g.likes ?? 0) + (liked[g.id] ? 1 : 0)} Likes
                </button>
                <span className="flex items-center gap-1.5">
                  <MessageSquare size={14} /> {(g.comments?.length ?? 0)} Comments
                </span>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
      )}

      {/* lightbox — title + description මෙතනත් */}
      {open && (
        <div
          className="fixed inset-0 z-[90] bg-slate-900/80 flex items-center justify-center p-4 no-print"
          onClick={() => setOpen(null)}
        >
          <div className="card max-w-3xl w-full p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="relative bg-slate-800" style={{ aspectRatio: ASPECT[open.aspect] }}>
              {open.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={open.image} alt={open.title} className="absolute inset-0 w-full h-full object-cover" />
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
                    onClick={(e) => { e.stopPropagation(); setOpen(items[(idx - 1 + items.length) % items.length]); }}
                    aria-label="Previous"
                  >
                    ‹
                  </button>
                  <button
                    className="absolute right-16 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/25 hover:bg-white/45 text-white flex items-center justify-center text-xl font-black transition"
                    onClick={(e) => { e.stopPropagation(); setOpen(items[(idx + 1) % items.length]); }}
                    aria-label="Next"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            <div className="p-6">
              <h3 className="text-xl font-extrabold text-slate-900">{open.title}</h3>
              <p className="text-slate-500 text-[13.5px] mt-2 leading-relaxed">{open.description}</p>
              <div className="flex items-center gap-4 mt-4 text-[12.5px] text-slate-500 border-t border-slate-100 pt-4">
                <span className="flex items-center gap-1.5">
                  <Heart size={14} className="fill-rose-500 text-rose-500" /> {open.likes} Likes
                </span>
                <span className="flex items-center gap-1.5">
                  <MessageSquare size={14} /> {(open.comments?.length ?? 0)} Comments
                </span>
                <span className="badge-amber rounded-full px-2.5 py-0.5 text-[10px] font-bold ml-auto">{open.aspect}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
