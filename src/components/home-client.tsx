"use client";

// ============================================================================
// Home — business cards grid (client, language-aware)
// ============================================================================

import Link from "next/link";
import { ArrowRight, UserRound } from "lucide-react";
import { PhoneImageIcon as Phone } from "@/components/site-icons";
import { useLang } from "@/lib/i18n";
import type { BusinessUnit } from "@/lib/types";

export function BusinessCard({ b }: { b: BusinessUnit }) {
  const { lang } = useLang();
  return (
    <Link href={`/businesses/${b.slug}`} className="card card-hover p-6 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[11px] font-black text-slate-500 overflow-hidden">
          {b.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.logo} alt="" className="w-full h-full object-cover" />
          ) : (
            b.name_en.slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="badge-blue rounded-full px-2.5 py-0.5 text-[10px] font-bold">
            {lang === "si" ? b.category_si || b.category_en : b.category_en}
          </span>
          {b.is_new && <span className="badge-new">NEW</span>}
        </div>
      </div>
      <h3 className="mt-4 text-lg font-extrabold text-slate-900 leading-snug">
        {lang === "si" ? b.name_si || b.name_en : b.name_en}
      </h3>
      {(lang === "si" ? b.tagline_si : b.tagline_en) && (
        <div className="text-amber-700 font-semibold text-[13px] mt-2">
          {lang === "si" ? b.tagline_si : b.tagline_en}
        </div>
      )}
      {(lang === "si" ? b.desc_si : b.desc_en) && (
        <p className="text-slate-500 text-[12.5px] leading-relaxed mt-2 line-clamp-3">
          {(lang === "si" ? b.desc_si : b.desc_en).slice(0, 120)}…
        </p>
      )}
      {b.contacts[0] && (
        <div className="mt-4 space-y-1 text-[12px] text-slate-500">
          <div className="flex items-center gap-2">
            <UserRound size={13} className="text-slate-400" />
            {b.contacts[0].name}
          </div>
          <div className="flex items-center gap-2">
            <Phone size={13} className="text-slate-400" />
            {b.contacts[0].phone}
          </div>
        </div>
      )}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="badge-amber rounded-full px-2.5 py-1 text-[11px] font-bold">
          Services ({b.services.length})
        </span>
        <span className="text-indigo-700 text-[12px] font-bold flex items-center gap-1">
          View Page <ArrowRight size={13} />
        </span>
      </div>
    </Link>
  );
}

export function HomeClientBits({ businesses }: { businesses: BusinessUnit[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {businesses.map((b) => (
        <BusinessCard key={b.slug} b={b} />
      ))}
    </div>
  );
}
