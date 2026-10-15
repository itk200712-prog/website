"use client";

// News list with category filter tabs

import { useState } from "react";
import { CalendarDays, Newspaper, Pin } from "lucide-react";
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
  const [tab, setTab] = useState("all");
  const list = news.filter((n) => tab === "all" || n.category === tab);

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-8">
        {TABS.map((x) => (
          <button
            key={x.key}
            onClick={() => setTab(x.key)}
            className={`rounded-full px-4.5 py-2.5 text-[12.5px] font-bold border transition px-5 ${
              tab === x.key
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}
          >
            {lang === "si" ? x.si : x.en}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {list.map((n) => (
          <article key={n.id} className="card card-hover overflow-hidden">
            <div className="grid md:grid-cols-[280px_1fr]">
              <div className="h-52 md:h-full bg-gradient-to-br from-indigo-900 to-slate-800 relative flex items-center justify-center">
                {n.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.image} alt={n.title_en} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <Newspaper size={44} className="text-white/25" />
                )}
                <div className="absolute top-3 left-3 flex gap-2">
                  <span className="badge-blue rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase">
                    {n.badge_text ?? n.category}
                  </span>
                  {n.pinned && (
                    <span className="badge-pinned rounded-full px-2.5 py-0.5 text-[10px] font-bold flex items-center gap-1">
                      <Pin size={10} /> PINNED
                    </span>
                  )}
                </div>
              </div>
              <div className="p-6 sm:p-7">
                <div className="flex items-center gap-3 text-[11.5px] text-slate-400">
                  <CalendarDays size={13} /> {n.date}
                  <span className="badge-green rounded-full px-2.5 py-0.5 text-[10px] font-bold">Published</span>
                </div>
                <h2 className="mt-2.5 text-xl font-extrabold text-slate-900 leading-snug">
                  {lang === "si" ? n.title_si : n.title_en}
                </h2>
                <p className="mt-2.5 text-slate-500 text-[13.5px] leading-relaxed">
                  {lang === "si" ? n.desc_si : n.desc_en}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
