"use client";

// News list with category filter tabs + professional animated news reader

import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Newspaper, Pin, X } from "lucide-react";
import { MediaDetailsStrip, MediaSizeBadge } from "@/components/media-info";
import { useLang } from "@/lib/i18n";
import type { NewsItem } from "@/lib/types";

const TABS = [
  { key: "all", en: "All", si: "සියල්ල" },
  { key: "vacancy", en: "Job Vacancies", si: "රැකියා නිවේදන" },
  { key: "notice", en: "Special Notices", si: "විශේෂ නිවේදන" },
  { key: "tender", en: "Tenders", si: "ටෙන්ඩර්" },
  { key: "general", en: "News & Updates", si: "පුවත් හා යාවත්කාලීන" },
];

export function NewsList({ news }: { news: NewsItem[] }) {
  const { lang } = useLang();
  const si = lang === "si";
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<NewsItem | null>(null);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const openedFromUrl = useRef(false);
  const list = news.filter((n) => tab === "all" || n.category === tab);

  const titleOf = (n: NewsItem) => (si ? n.title_si || n.title_en : n.title_en || n.title_si);
  const descOf = (n: NewsItem) => (si ? n.desc_si || n.desc_en : n.desc_en || n.desc_si);
  const categoryOf = (n: NewsItem) => {
    const tabInfo = TABS.find((x) => x.key === n.category);
    return n.badge_text || (tabInfo ? (si ? tabInfo.si : tabInfo.en) : n.category);
  };

  function openNews(n: NewsItem) {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setClosing(false);
    setSelected(n);
  }

  function closeNews() {
    if (!selected || closing) return;
    setClosing(true);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setSelected(null);
      setClosing(false);
      closeTimer.current = null;
      const url = new URL(window.location.href);
      if (url.searchParams.has("item")) {
        url.searchParams.delete("item");
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      }
    }, 180);
  }

  // Home page news card එකකින් ආවොත්: /news?item=<id> — අදාළ පුවතම reader එකෙන් open වෙනවා
  useEffect(() => {
    if (openedFromUrl.current) return;
    openedFromUrl.current = true;
    const id = new URLSearchParams(window.location.search).get("item");
    if (!id) return;
    const found = news.find((n) => String(n.id) === id);
    if (found) {
      setTab("all");
      setSelected(found);
    }
  }, [news]);

  useEffect(() => {
    if (!selected) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNews();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, closing]);

  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    []
  );

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-8">
        {TABS.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setTab(x.key)}
            aria-pressed={tab === x.key}
            className={`news-filter-tab rounded-full px-5 py-2.5 text-[12.5px] font-bold border ${
              tab === x.key
                ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}
          >
            {si ? x.si : x.en}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card media-card-in p-12 text-center">
          <Newspaper size={44} className="mx-auto text-slate-300" />
          <p className="mt-4 font-extrabold text-slate-800 text-lg">
            {si ? "මෙම කාණ්ඩයේ පුවත් තවම නැහැ" : "No news in this category yet"}
          </p>
          <p className="mt-1.5 text-slate-500 text-[13px]">
            {si ? "වෙනත් කාණ්ඩයක් තෝරලා බලන්න." : "Please choose another category."}
          </p>
        </div>
      ) : (
        <div key={tab} className="space-y-5">
          {list.map((n, i) => (
            <article
              key={n.id}
              className="card card-hover news-card-pro media-card-in overflow-hidden"
              style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}
            >
              <div className="grid md:grid-cols-[280px_1fr]">
                <button
                  type="button"
                  onClick={() => openNews(n)}
                  className="media-zoom group relative block h-52 w-full bg-gradient-to-br from-indigo-900 to-slate-800 text-left md:h-full md:min-h-[13rem]"
                  aria-label={titleOf(n)}
                >
                  {n.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={n.image} alt={n.title_en} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Newspaper size={44} className="text-white/25" />
                    </span>
                  )}
                  <span className="media-shine" aria-hidden="true" />
                  <span className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/70 to-transparent" aria-hidden="true" />
                  <span className="absolute top-3 left-3 z-10 flex gap-2">
                    <span className="badge-blue rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase">
                      {n.badge_text ?? n.category}
                    </span>
                    {n.pinned && (
                      <span className="badge-pinned rounded-full px-2.5 py-0.5 text-[10px] font-bold flex items-center gap-1">
                        <Pin size={10} /> PINNED
                      </span>
                    )}
                  </span>
                  {n.image && <MediaSizeBadge src={n.image} className="absolute bottom-3 right-3 z-10" />}
                  <span className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 translate-y-2 whitespace-nowrap rounded-full bg-white/90 px-4 py-2 text-[11px] font-extrabold text-slate-900 opacity-0 shadow-xl backdrop-blur transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    {si ? "විස්තර බලන්න" : "View Details"}
                  </span>
                </button>
                <div className="p-6 sm:p-7">
                  <div className="flex items-center gap-3 text-[11.5px] text-slate-400">
                    <CalendarDays size={13} /> {n.date}
                    <span className="badge-green rounded-full px-2.5 py-0.5 text-[10px] font-bold">Published</span>
                  </div>
                  <h2 className="mt-2.5 text-xl font-extrabold text-slate-900 leading-snug">
                    <button type="button" onClick={() => openNews(n)} className="text-left transition-colors hover:text-indigo-700">
                      {titleOf(n)}
                    </button>
                  </h2>
                  <p className="mt-2.5 text-slate-500 text-[13.5px] leading-relaxed line-clamp-4">
                    {descOf(n)}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <span className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-indigo-600">
                      {categoryOf(n)}
                    </span>
                    <button
                      type="button"
                      onClick={() => openNews(n)}
                      className="group inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-4 py-2 text-[12px] font-extrabold text-indigo-700 transition hover:bg-indigo-600 hover:text-white"
                    >
                      {si ? "විස්තර බලන්න" : "View Details"}
                      <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Animated news reader — open/view */}
      {selected && (
        <div
          className={`viewer-backdrop fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-3 sm:p-5 no-print ${closing ? "is-closing" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label={titleOf(selected)}
          onClick={closeNews}
        >
          <article
            className="viewer-panel relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[1.6rem] bg-white shadow-[0_45px_100px_-25px_rgba(2,6,23,0.75)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="media-zoom relative h-60 bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-800 sm:h-80">
              {selected.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.image} alt={titleOf(selected)} className="viewer-image h-full w-full object-cover" />
              ) : (
                <div className="viewer-image flex h-full items-center justify-center text-white/25">
                  <Newspaper size={72} />
                </div>
              )}
              <span className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950/75 to-transparent" aria-hidden="true" />
              <span className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
                <span className="badge-blue rounded-full px-3 py-1 text-[10px] font-extrabold uppercase">
                  {categoryOf(selected)}
                </span>
                {selected.pinned && (
                  <span className="badge-pinned flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-extrabold">
                    <Pin size={10} /> PINNED
                  </span>
                )}
              </span>
              {selected.image && (
                <MediaSizeBadge src={selected.image} showName className="absolute bottom-4 right-4 z-10" />
              )}
              <button
                type="button"
                autoFocus
                onClick={closeNews}
                className="viewer-icon-btn absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/75"
                aria-label={si ? "වසන්න" : "Close"}
              >
                <X size={18} />
              </button>
            </div>

            <div className="viewer-copy-in p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-3 text-[11.5px] font-semibold text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={13} /> {selected.date}
                </span>
                <span className="badge-green rounded-full px-2.5 py-0.5 text-[10px] font-bold">Published</span>
              </div>
              <h2 className="mt-3 text-2xl font-black leading-snug text-slate-900 sm:text-3xl">
                {titleOf(selected)}
              </h2>
              <p className="mt-4 whitespace-pre-line text-[14.5px] leading-8 text-slate-600">
                {descOf(selected)}
              </p>
              {selected.image && (
                <MediaDetailsStrip key={`news-media-${selected.id}`} src={selected.image} className="mt-6" />
              )}
              <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <span className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-indigo-600">
                  {categoryOf(selected)}
                </span>
                <button type="button" onClick={closeNews} className="btn btn-primary !px-6">
                  {si ? "වසන්න" : "Close"}
                </button>
              </div>
            </div>
          </article>
        </div>
      )}
    </>
  );
}
